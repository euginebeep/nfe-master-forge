import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { isDemoUser, demoBlockedResponse } from "../_shared/demo-guard.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (await isDemoUser(authHeader)) {
      return demoBlockedResponse(corsHeaders, "envio de e-mails reais");
    }

    if (!authHeader) throw new Error("Não autenticado");

    const { to, subject, htmlBody, senderName } = await req.json();

    if (!to || !subject || !htmlBody) {
      throw new Error('Campos obrigatórios: to, subject, htmlBody');
    }

    // Identifica usuário e empresa (tenant)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) throw new Error("Sessão inválida");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      throw new Error("Empresa não vinculada ao usuário.");
    }

    const { data: company } = await admin
      .from("company")
      .select("smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_name, smtp_from_email, razao_social, nome_fantasia")
      .eq("id", profile.company_id)
      .maybeSingle();

    const SMTP_HOST = (company?.smtp_host || "").trim();
    const SMTP_USER = (company?.smtp_user || "").trim();
    let SMTP_PASS = "";
    {
      const { data: pwd } = await admin.rpc("get_company_smtp_password", {
        p_company_id: profile.company_id,
      });
      SMTP_PASS = (pwd || "").toString();
    }
    const SMTP_PORT = company?.smtp_port || 465;
    const SMTP_SECURE = company?.smtp_secure ?? true;

    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "SMTP da empresa não configurado. Acesse Configurações → Empresa → SMTP e cadastre o servidor de envio.",
          code: "SMTP_NOT_CONFIGURED",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const fromEmail = (company?.smtp_from_email || SMTP_USER).trim();
    if (!emailRegex.test(fromEmail)) {
      throw new Error(`E-mail de remetente inválido: "${fromEmail}". Configure em Empresa → SMTP.`);
    }

    const client = new SMTPClient({
      connection: {
        hostname: SMTP_HOST,
        port: SMTP_PORT,
        tls: SMTP_SECURE,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    const displayName = (senderName || company?.smtp_from_name || company?.nome_fantasia || company?.razao_social || "").trim();
    const fromAddress = displayName ? `${displayName} <${fromEmail}>` : fromEmail;

    await client.send({
      from: fromAddress,
      to: to,
      subject: subject,
      content: "Visualize este email em um cliente que suporte HTML.",
      html: htmlBody,
    });

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: 'Email enviado com sucesso' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    // NEVER log the raw error object — may contain SMTP credentials
    const rawMsg = error instanceof Error ? error.message : "Erro desconhecido";
    const msg = sanitizeError(rawMsg);
    console.error("Erro ao enviar email (sanitizado):", msg);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Strip anything that resembles credentials before logging or returning to UI
function sanitizeError(msg: string): string {
  return msg
    .replace(/AUTH\s+[A-Z]+\s+[^\s]+/gi, "AUTH ***")
    .replace(/password=[^\s&;,]+/gi, "password=***")
    .replace(/(:|=)\s*[A-Za-z0-9+/=]{12,}/g, "$1***")
    .slice(0, 300);
}
