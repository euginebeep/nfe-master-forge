import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const ANVISA_URL = 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares'
const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }

  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }
  })
  const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(authHeader.replace('Bearer ', ''))
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
  const userId = claimsData.claims.sub as string

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Create sync record
  const { data: syncRecord, error: syncErr } = await supabase
    .from('anvisa_sync_history')
    .insert({
      tipo: 'scraping',
      status: 'em_andamento',
      fonte_url: ANVISA_URL,
      iniciado_por: userId,
    })
    .select()
    .single()

  if (syncErr) {
    return new Response(JSON.stringify({ error: 'Falha ao criar registro de sync', details: syncErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    // Step 1: Fetch ANVISA page
    console.log('Fetching ANVISA page:', ANVISA_URL)
    const pageResponse = await fetch(ANVISA_URL, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ERPBot/1.0; regulatory-compliance)' }
    })

    if (!pageResponse.ok) {
      throw new Error(`ANVISA portal retornou status ${pageResponse.status}`)
    }

    const html = await pageResponse.text()
    const pageHash = await hashContent(html)

    // Step 2: Check if content changed since last successful sync
    const { data: lastSync } = await supabase
      .from('anvisa_sync_history')
      .select('hash_conteudo')
      .eq('status', 'sucesso')
      .order('finalizado_em', { ascending: false })
      .limit(1)
      .single()

    if (lastSync?.hash_conteudo === pageHash) {
      // No changes detected
      await supabase.from('anvisa_sync_history').update({
        status: 'sucesso',
        finalizado_em: new Date().toISOString(),
        hash_conteudo: pageHash,
        detalhes: { mensagem: 'Nenhuma alteração detectada no portal ANVISA' },
      }).eq('id', syncRecord.id)

      // Update verificado_em on all constituintes
      await supabase.from('anvisa_constituintes')
        .update({ verificado_em: new Date().toISOString() })
        .eq('ativo', true)

      return new Response(JSON.stringify({
        success: true,
        status: 'sem_alteracao',
        message: 'Portal ANVISA verificado. Nenhuma alteração detectada.',
        sync_id: syncRecord.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    // Step 3: Use AI to analyze if there are new resolutions
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured')
    }

    const aiResponse = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'system',
          content: `Você é um analista regulatório. Analise o HTML de uma página da ANVISA sobre suplementos alimentares.
Extraia:
1. Lista de resoluções/INs mencionadas (ex: IN 28/2018, RDC 243/2018, RDC 560/2024)
2. Se há menção a atualizações recentes (últimos 6 meses)
3. Links para PDFs de listas de constituintes atualizadas
4. Qualquer indicação de mudança na legislação vigente

Responda em JSON com a estrutura:
{
  "resolucoes": ["IN 28/2018", ...],
  "atualizacoes_recentes": [{"titulo": "...", "data": "...", "url": "..."}],
  "links_pdf_constituintes": ["url1", ...],
  "mudanca_detectada": true/false,
  "resumo": "texto resumo"
}`
        }, {
          role: 'user',
          content: `Analise esta página da ANVISA (primeiros 15000 caracteres):\n\n${html.substring(0, 15000)}`
        }],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    })

    const aiData = await aiResponse.json()
    const aiContent = aiData.choices?.[0]?.message?.content || '{}'

    // Parse AI response
    let analise: Record<string, unknown> = {}
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) analise = JSON.parse(jsonMatch[0])
    } catch {
      analise = { resumo: aiContent, mudanca_detectada: false }
    }

    const mudancaDetectada = analise.mudanca_detectada === true

    // Step 4: Update sync record
    await supabase.from('anvisa_sync_history').update({
      status: mudancaDetectada ? 'alerta' : 'sucesso',
      finalizado_em: new Date().toISOString(),
      hash_conteudo: pageHash,
      versao_legislacao: (analise.resolucoes as string[] || []).join(', '),
      detalhes: analise,
    }).eq('id', syncRecord.id)

    // Update verificado_em on all constituintes
    await supabase.from('anvisa_constituintes')
      .update({ verificado_em: new Date().toISOString(), sync_id: syncRecord.id })
      .eq('ativo', true)

    return new Response(JSON.stringify({
      success: true,
      status: mudancaDetectada ? 'alerta_mudanca' : 'verificado',
      message: mudancaDetectada
        ? '⚠ ATENÇÃO: Possível alteração na legislação detectada. Revise manualmente os dados.'
        : 'Portal ANVISA verificado com sucesso. Base de dados atualizada.',
      analise,
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

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}
