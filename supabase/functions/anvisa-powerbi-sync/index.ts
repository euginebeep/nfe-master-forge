import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ANVISA_POWERBI_URL = 'https://app.powerbi.com/view?r=eyJrIjoiYjEzNTQ5OGItZTRiYi00NjdlLWIyMTktZjM5ZWNkMGFlOTc5IiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9'
const ANVISA_CONSTITUINTES_URL = 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares/lista-de-constituintes-autorizados'
const ANVISA_PORTAL_URL = 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares'
const FIRECRAWL_API = 'https://api.firecrawl.dev/v1'
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'

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

  // Parse optional body for specific substance lookup
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
      fonte_url: ANVISA_POWERBI_URL,
      iniciado_por: user.id,
    })
    .select().single()

  if (syncErr) {
    return new Response(JSON.stringify({ error: 'Falha ao criar registro de sync', details: syncErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Step 1: Scrape ANVISA pages with Firecrawl
    console.log('Scraping ANVISA pages via Firecrawl...')

    const scrapeResults: { url: string; content: string }[] = []
    const urlsToScrape = [ANVISA_PORTAL_URL, ANVISA_CONSTITUINTES_URL]

    for (const url of urlsToScrape) {
      try {
        console.log(`Scraping: ${url}`)
        const res = await fetch(`${FIRECRAWL_API}/scrape`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${firecrawlKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url,
            formats: ['markdown'],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        })

        const data = await res.json()
        const markdown = data?.data?.markdown || data?.markdown || ''
        if (markdown) {
          scrapeResults.push({ url, content: markdown.substring(0, 15000) })
          console.log(`Scraped ${url}: ${markdown.length} chars`)
        }
      } catch (e) {
        console.warn(`Failed to scrape ${url}:`, e)
      }
    }

    // Step 2: Try scraping Power BI (may be limited due to JS rendering)
    try {
      console.log('Scraping Power BI dashboard...')
      const pbiRes = await fetch(`${FIRECRAWL_API}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${firecrawlKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: ANVISA_POWERBI_URL,
          formats: ['markdown'],
          waitFor: 5000,
        }),
      })

      const pbiData = await pbiRes.json()
      const pbiMarkdown = pbiData?.data?.markdown || pbiData?.markdown || ''
      if (pbiMarkdown) {
        scrapeResults.push({ url: ANVISA_POWERBI_URL, content: pbiMarkdown.substring(0, 15000) })
        console.log(`Scraped Power BI: ${pbiMarkdown.length} chars`)
      }
    } catch (e) {
      console.warn('Failed to scrape Power BI:', e)
    }

    if (scrapeResults.length === 0) {
      throw new Error('Nenhuma página ANVISA pôde ser acessada')
    }

    // Step 3: Fetch current DB state for the queried substance
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

    // Step 4: Use AI to analyze scraped content
    const combinedContent = scrapeResults
      .map(r => `--- FONTE: ${r.url} ---\n${r.content}`)
      .join('\n\n')

    const searchContext = substanciaBusca
      ? `FOCO DA ANÁLISE: "${substanciaBusca}" — Verifique especificamente o status regulatório desta substância.`
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
Analise o conteúdo scrapeado do portal ANVISA e Power BI.

${searchContext}
${dbContext}

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
          content: combinedContent,
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

    // Step 5: Update database based on AI analysis
    const substancias = (analise.substancias_analisadas as Array<Record<string, string>>) || []
    let atualizados = 0

    for (const sub of substancias) {
      if (!sub.nome || sub.status === 'NAO_ENCONTRADA') continue

      const isProibido = ['PROIBIDA', 'REMOVIDA'].includes(sub.status)
      const isRestrito = sub.status === 'RESTRITA'
      const isAtivo = sub.status === 'AUTORIZADA'

      // Find matching records in DB
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

    // Step 6: Update sync record
    await supabase.from('anvisa_sync_history').update({
      status: 'sucesso',
      finalizado_em: new Date().toISOString(),
      registros_atualizados: atualizados,
      detalhes: {
        ...analise,
        fontes_scrapeadas: scrapeResults.map(r => r.url),
        substancia_consultada: substanciaBusca,
      },
    }).eq('id', syncRecord.id)

    return new Response(JSON.stringify({
      success: true,
      analise,
      registros_atualizados: atualizados,
      sync_id: syncRecord.id,
      fontes: scrapeResults.map(r => r.url),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Power BI sync error:', errorMsg)

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
