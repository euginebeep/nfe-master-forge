import { createClient } from 'npm:@supabase/supabase-js@2'

// A funcao le x-company-id e x-posicao dos headers, mas nao os declarava aqui.
// O navegador bloqueava no preflight: "Request header field x-company-id is not
// allowed by Access-Control-Allow-Headers". 12 erros por carga do dashboard.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-company-id, x-posicao, action, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || req.headers.get('action') || (req.method === 'POST' ? 'registrar-clique' : 'get-ativo')
    const company_id = req.headers.get('x-company-id') || url.searchParams.get('company_id')
    const posicao = req.headers.get('x-posicao') || url.searchParams.get('posicao') || 'DASHBOARD_LATERAL'

    if (action === 'get-ativo') {
      if (company_id) {
        const { data: optout } = await supabaseAdmin
          .from('brainx_optout').select('company_id')
          .eq('company_id', company_id).maybeSingle()
        if (optout) return json({ campanha: null, optout: true })
      }

      const hoje = new Date().toISOString().slice(0, 10)

      const { data: campanhas, error } = await supabaseAdmin
        .from('brainx_campanhas')
        .select(`*, criativo:brainx_criativos(*), parceiro:brainx_parceiros(nome, segmento)`)
        .eq('ativo', true).eq('aprovado', true).eq('posicao', posicao)
        .lte('data_inicio', hoje)
        .or(`data_fim.is.null,data_fim.gte.${hoje}`)

      if (error) throw error
      if (!campanhas || campanhas.length === 0) return json({ campanha: null })

      const disponiveis = campanhas.filter(c =>
        !(c.excluir_tenants && company_id && c.excluir_tenants.includes(company_id)))
      if (disponiveis.length === 0) return json({ campanha: null })

      const campanha = disponiveis[Math.floor(Math.random() * disponiveis.length)]

      if (company_id) {
        supabaseAdmin.rpc('increment_impressoes', { campanha_uuid: campanha.id })
          .then(() => supabaseAdmin.from('brainx_metricas')
            .insert({ campanha_id: campanha.id, company_id, tipo: 'IMPRESSAO' }))
          .catch((e: any) => console.error('metrica impressao:', e?.message))
      }

      return json({ campanha })
    }

    if (action === 'registrar-clique') {
      const { campanha_id, company_id: cid } = await req.json()
      await supabaseAdmin.rpc('increment_cliques', { campanha_uuid: campanha_id })
      if (cid) {
        await supabaseAdmin.from('brainx_metricas')
          .insert({ campanha_id, company_id: cid, tipo: 'CLIQUE' })
      }
      return json({ success: true })
    }

    if (action === 'list-admin') {
      const { data: campanhas, error } = await supabaseAdmin
        .from('brainx_campanhas')
        .select(`*, parceiro:brainx_parceiros(nome, segmento), criativo:brainx_criativos(titulo, tipo, arquivo_url)`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return json({ campanhas })
    }

    return json({ error: 'Unknown action' }, 400)
  } catch (error: any) {
    console.error('[brainx-parceiros]', error?.message, error?.stack)
    return json({ error: error?.message || 'Internal server error' }, 500)
  }
})