
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const lovableKey = Deno.env.get('LOVABLE_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  const authHeader = req.headers.get('Authorization') || ''
  const supabaseAuth = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user } } = await supabaseAuth.auth.getUser()
  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  const body = await req.json()
  const { pergunta, secao_contexto, historico_chat } = body

  if (!pergunta?.trim()) {
    return new Response(JSON.stringify({ error: 'Pergunta não informada' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startMs = Date.now()

  // ── 1. Buscar perguntas relevantes do manual
  const termosBusca = pergunta.toLowerCase()
    .replace(/[^a-záéíóúâêîôûàãõçñ\s]/gi, ' ')
    .split(' ')
    .filter(t => t.length >= 3)
    .slice(0, 8)

  let contextManual = ""
  try {
    const { data: perguntas } = await supabaseAdmin
      .from('manual_perguntas')
      .select('pergunta, resposta, modulo')
      .eq('ativo', true)
      .textSearch('pergunta', termosBusca.join(' | '), { type: 'plain' })
      .limit(5)

    if (perguntas && perguntas.length > 0) {
      contextManual = '\n\nCONTEXTO DO MANUAL BRAINX (perguntas relevantes já respondidas):\n'
      for (const p of perguntas) {
        contextManual += `\nP: ${p.pergunta}\nR: ${p.resposta}\n---`
      }
    }
  } catch (e) {
    console.warn('[manual-ia] erro ao buscar contexto:', e)
  }

  // ── 2. Montar system prompt especializado
  const systemPrompt = `Você é o BrainX Assistente — especialista no BrainX ERP Industrial para fabricantes de suplementos alimentares.

SUAS RESPONSABILIDADES:
- Responder dúvidas sobre o uso do BrainX ERP com precisão
- Explicar funcionalidades, módulos e configurações
- Orientar sobre regulatório ANVISA, NF-e, produção e estoque
- Ser direto, prático e usar exemplos do dia a dia industrial

MÓDULOS DO BRAINX ERP:
Dashboard | Estoque/Lotes | Produção (OPs) | Fórmulas | ANVISA Checker | NF-e (Nuvem Fiscal) | Financeiro | Clientes/Fornecedores | Qualidade | Monitoramento Ambiental (Sonoff) | Regulatório | Relatórios

REGRAS:
1. Sempre cite qual módulo/tela responde à dúvida (ex: "Em Estoque → Lotes...")
2. Se não souber algo específico do ERP, diga "não tenho certeza, abra um ticket de suporte"
3. Para dúvidas regulatórias ANVISA, sempre recomendar validação com RT
4. Nunca invente funcionalidades que não existem
5. Respostas em português do Brasil, tom profissional mas acessível
6. Máximo 3 parágrafos por resposta — seja conciso
7. Se houver passos sequenciais, use numeração: 1) ... 2) ... 3)...
${contextManual}`

  // ── 3. Chamar IA
  const messages = [
    ...(historico_chat || []),
    { role: 'user', content: pergunta }
  ]

  let resposta = ''
  let tokensUsados = 0

  try {
    const aiRes = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${lovableKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-2.0-flash',
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        max_tokens: 1000,
      }),
    })
    const aiData = await aiRes.json()
    console.log('[manual-ia] Resposta gateway:', JSON.stringify(aiData))
    resposta = aiData?.choices?.[0]?.message?.content || ''
    tokensUsados = aiData?.usage?.total_tokens || 0
  } catch (e: any) {
    console.error('[manual-ia] Erro no gateway Lovable:', e)
  }

  if (!resposta) {
    resposta = 'Não consegui processar sua pergunta no momento. Tente novamente ou abra um ticket de suporte.'
  }

  // ── 4. Registrar no histórico
  if (user) {
    try {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('company_id')
        .eq('id', user.id)
        .single()

      await supabaseAdmin.from('manual_ia_historico').insert({
        user_id: user.id,
        company_id: profile?.company_id,
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
