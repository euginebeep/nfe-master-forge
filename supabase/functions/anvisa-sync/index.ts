import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ANVISA_URL = 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares'
const ANVISA_POWERBI_URLS = [
  'https://app.powerbi.com/view?r=eyJrIjoiYjEzNTQ5OGItZTRiYi00NjdlLWIyMTktZjM5ZWNkMGFlOTc5IiwidCI6ImI2N2FmMjNmLWMzZjMtNGQzNS04MGM3LWI3MDg1ZjVlZGQ4MSJ9',
  'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares/lista-de-constituintes-autorizados',
]
// Endpoint nativo Gemini generateContent
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const geminiKey = Deno.env.get('GEMINI_API_KEY')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Create sync record
  const { data: syncRecord, error: syncErr } = await supabase
    .from('anvisa_sync_history')
    .insert({
      tipo: 'scraping',
      status: 'em_andamento',
      fonte_url: ANVISA_URL,
      iniciado_por: user.id,
    })
    .select()
    .single()

  if (syncErr) {
    console.error('Sync record creation error:', syncErr.message)
    return new Response(JSON.stringify({ error: 'Falha ao iniciar sincronização. Tente novamente.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Step 1: Fetch ANVISA main page
    console.log('Fetching ANVISA page:', ANVISA_URL)
    const pageResponse = await fetch(ANVISA_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ERPBot/1.0; regulatory-compliance)' }
    })

    if (!pageResponse.ok) {
      throw new Error(`ANVISA portal retornou status ${pageResponse.status}`)
    }

    const html = await pageResponse.text()

    // Step 2: Fetch Power BI / lista de constituintes pages
    console.log('Fetching ANVISA Power BI and constituintes pages...')
    const powerBiResults: string[] = []
    for (const url of ANVISA_POWERBI_URLS) {
      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ERPBot/1.0; regulatory-compliance)' }
        })
        if (res.ok) {
          const text = await res.text()
          powerBiResults.push(text.substring(0, 10000))
          console.log(`Fetched ${url}: ${text.length} chars`)
        }
      } catch (e) {
        console.warn(`Failed to fetch ${url}:`, e)
      }
    }

    const combinedContent = html + '\n\n---POWERBI---\n\n' + powerBiResults.join('\n\n---PAGE---\n\n')
    const pageHash = await hashContent(combinedContent)

    // Step 3: Check if content changed since last successful sync
    const { data: lastSync } = await supabase
      .from('anvisa_sync_history')
      .select('hash_conteudo')
      .eq('status', 'sucesso')
      .order('finalizado_em', { ascending: false })
      .limit(1)
      .single()

    if (lastSync?.hash_conteudo === pageHash) {
      await supabase.from('anvisa_sync_history').update({
        status: 'sucesso',
        finalizado_em: new Date().toISOString(),
        hash_conteudo: pageHash,
        detalhes: { mensagem: 'Nenhuma alteração detectada no portal ANVISA e Power BI' },
      }).eq('id', syncRecord.id)

      await supabase.from('anvisa_constituintes')
        .update({ verificado_em: new Date().toISOString() })
        .eq('ativo', true)

      return new Response(JSON.stringify({
        success: true,
        status: 'sem_alteracao',
        message: 'Portal ANVISA e Power BI verificados. Nenhuma alteração detectada.',
        sync_id: syncRecord.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 4: Use AI to analyze changes across portal + Power BI
    if (!geminiKey) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const systemPromptSync = `Você é um analista regulatório especializado em ANVISA e suplementos alimentares.
Analise o conteúdo do portal ANVISA e páginas do Power BI de suplementos.
Extraía:
1. Lista de resoluções/INs mencionadas (ex: IN 28/2018, RDC 243/2018, RDC 560/2024)
2. Se há atualizações recentes (últimos 6 meses) em constituintes, doses ou alegações
3. Links para PDFs ou planilhas de listas de constituintes atualizadas
4. Novos constituintes adicionados ou removidos da lista
5. Alterações em doses máximas permitidas
6. Mudanças em alegações de saúde permitidas
7. Dados do Power BI: novos registros de suplementos, tendências, alertas sanitários

Responda em JSON:
{
  "resolucoes": ["IN 28/2018", ...],
  "atualizacoes_recentes": [{"titulo": "...", "data": "...", "url": "...", "tipo": "constituinte|dose|alegacao|alerta"}],
  "novos_constituintes": [{"nome": "...", "categoria": "...", "dose_maxima": "...", "norma": "..."}],
  "constituintes_removidos": ["..."],
  "alteracoes_doses": [{"substancia": "...", "dose_anterior": "...", "dose_nova": "...", "norma": "..."}],
  "alertas_sanitarios": [{"titulo": "...", "descricao": "...", "data": "..."}],
  "links_pdf_constituintes": ["url1", ...],
  "mudanca_detectada": true,
  "resumo": "texto resumo"
}`

    const userTextSync = `Analise estas páginas da ANVISA:\n\n--- PORTAL PRINCIPAL ---\n${html.substring(0, 12000)}\n\n--- POWER BI / LISTAS ---\n${powerBiResults.map(r => r.substring(0, 5000)).join('\n---\n')}`

    // Chamada ao endpoint nativo Gemini generateContent
    const geminiUrl = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${geminiKey}`
    const aiResponse = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPromptSync }] },
        contents: [{ role: 'user', parts: [{ text: userTextSync }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
          maxOutputTokens: 8192,
        },
      }),
    })

    const aiData = await aiResponse.json()
    const aiContent: string = aiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

    let analise: Record<string, unknown> = {}
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) analise = JSON.parse(jsonMatch[0])
    } catch {
      analise = { resumo: aiContent, mudanca_detectada: false }
    }

    const mudancaDetectada = analise.mudanca_detectada === true
    const novosConstituintes = (analise.novos_constituintes as Array<Record<string, string>>) || []
    const alertasSanitarios = (analise.alertas_sanitarios as Array<Record<string, string>>) || []

    // Step 5: Auto-insert new constituintes if detected
    let registrosNovos = 0
    if (novosConstituintes.length > 0) {
      for (const nc of novosConstituintes) {
        const { error } = await supabase.from('anvisa_constituintes').insert({
          nome_tecnico: nc.nome || 'Novo constituinte',
          categoria: nc.categoria || 'VITAMINA_MINERAL',
          anexo_origem: 'ANEXO_I',
          norma_inclusao: nc.norma || 'Detectado via sync',
          ativo: true,
          sync_id: syncRecord.id,
          fonte_url: ANVISA_URL,
          verificado_em: new Date().toISOString(),
        })
        if (!error) registrosNovos++
      }
    }

    // Step 6: Update sync record
    await supabase.from('anvisa_sync_history').update({
      status: mudancaDetectada ? 'alerta' : 'sucesso',
      finalizado_em: new Date().toISOString(),
      hash_conteudo: pageHash,
      registros_novos: registrosNovos,
      versao_legislacao: (analise.resolucoes as string[] || []).join(', '),
      detalhes: {
        ...analise,
        fontes_verificadas: ['portal_anvisa', 'powerbi_constituintes', 'lista_constituintes'],
        alertas_sanitarios: alertasSanitarios,
      },
    }).eq('id', syncRecord.id)

    await supabase.from('anvisa_constituintes')
      .update({ verificado_em: new Date().toISOString(), sync_id: syncRecord.id })
      .eq('ativo', true)

    return new Response(JSON.stringify({
      success: true,
      status: mudancaDetectada ? 'alerta_mudanca' : 'verificado',
      message: mudancaDetectada
        ? '⚠ ATENÇÃO: Possível alteração na legislação detectada. Revise manualmente os dados.'
        : 'Portal ANVISA e Power BI verificados com sucesso.',
      analise,
      registros_novos: registrosNovos,
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
      error: 'Erro durante a sincronização com o portal ANVISA. Tente novamente.',
    }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
