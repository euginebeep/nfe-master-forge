// BrainX ERP — Auth Email Hook
// Substituição do @lovable.dev/email-js por Resend (https://resend.com)
// Configurar o secret RESEND_API_KEY no Supabase para ativar.
// Sem RESEND_API_KEY, o hook retorna erro 500 e o Supabase usa o e-mail padrão.
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { SignupEmail } from '../_shared/email-templates/signup.tsx'
import { InviteEmail } from '../_shared/email-templates/invite.tsx'
import { MagicLinkEmail } from '../_shared/email-templates/magic-link.tsx'
import { RecoveryEmail } from '../_shared/email-templates/recovery.tsx'
import { EmailChangeEmail } from '../_shared/email-templates/email-change.tsx'
import { ReauthenticationEmail } from '../_shared/email-templates/reauthentication.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const EMAIL_SUBJECTS: Record<string, string> = {
  signup: 'Confirme seu e-mail — BrainX ERP',
  invite: 'Você foi convidado — BrainX ERP',
  magiclink: 'Seu link de acesso — BrainX ERP',
  recovery: 'Redefinir sua senha — BrainX ERP',
  email_change: 'Confirme a alteração de e-mail — BrainX ERP',
  reauthentication: 'Seu código de verificação — BrainX ERP',
}

const EMAIL_TEMPLATES: Record<string, React.ComponentType<any>> = {
  signup: SignupEmail,
  invite: InviteEmail,
  magiclink: MagicLinkEmail,
  recovery: RecoveryEmail,
  email_change: EmailChangeEmail,
  reauthentication: ReauthenticationEmail,
}

const SITE_NAME = 'BrainX ERP'
const ROOT_DOMAIN = 'brainxerp.com.br'
const FROM_EMAIL = `BrainX ERP <noreply@${ROOT_DOMAIN}>`

// Envia e-mail via Resend API
async function sendViaResend(params: {
  to: string
  from: string
  subject: string
  html: string
  text: string
  resendApiKey: string
}): Promise<{ id: string }> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${params.resendApiKey}`,
    },
    body: JSON.stringify({
      from: params.from,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Resend API error ${res.status}: ${err}`)
  }
  return res.json()
}

// Hook principal do Supabase Auth — recebe payload via POST
// Formato do payload do Supabase Auth Hook:
// { type: "send_email", email: "...", data: { action_type: "signup|recovery|...", url: "...", token: "...", ... } }
async function handleWebhook(req: Request): Promise<Response> {
  const resendApiKey = Deno.env.get('RESEND_API_KEY')
  if (!resendApiKey) {
    console.error('[auth-email-hook] RESEND_API_KEY nao configurada')
    return new Response(
      JSON.stringify({ error: 'RESEND_API_KEY nao configurada nos secrets do Supabase' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let payload: any
  try {
    payload = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Payload JSON invalido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Supabase envia o tipo de e-mail em payload.email_data.email_action_type
  // ou em payload.data.action_type dependendo da versao do hook
  const emailType =
    payload?.email_data?.email_action_type ||
    payload?.data?.action_type ||
    payload?.type

  const recipientEmail =
    payload?.email_data?.email ||
    payload?.data?.email ||
    payload?.email

  const confirmationUrl =
    payload?.email_data?.confirmation_url ||
    payload?.data?.url ||
    payload?.url

  const token =
    payload?.email_data?.token ||
    payload?.data?.token ||
    payload?.token

  const newEmail =
    payload?.email_data?.new_email ||
    payload?.data?.new_email

  console.log('[auth-email-hook] Recebido', { emailType, recipientEmail })

  if (!emailType || !recipientEmail) {
    console.error('[auth-email-hook] Payload incompleto', payload)
    return new Response(
      JSON.stringify({ error: 'Payload incompleto: emailType ou recipientEmail ausente' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const EmailTemplate = EMAIL_TEMPLATES[emailType]
  if (!EmailTemplate) {
    console.error('[auth-email-hook] Tipo de e-mail desconhecido', { emailType })
    return new Response(
      JSON.stringify({ error: `Tipo de e-mail desconhecido: ${emailType}` }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const templateProps = {
    siteName: SITE_NAME,
    siteUrl: `https://${ROOT_DOMAIN}`,
    recipient: recipientEmail,
    confirmationUrl: confirmationUrl || `https://${ROOT_DOMAIN}`,
    token,
    email: recipientEmail,
    newEmail,
  }

  const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
  const text = await renderAsync(React.createElement(EmailTemplate, templateProps), {
    plainText: true,
  })

  try {
    const result = await sendViaResend({
      to: recipientEmail,
      from: FROM_EMAIL,
      subject: EMAIL_SUBJECTS[emailType] || 'Notificacao — BrainX ERP',
      html,
      text,
      resendApiKey,
    })
    console.log('[auth-email-hook] E-mail enviado com sucesso', { id: result.id, emailType, recipientEmail })
    return new Response(
      JSON.stringify({ success: true, message_id: result.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Falha ao enviar e-mail'
    console.error('[auth-email-hook] Erro ao enviar via Resend', { error: message })
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

// Preview endpoint — renderiza o template HTML sem enviar
async function handlePreview(req: Request): Promise<Response> {
  const previewCorsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type',
  }
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: previewCorsHeaders })
  }

  let type: string
  try {
    const body = await req.json()
    type = body.type
  } catch {
    return new Response(JSON.stringify({ error: 'JSON invalido' }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const SAMPLE_DATA: Record<string, object> = {
    signup: { siteName: SITE_NAME, siteUrl: `https://${ROOT_DOMAIN}`, recipient: 'user@example.com', confirmationUrl: `https://${ROOT_DOMAIN}` },
    magiclink: { siteName: SITE_NAME, confirmationUrl: `https://${ROOT_DOMAIN}` },
    recovery: { siteName: SITE_NAME, confirmationUrl: `https://${ROOT_DOMAIN}` },
    invite: { siteName: SITE_NAME, siteUrl: `https://${ROOT_DOMAIN}`, confirmationUrl: `https://${ROOT_DOMAIN}` },
    email_change: { siteName: SITE_NAME, email: 'old@example.com', newEmail: 'new@example.com', confirmationUrl: `https://${ROOT_DOMAIN}` },
    reauthentication: { token: '123456' },
  }

  const EmailTemplate = EMAIL_TEMPLATES[type]
  if (!EmailTemplate) {
    return new Response(JSON.stringify({ error: `Tipo desconhecido: ${type}` }), {
      status: 400,
      headers: { ...previewCorsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const sampleData = SAMPLE_DATA[type] || {}
  const html = await renderAsync(React.createElement(EmailTemplate, sampleData))
  return new Response(html, {
    status: 200,
    headers: { ...previewCorsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const url = new URL(req.url)
  if (url.pathname.endsWith('/preview')) {
    return handlePreview(req)
  }

  try {
    return await handleWebhook(req)
  } catch (error) {
    console.error('[auth-email-hook] Erro nao tratado:', error)
    const message = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
