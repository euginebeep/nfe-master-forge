/**
 * Supabase Edge Function: send-anvisa-alert
 * 
 * Envia alertas críticos de conformidade ANVISA para o Responsável Técnico
 * 
 * Trigger: Chamada via anvisa-monitoring.service.ts
 * 
 * Payload:
 * {
 *   to: "rt@empresa.com",
 *   subject: "🚨 ALERTA CRÍTICO ANVISA",
 *   alerts: [...],
 *   productsNonCompliant: [...],
 *   timestamp: "2026-06-30T15:00:00Z"
 * }
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const DEFAULT_FROM = 'BrainX ERP <noreply@brainxerp.com.br>';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function resolveFromAddress(
  req: Request,
  admin: ReturnType<typeof createClient>,
): Promise<string> {
  const authHeader = req.headers.get('Authorization');
  if (authHeader) {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (userData?.user) {
      const { data: profile } = await admin
        .from('profiles')
        .select('company_id')
        .eq('id', userData.user.id)
        .maybeSingle();

      if (profile?.company_id) {
        const { data: company } = await admin
          .from('company')
          .select('smtp_from_email, smtp_from_name')
          .eq('id', profile.company_id)
          .maybeSingle();

        const fromEmail = (company?.smtp_from_email || '').trim();
        if (fromEmail) {
          const fromName = (company?.smtp_from_name || 'BrainX ERP').trim();
          return `${fromName} <${fromEmail}>`;
        }
      }
    }
  }

  const envFrom = (Deno.env.get('RESEND_DEFAULT_FROM') || DEFAULT_FROM).trim();
  if (!envFrom) {
    throw new Error(
      'Remetente não configurado: cadastre smtp_from_email em Configurações → Empresa ou defina RESEND_DEFAULT_FROM.',
    );
  }
  return envFrom;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, alerts, productsNonCompliant, timestamp } = await req.json();

    // Validar entrada
    if (!to || !subject || !alerts) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, alerts' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    const fromAddress = await resolveFromAddress(req, supabase);

    // Construir corpo do email
    const emailBody = generateEmailBody(alerts, productsNonCompliant, timestamp);

    // Enviar email via Resend (ou outro serviço)
    await sendEmailViaResend(to, subject, emailBody, fromAddress);

    // Registrar no banco de dados
    const { error: logError } = await supabase
      .from('anvisa_alert_logs')
      .insert({
        recipient: to,
        subject,
        alerts_count: alerts.length,
        products_non_compliant_count: productsNonCompliant?.length || 0,
        status: 'sent',
        timestamp: new Date().toISOString(),
      });

    if (logError) {
      console.error('Falha ao registrar log de alerta ANVISA:', logError);
      return new Response(
        JSON.stringify({
          error: `Alerta enviado, mas falha ao registrar log: ${logError.message || logError.code}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Alert sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error sending ANVISA alert:', error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Gera corpo do email em HTML
 */
function generateEmailBody(alerts: any[], productsNonCompliant: any[], timestamp: string): string {
  const criticalAlerts = alerts.filter(a => a.severity === 'critical');
  const warningAlerts = alerts.filter(a => a.severity === 'warning');

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Alerta ANVISA</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; padding: 20px; }
    .container { max-width: 800px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); overflow: hidden; }
    .header { background: linear-gradient(135deg, #dc3545 0%, #c82333 100%); color: white; padding: 30px; text-align: center; }
    .header h1 { font-size: 28px; margin-bottom: 10px; }
    .header p { font-size: 14px; opacity: 0.9; }
    .content { padding: 30px; }
    .alert-section { margin-bottom: 30px; }
    .alert-section h2 { font-size: 18px; color: #333; margin-bottom: 15px; border-bottom: 2px solid #dc3545; padding-bottom: 10px; }
    .alert-item { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin-bottom: 10px; border-radius: 4px; }
    .alert-item.critical { background: #f8d7da; border-left-color: #dc3545; }
    .alert-item h3 { font-size: 14px; color: #333; margin-bottom: 5px; }
    .alert-item p { font-size: 13px; color: #666; margin: 5px 0; }
    .product-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    .product-table th { background: #f9f9f9; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; font-size: 13px; }
    .product-table td { padding: 12px; border-bottom: 1px solid #ddd; font-size: 13px; }
    .product-table tr:hover { background: #f9f9f9; }
    .action-required { background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin-top: 20px; border-radius: 4px; }
    .action-required h3 { color: #155724; margin-bottom: 10px; }
    .action-required ul { margin-left: 20px; color: #155724; }
    .action-required li { margin: 5px 0; }
    .footer { background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    .timestamp { font-size: 12px; color: #999; margin-top: 10px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🚨 ALERTA CRÍTICO ANVISA</h1>
      <p>Problemas de conformidade detectados no sistema</p>
    </div>

    <div class="content">
      ${
        criticalAlerts.length > 0
          ? `
        <div class="alert-section">
          <h2>⛔ Alertas Críticos (${criticalAlerts.length})</h2>
          ${criticalAlerts
            .map(
              alert => `
            <div class="alert-item critical">
              <h3>${alert.title}</h3>
              <p><strong>Tipo:</strong> ${alert.type}</p>
              <p><strong>Mensagem:</strong> ${alert.message}</p>
              ${alert.affectedProducts ? `<p><strong>Produtos Afetados:</strong> ${alert.affectedProducts.join(', ')}</p>` : ''}
              ${alert.deadline ? `<p><strong>Prazo:</strong> ${new Date(alert.deadline).toLocaleDateString('pt-BR')}</p>` : ''}
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        warningAlerts.length > 0
          ? `
        <div class="alert-section">
          <h2>⚠️ Avisos (${warningAlerts.length})</h2>
          ${warningAlerts
            .map(
              alert => `
            <div class="alert-item">
              <h3>${alert.title}</h3>
              <p><strong>Tipo:</strong> ${alert.type}</p>
              <p><strong>Mensagem:</strong> ${alert.message}</p>
            </div>
          `
            )
            .join('')}
        </div>
      `
          : ''
      }

      ${
        productsNonCompliant && productsNonCompliant.length > 0
          ? `
        <div class="alert-section">
          <h2>📦 Produtos Não Conformes (${productsNonCompliant.length})</h2>
          <table class="product-table">
            <thead>
              <tr>
                <th>Produto</th>
                <th>Fabricante</th>
                <th>Constituinte</th>
                <th>Dose</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              ${productsNonCompliant
                .flatMap(product =>
                  product.issues.map(
                    issue => `
                <tr>
                  <td><strong>${product.productName}</strong></td>
                  <td>${product.manufacturer}</td>
                  <td>${issue.constituent}</td>
                  <td>${issue.dose}${issue.unit}</td>
                  <td>${issue.reason}</td>
                </tr>
              `
                  )
                )
                .join('')}
            </tbody>
          </table>
        </div>
      `
          : ''
      }

      <div class="action-required">
        <h3>✅ Ações Recomendadas</h3>
        <ul>
          <li>Revisar imediatamente os produtos não conformes</li>
          <li>Consultar a legislação ANVISA referenciada</li>
          <li>Adequar fórmulas conforme necessário</li>
          <li>Atualizar banco de dados com novas informações</li>
          <li>Notificar fabricantes sobre mudanças obrigatórias</li>
        </ul>
      </div>

      <div class="timestamp">
        <p>Verificação realizada em: ${new Date(timestamp).toLocaleString('pt-BR')}</p>
        <p>Sistema de Monitoramento ANVISA — BrainX ERP</p>
      </div>
    </div>

    <div class="footer">
      <p>Este é um email automático. Não responda diretamente. Para suporte, contate o administrador do sistema.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Envia email via Resend
 */
async function sendEmailViaResend(
  to: string,
  subject: string,
  html: string,
  from: string,
): Promise<Response> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY');

  if (!resendApiKey) {
    throw new Error('RESEND_API_KEY not configured');
  }

  if (!from?.trim()) {
    throw new Error(
      'Remetente não configurado: cadastre smtp_from_email em Configurações → Empresa ou defina RESEND_DEFAULT_FROM.',
    );
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from.trim(),
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to send email: ${error.message || response.statusText}`);
  }

  return response;
}
