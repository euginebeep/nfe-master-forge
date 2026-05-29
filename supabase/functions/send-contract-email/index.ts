import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
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
    if (await isDemoUser(req.headers.get("Authorization"))) {
      return demoBlockedResponse(corsHeaders, "envio de e-mails reais");
    }
    const SMTP_USER = (Deno.env.get('SMTP_USER') || '').trim();
    const SMTP_PASS = (Deno.env.get('SMTP_PASS') || '').trim();

    console.log('SMTP_USER length:', SMTP_USER.length, 'chars:', JSON.stringify(SMTP_USER));

    if (!SMTP_USER || !SMTP_PASS) {
      throw new Error('Credenciais SMTP não configuradas. Configure em Admin Master.');
    }

    const { to, subject, htmlBody, senderName } = await req.json();

    if (!to || !subject || !htmlBody) {
      throw new Error('Campos obrigatórios: to, subject, htmlBody');
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.hostinger.com",
        port: 465,
        tls: true,
        auth: {
          username: SMTP_USER,
          password: SMTP_PASS,
        },
      },
    });

    // Validate SMTP_USER is a valid email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(SMTP_USER)) {
      throw new Error(`SMTP_USER não é um email válido: "${SMTP_USER}". Configure um email completo (ex: contato@dominio.com)`);
    }

    const fromAddress = senderName ? `${senderName} <${SMTP_USER}>` : SMTP_USER;

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
    console.error('Erro ao enviar email:', error);
    const msg = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
