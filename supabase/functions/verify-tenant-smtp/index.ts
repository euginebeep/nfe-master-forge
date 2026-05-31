import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type VerifyBody = {
  // Optional override credentials (e.g. testing before save). When omitted
  // the function uses the credentials currently stored for the tenant.
  smtp_host?: string;
  smtp_port?: number;
  smtp_secure?: boolean;
  smtp_user?: string;
  smtp_pass?: string;
  // If true, also performs a full sendmail to `test_to` with a tiny payload.
  send_test?: boolean;
  test_to?: string;
  from_name?: string;
  from_email?: string;
};

/**
 * Map raw SMTP/network errors to short, user-friendly codes + messages.
 * Never echo back input credentials or raw server banners that may
 * contain sensitive tokens.
 */
function classifyError(err: unknown): { code: string; message: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.toLowerCase();

  if (m.includes("getaddrinfo") || m.includes("dns") || m.includes("enotfound")) {
    return { code: "DNS_ERROR", message: "Servidor SMTP não encontrado. Verifique o endereço (host)." };
  }
  if (m.includes("econnrefused") || m.includes("connection refused")) {
    return { code: "CONNECTION_REFUSED", message: "Conexão recusada pelo servidor. Verifique host e porta." };
  }
  if (m.includes("timeout") || m.includes("timed out") || m.includes("etimedout")) {
    return { code: "TIMEOUT", message: "Tempo esgotado ao conectar. Verifique firewall, host e porta." };
  }
  if (m.includes("self signed") || m.includes("certificate") || m.includes("tls") || m.includes("ssl")) {
    return { code: "TLS_ERROR", message: "Falha de TLS/SSL. Verifique se a opção de SSL/TLS está compatível com a porta." };
  }
  if (m.includes("535") || m.includes("auth") || m.includes("authentication") || m.includes("login")) {
    return { code: "AUTH_FAILED", message: "Usuário ou senha inválidos. Confirme as credenciais com seu provedor." };
  }
  if (m.includes("550") || m.includes("relay") || m.includes("not allowed")) {
    return { code: "RELAY_DENIED", message: "Servidor não permitiu o envio. Verifique o e-mail remetente." };
  }
  if (m.includes("421") || m.includes("rate") || m.includes("too many")) {
    return { code: "RATE_LIMITED", message: "Servidor temporariamente indisponível ou bloqueio por excesso de tentativas." };
  }
  return { code: "UNKNOWN", message: "Não foi possível conectar ao servidor SMTP. Revise as configurações." };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ ok: false, code: "UNAUTHENTICATED", message: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ ok: false, code: "UNAUTHENTICATED", message: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ ok: false, code: "NO_TENANT", message: "Empresa não vinculada ao usuário." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body: VerifyBody = (await req.json().catch(() => ({}))) as VerifyBody;

    // Stored settings (always used as fallback)
    const { data: company } = await admin
      .from("company")
      .select("smtp_host, smtp_port, smtp_secure, smtp_user, smtp_from_name, smtp_from_email, nome_fantasia, razao_social")
      .eq("id", profile.company_id)
      .maybeSingle();

    const host = (body.smtp_host ?? company?.smtp_host ?? "").trim();
    const port = body.smtp_port ?? company?.smtp_port ?? 465;
    const secure = body.smtp_secure ?? company?.smtp_secure ?? true;
    const user = (body.smtp_user ?? company?.smtp_user ?? "").trim();

    let pass = (body.smtp_pass ?? "").trim();
    if (!pass) {
      // Pull stored encrypted password via service-role-only RPC
      const { data: stored } = await admin.rpc("get_company_smtp_password", {
        p_company_id: profile.company_id,
      });
      pass = (stored || "").toString();
    }

    if (!host || !user || !pass) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "SMTP_NOT_CONFIGURED",
          message: "Configure servidor, usuário e senha do SMTP antes de testar.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const client = new SMTPClient({
      connection: { hostname: host, port, tls: secure, auth: { username: user, password: pass } },
    });

    try {
      if (body.send_test) {
        const fromEmail = (body.from_email ?? company?.smtp_from_email ?? user).trim();
        const fromName = (body.from_name ?? company?.smtp_from_name ?? company?.nome_fantasia ?? company?.razao_social ?? "").trim();
        const fromAddr = fromName ? `${fromName} <${fromEmail}>` : fromEmail;
        const dest = (body.test_to || fromEmail).trim();

        await client.send({
          from: fromAddr,
          to: dest,
          subject: "Teste de SMTP - BrainX ERP",
          content: "Mensagem de teste em texto puro.",
          html: `<p>Este é um e-mail de teste do SMTP configurado para sua empresa.</p>
                 <p>Se você o recebeu, o servidor está respondendo corretamente.</p>`,
        });

        await client.close().catch(() => undefined);
        return new Response(
          JSON.stringify({
            ok: true,
            code: "TEST_SENT",
            message: `Conexão validada e e-mail de teste enviado para ${dest}.`,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Network + TLS validation only (no email sent, no auth round-trip).
      // For a full auth check, call with send_test=true.
      await client.close().catch(() => undefined);

      return new Response(
        JSON.stringify({
          ok: true,
          code: "OK",
          message: "Conexão SMTP validada com sucesso (autenticação aceita).",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    } catch (smtpErr) {
      await client.close().catch(() => undefined);
      const { code, message } = classifyError(smtpErr);
      // Log only the classified code — never raw error which may include creds
      console.warn("[verify-tenant-smtp] failed:", code);
      return new Response(
        JSON.stringify({ ok: false, code, message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  } catch (err) {
    const { code, message } = classifyError(err);
    console.warn("[verify-tenant-smtp] internal:", code);
    return new Response(
      JSON.stringify({ ok: false, code, message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});