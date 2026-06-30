import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@18.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

    // Verify caller is admin or SaaS role
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: userRoles } = await supabaseClient.from('user_roles').select('role').eq('user_id', callingUser.id)
    const roles = userRoles?.map(r => r.role) || []
    const isSaasAdmin = roles.some(r => ['admin', 'saas_owner', 'saas_suporte', 'saas_financeiro'].includes(r))

    if (!isSaasAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    // ─── LIST: Get all companies with extended SaaS data ───
    if (action === 'list') {
      const { data: companies, error: compErr } = await supabaseAdmin
        .from('company')
        .select('id, razao_social, nome_fantasia, cnpj, telefone, created_at, email_financeiro, email_fiscal, acesso_liberado_ate, tipo_empresa')
        .order('created_at', { ascending: false })

      if (compErr) throw compErr

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, company_id, nome_completo, status, ultimo_acesso, created_at')

      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })
      const emailMap = new Map<string, string>()
      authUsers?.forEach(u => emailMap.set(u.id, u.email || ''))

      // Support info
      const { data: tickets } = await supabaseAdmin.from('saas_tickets').select('id, company_id, status')
      
      const companyData = (companies || []).map(c => {
        const companyProfiles = (profiles || []).filter(p => p.company_id === c.id)
        const ownerProfile = companyProfiles[0]
        const ownerEmail = ownerProfile ? emailMap.get(ownerProfile.id) || '' : ''
        const companyTickets = (tickets || []).filter(t => t.company_id === c.id)

        return {
          ...c,
          total_usuarios: companyProfiles.length,
          owner_email: ownerEmail,
          owner_nome: ownerProfile?.nome_completo || '',
          ultimo_acesso: companyProfiles.reduce((latest, p) => {
            if (!p.ultimo_acesso) return latest
            return !latest || p.ultimo_acesso > latest ? p.ultimo_acesso : latest
          }, null as string | null),
          tickets_abertos: companyTickets.filter(t => t.status === 'ABERTO').length,
          usuarios: companyProfiles.map(p => ({
            id: p.id,
            nome: p.nome_completo,
            email: emailMap.get(p.id) || '',
            status: p.status || 'ATIVO',
            ultimo_acesso: p.ultimo_acesso,
            created_at: p.created_at,
          })),
        }
      })

      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' })
        for (const company of companyData) {
          if (!company.owner_email) continue
          try {
            const customers = await stripe.customers.list({ email: company.owner_email, limit: 1 })
            if (customers.data.length > 0) {
              const customerId = customers.data[0].id
              const subs = await stripe.subscriptions.list({ customer: customerId, limit: 1 })
              if (subs.data.length > 0) {
                const sub = subs.data[0]
                company.stripe = {
                  status: sub.status,
                  plan: sub.items.data[0]?.price?.nickname || 'Premium',
                  current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: sub.cancel_at_period_end,
                }
              }
            }
          } catch (e) { console.error(e) }
        }
      }

      return new Response(JSON.stringify({ companies: companyData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── TICKETS: List and manage tickets ───
    if (action === 'list-tickets') {
      const { data: tickets, error } = await supabaseAdmin
        .from('saas_tickets')
        .select('*, company:company(razao_social, nome_fantasia)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return new Response(JSON.stringify({ tickets }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'update-ticket') {
      const { id, status, atribuido_a } = await req.json()
      const { data, error } = await supabaseAdmin
        .from('saas_tickets')
        .update({ status, atribuido_a, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
      return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // ─── AI CONFIG: Get and update models ───
    if (action === 'list-ai-configs') {
      const { data: configs, error } = await supabaseAdmin.from('saas_ai_config').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return new Response(JSON.stringify({ configs }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Existing actions (block, unblock, delete-company, grant-access, update-company)
    if (['block', 'unblock', 'delete-company', 'grant-access', 'update-company'].includes(action)) {
      const body = await req.json()
      const { company_id } = body

      if (action === 'update-company') {
        const { updates } = body
        const { data, error } = await supabaseAdmin.from('company').update(updates).eq('id', company_id)
        if (error) throw error
        return new Response(JSON.stringify({ success: true, data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      
      if (action === 'block' || action === 'unblock') {
        const newStatus = action === 'block' ? 'BLOQUEADO' : 'ATIVO'
        await supabaseAdmin.from('profiles').update({ status: newStatus }).eq('company_id', company_id)
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (action === 'grant-access') {
        const { days } = body
        const until = new Date()
        until.setDate(until.getDate() + (days || 30))
        await supabaseAdmin.from('company').update({ acesso_liberado_ate: until.toISOString() }).eq('id', company_id)
        return new Response(JSON.stringify({ success: true, until: until.toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (action === 'delete-company') {
        const { data: profiles } = await supabaseAdmin.from('profiles').select('id').eq('company_id', company_id)
        for (const p of (profiles || [])) await supabaseAdmin.auth.admin.deleteUser(p.id)
        await supabaseAdmin.from('company').delete().eq('id', company_id)
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
