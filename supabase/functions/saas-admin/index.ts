import { createClient } from 'npm:@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@18.5.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Verify caller is admin
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user: callingUser }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !callingUser) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { data: isAdmin } = await supabaseClient.rpc('has_role', { _user_id: callingUser.id, _role: 'admin' })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    // ─── LIST: Get all companies with user counts ───
    if (action === 'list') {
      const { data: companies, error: compErr } = await supabaseAdmin
        .from('company')
        .select('id, razao_social, nome_fantasia, cnpj, telefone, created_at, email_financeiro, email_fiscal, acesso_liberado_ate')
        .order('created_at', { ascending: false })

      if (compErr) throw compErr

      // Get user counts per company
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, company_id, nome_completo, status, ultimo_acesso, created_at')

      // Get all auth users to get emails
      const { data: { users: authUsers } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 })

      const emailMap = new Map<string, string>()
      authUsers?.forEach(u => emailMap.set(u.id, u.email || ''))

      // Build company data with user info
      const companyData = (companies || []).map(c => {
        const companyProfiles = (profiles || []).filter(p => p.company_id === c.id)
        const ownerProfile = companyProfiles[0]
        const ownerEmail = ownerProfile ? emailMap.get(ownerProfile.id) || '' : ''

        return {
          ...c,
          total_usuarios: companyProfiles.length,
          owner_email: ownerEmail,
          owner_nome: ownerProfile?.nome_completo || '',
          ultimo_acesso: companyProfiles.reduce((latest, p) => {
            if (!p.ultimo_acesso) return latest
            return !latest || p.ultimo_acesso > latest ? p.ultimo_acesso : latest
          }, null as string | null),
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

      // Enrich with Stripe subscription data if key available
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
                const priceId = sub.items.data[0]?.price?.id || ''
                let planName = 'Desconhecido'
                if (priceId === 'price_1T4q2mBGcvy35NE3xWhv0tBh') planName = 'Mensal'
                else if (priceId === 'price_1T4rJtBGcvy35NE3pvwpmVfP') planName = 'Semestral'
                else if (priceId === 'price_1T4rd3BGcvy35NE3zs2T6e4n') planName = 'Anual'

                company.stripe = {
                  status: sub.status,
                  plan: planName,
                  current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
                  cancel_at_period_end: sub.cancel_at_period_end,
                  trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
                  amount: sub.items.data[0]?.price?.unit_amount || 0,
                  currency: sub.items.data[0]?.price?.currency || 'brl',
                }
              } else {
                // Check if in trial (account created < 14 days ago)
                const createdAt = new Date(company.created_at)
                const now = new Date()
                const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
                company.stripe = {
                  status: daysSinceCreation <= 14 ? 'trialing' : 'expired',
                  plan: null,
                  trial_days_remaining: Math.max(0, 14 - daysSinceCreation),
                }
              }
            } else {
              const createdAt = new Date(company.created_at)
              const now = new Date()
              const daysSinceCreation = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
              company.stripe = {
                status: daysSinceCreation <= 14 ? 'trialing' : 'expired',
                plan: null,
                trial_days_remaining: Math.max(0, 14 - daysSinceCreation),
              }
            }
          } catch (stripeErr) {
            console.error('Stripe error for', company.owner_email, stripeErr)
            company.stripe = { status: 'unknown', plan: null }
          }
        }
      }

      // Override status if admin granted temporary access
      const now = new Date()
      for (const company of companyData) {
        if (company.acesso_liberado_ate) {
          const liberadoAte = new Date(company.acesso_liberado_ate)
          if (liberadoAte > now) {
            const daysRemaining = Math.ceil((liberadoAte.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
            company.stripe = {
              ...(company.stripe || {}),
              status: 'active',
              plan: `Liberado (${daysRemaining}d)`,
              current_period_end: company.acesso_liberado_ate,
            }
          }
        }
      }

      return new Response(JSON.stringify({ companies: companyData }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── BLOCK/UNBLOCK company users ───
    if (action === 'block' || action === 'unblock') {
      const body = await req.json()
      const { company_id } = body
      if (!company_id) {
        return new Response(JSON.stringify({ error: 'company_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const newStatus = action === 'block' ? 'BLOQUEADO' : 'ATIVO'
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({ status: newStatus })
        .eq('company_id', company_id)

      if (updateErr) throw updateErr

      return new Response(JSON.stringify({ success: true, status: newStatus }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── DELETE company and all its users ───
    if (action === 'delete-company') {
      const body = await req.json()
      const { company_id } = body
      if (!company_id) {
        return new Response(JSON.stringify({ error: 'company_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Don't allow deleting own company
      const { data: callerProfile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', callingUser.id)
        .single()

      if (callerProfile?.company_id === company_id) {
        return new Response(JSON.stringify({ error: 'Não é possível excluir sua própria empresa' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Get all users of this company
      const { data: companyUsers } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('company_id', company_id)

      // Delete each user from auth (cascades to profiles, roles, permissions)
      for (const u of (companyUsers || [])) {
        await supabaseAdmin.auth.admin.deleteUser(u.id)
      }

      // Delete company record
      await supabaseAdmin.from('company').delete().eq('id', company_id)

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // ─── GRANT ACCESS: Temporarily unlock a company ───
    if (action === 'grant-access') {
      const body = await req.json()
      const { company_id, days } = body
      if (!company_id) {
        return new Response(JSON.stringify({ error: 'company_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const grantDays = days || 30
      const until = new Date()
      until.setDate(until.getDate() + grantDays)

      const { error: updateErr } = await supabaseAdmin
        .from('company')
        .update({ acesso_liberado_ate: until.toISOString() })
        .eq('id', company_id)

      if (updateErr) throw updateErr

      // Also unblock users if they were blocked
      await supabaseAdmin
        .from('profiles')
        .update({ status: 'ATIVO' })
        .eq('company_id', company_id)

      return new Response(JSON.stringify({ success: true, acesso_liberado_ate: until.toISOString(), days: grantDays }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
