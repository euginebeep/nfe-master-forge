import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const TOP_CONTEXT_ITEMS = 8

const STOPWORDS = new Set([
  'a', 'ao', 'aos', 'as', 'com', 'como', 'da', 'das', 'de', 'do', 'dos', 'e', 'em', 'eu',
  'la', 'me', 'mesmo', 'minha', 'meu', 'na', 'nas', 'no', 'nos', 'o', 'os', 'ou', 'para',
  'por', 'que', 'se', 'ser', 'sua', 'seu', 'um', 'uma', 'é', 'nao', 'não', 'sim', 'the',
])

type ManualPerguntaRow = {
  id: string
  pergunta: string
  resposta: string
  tags: string[] | null
  modulo: string | null
}

type ChatMessage = { role: string; content: string }

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .split(/[^a-z0-9]+/u)
    .filter((term) => term.length >= 2 && !STOPWORDS.has(term))
}

function scoreRelevance(userQuestion: string, item: ManualPerguntaRow): number {
  const userTerms = tokenize(userQuestion)
  if (userTerms.length === 0) return 0

  const perguntaLower = item.pergunta.toLowerCase()
  const respostaLower = item.resposta.toLowerCase()
  const tagsLower = (item.tags ?? []).join(' ').toLowerCase()
  const moduloLower = (item.modulo ?? '').toLowerCase()

  let score = 0
  for (const term of userTerms) {
    const weight = term.length >= 5 ? 3 : 2
    if (perguntaLower.includes(term)) score += weight + 2
    if (respostaLower.includes(term)) score += weight
    if (tagsLower.includes(term)) score += weight + 1
    if (moduloLower.includes(term)) score += 1
  }
  return score
}

function pickRelevantPerguntas(
  perguntas: ManualPerguntaRow[],
  userQuestion: string,
  topN = TOP_CONTEXT_ITEMS
): ManualPerguntaRow[] {
  if (!perguntas.length) return []

  const scored = perguntas
    .map((item) => ({ item, score: scoreRelevance(userQuestion, item) }))
    .sort((a, b) => b.score - a.score)

  const withHits = scored.filter((entry) => entry.score > 0).map((entry) => entry.item)
  if (withHits.length > 0) {
    const selected = withHits.slice(0, topN)
    if (selected.length < topN) {
      const selectedIds = new Set(selected.map((item) => item.id))
      for (const { item } of scored) {
        if (selected.length >= topN) break
        if (!selectedIds.has(item.id)) {
          selected.push(item)
          selectedIds.add(item.id)
        }
      }
    }
    return selected
  }

  // Match fraco: ainda envia os trechos com maior pontuação (mesmo score 0, preserva ordem do manual)
  return scored.slice(0, topN).map((entry) => entry.item)
}

function buildManualContext(items: ManualPerguntaRow[]): string {
  if (!items.length) {
    return '(Nenhum trecho do manual foi encontrado no banco de dados.)'
  }

  return items
    .map(
      (item, index) =>
        `### Trecho ${index + 1}\nPergunta: ${item.pergunta}\nResposta: ${item.resposta}`
    )
    .join('\n\n')
}

function buildSystemPrompt(manualContext: string, secaoContexto?: string | null): string {
  return `Você é o assistente do BrainX ERP. Responda a pergunta do usuário USANDO SOMENTE as informações do CONTEXTO abaixo, que é o manual oficial do sistema.

REGRAS OBRIGATÓRIAS:
1. NÃO invente telas, botões, menus ou caminhos que não estejam no CONTEXTO.
2. Use sempre os nomes exatos de telas e botões como aparecem no CONTEXTO.
3. Se a resposta não estiver no CONTEXTO, diga claramente que essa informação ainda não está no manual e sugira procurar em Manual & FAQ ou abrir um ticket de suporte.
4. Responda em português do Brasil, com tom profissional e acessível. Máximo 3 parágrafos.
5. Para passos sequenciais, use: 1) ... 2) ... 3)...
${secaoContexto ? `\nO usuário estava na seção: "${secaoContexto}"` : ''}

--- CONTEXTO DO MANUAL OFICIAL ---
${manualContext}
--- FIM DO CONTEXTO ---`
}

async function fetchManualPerguntas(
  supabaseAdmin: ReturnType<typeof createClient>
): Promise<ManualPerguntaRow[]> {
  const { data, error } = await supabaseAdmin
    .from('manual_perguntas')
    .select('id, pergunta, resposta, tags, modulo')
    .eq('ativo', true)
    .order('ordem', { ascending: true })

  if (error) {
    console.error('[manual-ia] erro ao buscar manual_perguntas:', error)
    throw error
  }

  return (data ?? []) as ManualPerguntaRow[]
}

async function callGemini(
  geminiKey: string,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<{ text: string; tokens: number }> {
  const geminiContents = messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))

  const res = await fetch(`${GEMINI_BASE}?key=${geminiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: geminiContents,
      generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
    }),
  })

  const raw = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw)
  } catch {
    console.error('[manual-ia] Gemini resposta não-JSON:', res.status, raw)
    throw new Error(`Gemini retornou resposta inválida (HTTP ${res.status})`)
  }

  if (!res.ok) {
    console.error('[manual-ia] Gemini HTTP error:', res.status, data)
    const message =
      (data?.error as { message?: string } | undefined)?.message ||
      `HTTP ${res.status}`
    throw new Error(`Gemini: ${message}`)
  }

  if (data.error) {
    console.error('[manual-ia] Gemini API error:', data.error)
    const message =
      (data.error as { message?: string }).message || JSON.stringify(data.error)
    throw new Error(`Gemini: ${message}`)
  }

  const text =
    (data?.candidates as Array<{ content?: { parts?: Array<{ text?: string }> } }> | undefined)?.[0]
      ?.content?.parts?.[0]?.text || ''

  if (!text.trim()) {
    console.error('[manual-ia] Gemini resposta vazia:', data)
    throw new Error('Gemini retornou resposta vazia')
  }

  const tokens =
    (data?.usageMetadata as { totalTokenCount?: number } | undefined)?.totalTokenCount || 0

  return { text: text.trim(), tokens }
}

async function callAnthropic(
  anthropicKey: string,
  systemPrompt: string,
  messages: ChatMessage[]
): Promise<{ text: string; tokens: number }> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-3-5-sonnet-20240620',
      max_tokens: 1000,
      temperature: 0.3,
      system: systemPrompt,
      messages,
    }),
  })

  const raw = await res.text()
  let data: Record<string, unknown>
  try {
    data = JSON.parse(raw)
  } catch {
    console.error('[manual-ia] Claude resposta não-JSON:', res.status, raw)
    throw new Error(`Claude retornou resposta inválida (HTTP ${res.status})`)
  }

  if (!res.ok) {
    console.error('[manual-ia] Claude HTTP error:', res.status, data)
    const message =
      (data?.error as { message?: string } | undefined)?.message ||
      `HTTP ${res.status}`
    throw new Error(`Claude: ${message}`)
  }

  const text =
    (data?.content as Array<{ text?: string }> | undefined)?.[0]?.text || ''

  if (!text.trim()) {
    console.error('[manual-ia] Claude resposta vazia:', data)
    throw new Error('Claude retornou resposta vazia')
  }

  const usage = data?.usage as { input_tokens?: number; output_tokens?: number } | undefined
  const tokens = (usage?.input_tokens || 0) + (usage?.output_tokens || 0)

  return { text: text.trim(), tokens }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch (err) {
    console.error('[manual-ia] JSON inválido:', err)
    return new Response(JSON.stringify({ error: 'Corpo da requisição inválido' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const pergunta = typeof body.pergunta === 'string' ? body.pergunta.trim() : ''
  const secao_contexto =
    typeof body.secao_contexto === 'string' ? body.secao_contexto : null
  const historico_chat = Array.isArray(body.historico_chat) ? body.historico_chat : []

  if (!pergunta) {
    return new Response(JSON.stringify({ error: 'Pergunta não informada' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startMs = Date.now()
  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  let userId: string | null = null
  let companyId: string | null = null
  const authHeader = req.headers.get('Authorization') || ''
  if (authHeader.startsWith('Bearer ')) {
    try {
      const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: { user } } = await supabaseAuth.auth.getUser()
      if (user) {
        userId = user.id
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single()
        companyId = profile?.company_id || null
      }
    } catch (err) {
      console.warn('[manual-ia] não foi possível identificar usuário:', err)
    }
  }

  let manualPerguntas: ManualPerguntaRow[] = []
  try {
    manualPerguntas = await fetchManualPerguntas(supabaseAdmin)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[manual-ia] falha ao carregar manual do banco:', err)
    return new Response(
      JSON.stringify({
        resposta:
          `Não consegui carregar o manual oficial (${message}). Tente novamente ou consulte Manual & FAQ.`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const relevantes = pickRelevantPerguntas(manualPerguntas, pergunta, TOP_CONTEXT_ITEMS)
  const manualContext = buildManualContext(relevantes)
  const systemPrompt = buildSystemPrompt(manualContext, secao_contexto)

  console.log(
    `[manual-ia] contexto: ${relevantes.length}/${manualPerguntas.length} trechos | pergunta="${pergunta.slice(0, 80)}"`
  )

  const messages: ChatMessage[] = [
    ...historico_chat
      .slice(-6)
      .filter(
        (item): item is ChatMessage =>
          !!item &&
          typeof item === 'object' &&
          typeof (item as ChatMessage).role === 'string' &&
          typeof (item as ChatMessage).content === 'string'
      ),
    { role: 'user', content: pergunta },
  ]

  let resposta = ''
  let tokensUsados = 0
  const erros: string[] = []

  if (geminiKey) {
    try {
      const result = await callGemini(geminiKey, systemPrompt, messages)
      resposta = result.text
      tokensUsados = result.tokens
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      erros.push(message)
      console.error('[manual-ia] Gemini falhou:', err)
    }
  } else {
    erros.push('GEMINI_API_KEY não configurada')
    console.error('[manual-ia] GEMINI_API_KEY ausente')
  }

  if (!resposta && anthropicKey) {
    try {
      const result = await callAnthropic(anthropicKey, systemPrompt, messages)
      resposta = result.text
      tokensUsados = result.tokens
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      erros.push(message)
      console.error('[manual-ia] Claude falhou:', err)
    }
  }

  if (!resposta) {
    const detalhe = erros.length ? erros.join(' | ') : 'serviço de IA indisponível'
    resposta =
      `Não consegui processar sua pergunta no momento (${detalhe}). Tente novamente, consulte Manual & FAQ ou abra um ticket de suporte.`
  }

  if (userId) {
    try {
      await supabaseAdmin.from('manual_ia_historico').insert({
        user_id: userId,
        company_id: companyId,
        pergunta,
        resposta,
        secao_contexto: secao_contexto || null,
        tokens_usados: tokensUsados,
        duracao_ms: Date.now() - startMs,
      })
    } catch (err) {
      console.error('[manual-ia] erro ao salvar histórico:', err)
    }
  }

  return new Response(JSON.stringify({ resposta, tokens_usados: tokensUsados }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
