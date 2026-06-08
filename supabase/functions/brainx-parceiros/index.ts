import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || (req.method === 'POST' ? 'registrar-clique' : 'get-ativo')
    const company_id = req.headers.get('x-company-id') || url.searchParams.get('company_id')
    const posicao = req.headers.get('x-posicao') || url.searchParams.get('posicao') || 'DASHBOARD_LATERAL'

    // ─── ACTION: get-ativo ───
    if (action === 'get-ativo') {
      if (company_id) {
        // Verificar Opt-out
        const { data: optout } = await supabaseAdmin
          .from('brainx_optout')
          .select('company_id')
          .eq('company_id', company_id)
          .maybeSingle()
        
        if (optout) {
          return new Response(JSON.stringify({ campanha: null, optout: true }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          })
        }
      }

      const hoje = new Date().toISOString().slice(0, 10)

      // Buscar campanhas ativas e aprovadas para esta posição
      const { data: campanhas, error } = await supabaseAdmin
        .from('brainx_campanhas')
        .select(`
          *,
          criativo:brainx_criativos(*),
          parceiro:brainx_parceiros(nome, segmento)
        `)
        .eq('ativo', true)
        .eq('aprovado', true)
        .eq('posicao', posicao)
        .lte('data_inicio', hoje)
        .or(`data_fim.is.null,data_fim.gte.${hoje}`)

      if (error) throw error

      if (!campanhas || campanhas.length === 0) {
        return new Response(JSON.stringify({ campanha: null }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Filtrar por excluir_tenants no cliente JS da function
      const disponiveis = campanhas.filter(c => {
        if (c.excluir_tenants && company_id && c.excluir_tenants.includes(company_id)) return false
        return true
      })

      if (disponiveis.length === 0) {
        return new Response(JSON.stringify({ campanha: null }), { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Rotação simples: sortear aleatoriamente entre as disponíveis
      const campanha = disponiveis[Math.floor(Math.random() * disponiveis.length)]

      // Registrar impressão (fire-and-forget)
      if (company_id) {
        supabaseAdmin.rpc('increment_impressoes', { campanha_uuid: campanha.id }).then(() => {
           supabaseAdmin.from('brainx_metricas').insert({
            campanha_id: campanha.id,
            company_id,
            tipo: 'IMPRESSAO',
          })
        })
      }

      return new Response(JSON.stringify({ campanha }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ─── ACTION: registrar-clique ───
    if (action === 'registrar-clique') {
      const { campanha_id, company_id: cid } = await req.json()
      
      await supabaseAdmin.rpc('increment_cliques', { campanha_uuid: campanha_id })
      
      if (cid) {
        await supabaseAdmin.from('brainx_metricas').insert({
          campanha_id,
          company_id: cid,
          tipo: 'CLIQUE',
        })
      }

      return new Response(JSON.stringify({ success: true }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // ─── ACTION: list-admin ───
    if (action === 'list-admin') {
      const { data: campanhas, error } = await supabaseAdmin
        .from('brainx_campanhas')
        .select(`
          *,
          parceiro:brainx_parceiros(nome, segmento),
          criativo:brainx_criativos(titulo, tipo, arquivo_url)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      return new Response(JSON.stringify({ campanhas }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
