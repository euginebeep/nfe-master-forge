import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const FIRECRAWL_API = 'https://api.firecrawl.dev/v1'
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'

async function searchAnvisa(firecrawlKey: string, query: string): Promise<string> {
  const results: string[] = []

  // Search 1: Direct ANVISA search for the substance
  try {
    const res = await fetch(`${FIRECRAWL_API}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `site:gov.br/anvisa "${query}" suplemento alimentar constituinte autorizado IN 28/2018`,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    })
    const data = await res.json()
    if (data?.data?.length) {
      for (const r of data.data) {
        if (r.markdown) results.push(`[ANVISA] ${r.url}\n${r.markdown.substring(0, 5000)}`)
        else if (r.description) results.push(`[ANVISA] ${r.url}: ${r.description}`)
      }
    }
  } catch (e) {
    console.warn('ANVISA search failed:', e)
  }

  // Search 2: Broader regulatory search
  try {
    const res = await fetch(`${FIRECRAWL_API}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `ANVISA "${query}" autorizado proibido suplemento alimentar 2025 2026`,
        limit: 5,
        scrapeOptions: { formats: ['markdown'] },
      }),
    })
    const data = await res.json()
    if (data?.data?.length) {
      for (const r of data.data) {
        if (r.markdown) results.push(`[WEB] ${r.url}\n${r.markdown.substring(0, 5000)}`)
        else if (r.description) results.push(`[WEB] ${r.url}: ${r.description}`)
      }
    }
  } catch (e) {
    console.warn('Broad search failed:', e)
  }

  // Search 3: Power BI specific search (cached results from indexers)
  try {
    const res = await fetch(`${FIRECRAWL_API}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${firecrawlKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `ANVISA power bi constituintes autorizados suplementos alimentares "${query}" IN 28`,
        limit: 3,
      }),
    })
    const data = await res.json()
    if (data?.data?.length) {
      for (const r of data.data) {
        results.push(`[PBI-INDEX] ${r.url}: ${r.title || ''} ${r.description || ''}`)
      }
    }
  } catch (e) {
    console.warn('PBI index search failed:', e)
  }

  return results.join('\n\n---\n\n')
}

async function scrapeAnvisaPortal(firecrawlKey: string): Promise<string> {
  const urls = [
    'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares',
  ]
  const results: string[] = []

  for (const url of urls) {
    try {
      const res = await fetch(`${FIRECRAWL_API}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url, formats: ['markdown'], onlyMainContent: true, waitFor: 3000 }),
      })
      const data = await res.json()
      const md = data?.data?.markdown || data?.markdown || ''
      if (md) {
        results.push(`--- PORTAL ANVISA ---\n${md.substring(0, 12000)}`)
        console.log(`Scraped portal: ${md.length} chars`)
      }
    } catch (e) {
      console.warn(`Failed to scrape ${url}:`, e)
    }
  }

  return results.join('\n\n')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const firecrawlKey = Deno.env.get('FIRECRAWL_API_KEY')
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')

  if (!firecrawlKey) {
    return new Response(JSON.stringify({ error: 'FIRECRAWL_API_KEY não configurada' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  if (!lovableKey) {
    return new Response(JSON.stringify({ error: 'LOVABLE_API_KEY não configurada' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // Auth check
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Parse body
  let substanciaBusca: string | null = null
  try {
    const body = await req.json()
    substanciaBusca = body?.substancia || null
  } catch { /* no body */ }

  // Create sync record
  const { data: syncRecord, error: syncErr } = await supabase
    .from('anvisa_sync_history')
    .insert({
      tipo: 'powerbi_firecrawl',
      status: 'em_andamento',
      fonte_url: 'firecrawl-search',
      iniciado_por: user.id,
    })
    .select().single()

  if (syncErr) {
    return new Response(JSON.stringify({ error: 'Falha ao criar registro de sync', details: syncErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Step 1: Search ANVISA data using Firecrawl Search (instead of broken Power BI scrape)
    const searchQuery = substanciaBusca || 'constituintes autorizados suplementos alimentares atualização'
    console.log(`Searching ANVISA data for: ${searchQuery}`)

    const [searchContent, portalContent] = await Promise.all([
      searchAnvisa(firecrawlKey, searchQuery),
      scrapeAnvisaPortal(firecrawlKey),
    ])

    const combinedContent = [searchContent, portalContent].filter(Boolean).join('\n\n===\n\n')

    if (!combinedContent || combinedContent.length < 50) {
      throw new Error('Nenhuma informação ANVISA pôde ser obtida via busca web')
    }

    console.log(`Total content gathered: ${combinedContent.length} chars`)

    // Step 2: Fetch current DB state
    let dbContext = ''
    if (substanciaBusca) {
      const { data: existingData } = await supabase
        .from('anvisa_constituintes')
        .select('nome_tecnico, nome_generico, ativo, is_proibido, categoria, norma_inclusao, motivo_proibicao')
        .or(`nome_tecnico.ilike.%${substanciaBusca}%,nome_generico.ilike.%${substanciaBusca}%`)
        .limit(5)

      if (existingData?.length) {
        dbContext = `\n\nDADOS ATUAIS NO BANCO:\n${JSON.stringify(existingData, null, 2)}`
      }
    }

    // Step 3: AI analysis
    const searchContext = substanciaBusca
      ? `FOCO DA ANÁLISE: "${substanciaBusca}" — Verifique especificamente o status regulatório desta substância no contexto da ANVISA e IN 28/2018.`
      : 'Faça uma análise geral de todas as substâncias e mudanças recentes.'

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'system',
          content: `Você é um analista regulatório especializado em ANVISA e suplementos alimentares.
Analise o conteúdo das buscas web sobre o portal ANVISA e a IN 28/2018.

${searchContext}
${dbContext}

IMPORTANTE: O Power BI da ANVISA contém a lista oficial de constituintes autorizados da IN 28/2018.
Se a substância NÃO aparece nas buscas como autorizada, marque como NAO_ENCONTRADA.
Se há evidência de que foi PROIBIDA ou REMOVIDA, marque adequadamente.

Sua tarefa:
1. Identificar quais substâncias estão AUTORIZADAS e quais foram REMOVIDAS/PROIBIDAS
2. Verificar doses máximas e alterações recentes
3. Detectar alertas sanitários e mudanças na legislação
4. Se uma substância específica foi consultada, dizer claramente se ela ESTÁ ou NÃO ESTÁ autorizada

Responda em JSON:
{
  "substancias_analisadas": [{
    "nome": "...",
    "status": "AUTORIZADA" | "PROIBIDA" | "REMOVIDA" | "RESTRITA" | "NAO_ENCONTRADA",
    "motivo": "...",
    "norma_referencia": "...",
    "dose_maxima": "...",
    "observacoes": "..."
  }],
  "alertas_recentes": [{"titulo": "...", "descricao": "...", "data": "..."}],
  "mudancas_legislacao": [{"descricao": "...", "norma": "...", "data": "..."}],
  "resumo_geral": "...",
  "confianca_dados": "ALTA" | "MEDIA" | "BAIXA",
  "fontes_consultadas": ["..."]
}`
        }, {
          role: 'user',
          content: combinedContent.substring(0, 30000),
        }],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    })

    const aiData = await aiResponse.json()
    const aiContent = aiData.choices?.[0]?.message?.content || '{}'

    let analise: Record<string, unknown> = {}
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) analise = JSON.parse(jsonMatch[0])
    } catch {
      analise = { resumo_geral: aiContent, confianca_dados: 'BAIXA' }
    }

    // Step 4: Update database based on AI analysis
    const substancias = (analise.substancias_analisadas as Array<Record<string, string>>) || []
    let atualizados = 0

    for (const sub of substancias) {
      if (!sub.nome || sub.status === 'NAO_ENCONTRADA') continue

      const isProibido = ['PROIBIDA', 'REMOVIDA'].includes(sub.status)
      const isRestrito = sub.status === 'RESTRITA'
      const isAtivo = sub.status === 'AUTORIZADA'

      const { data: matches } = await supabase
        .from('anvisa_constituintes')
        .select('id, nome_tecnico, ativo, is_proibido')
        .or(`nome_tecnico.ilike.%${sub.nome}%,nome_generico.ilike.%${sub.nome}%`)
        .limit(5)

      for (const match of (matches || [])) {
        const needsUpdate =
          (isProibido && (!match.is_proibido || match.ativo)) ||
          (isAtivo && (match.is_proibido || !match.ativo)) ||
          isRestrito

        if (needsUpdate) {
          await supabase.from('anvisa_constituintes').update({
            ativo: isAtivo || isRestrito,
            is_proibido: isProibido,
            motivo_proibicao: isProibido ? sub.motivo || sub.observacoes : null,
            norma_ultima_alteracao: sub.norma_referencia || null,
            restricoes_uso: isRestrito ? sub.observacoes : null,
            verificado_em: new Date().toISOString(),
            sync_id: syncRecord.id,
          }).eq('id', match.id)

          atualizados++
        }
      }
    }

    // Step 5: Update sync record
    await supabase.from('anvisa_sync_history').update({
      status: 'sucesso',
      finalizado_em: new Date().toISOString(),
      registros_atualizados: atualizados,
      detalhes: {
        ...analise,
        metodo: 'firecrawl-search',
        substancia_consultada: substanciaBusca,
      },
    }).eq('id', syncRecord.id)

    return new Response(JSON.stringify({
      success: true,
      analise,
      registros_atualizados: atualizados,
      sync_id: syncRecord.id,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Sync error:', errorMsg)

    await supabase.from('anvisa_sync_history').update({
      status: 'erro',
      finalizado_em: new Date().toISOString(),
      erro_mensagem: errorMsg,
    }).eq('id', syncRecord.id)

    return new Response(JSON.stringify({
      success: false,
      error: errorMsg,
      sync_id: syncRecord.id,
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
