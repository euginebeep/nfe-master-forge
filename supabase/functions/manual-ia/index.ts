import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  const body = await req.json()
  const { pergunta, secao_contexto, historico_chat } = body

  if (!pergunta?.trim()) {
    return new Response(JSON.stringify({ error: 'Pergunta não informada' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const startMs = Date.now()
  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  // Pegar usuário (opcional — para salvar histórico)
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
        const { data: profile } = await supabaseAdmin.from('profiles').select('company_id').eq('id', user.id).single()
        companyId = profile?.company_id || null
      }
    } catch (_) {}
  }

  const systemPrompt = `Você é o BrainX Assistente — especialista no BrainX ERP Industrial para fabricantes de suplementos alimentares no Brasil.

MÓDULOS DO SISTEMA: Dashboard | Estoque/Lotes (FEFO) | Produção/OPs | Fórmulas | ANVISA Checker | NF-e (Nuvem Fiscal) | Financeiro | Clientes/Fornecedores | Qualidade | Monitoramento Ambiental (Sonoff/eWeLink) | Regulatório | Equipamentos (V-Mixer)

REGRAS DE RESPOSTA: 
1. Sempre cite qual módulo/tela responde à dúvida. Ex: "Em Estoque → Lotes..." 
2. Para dúvidas regulatórias ANVISA, sempre recomendar validação com RT 
3. Se não souber algo específico, diga: "não tenho certeza — abra um ticket de suporte" 
4. Nunca invente funcionalidades que não existem no sistema 
5. Resposta em português do Brasil, tom profissional mas acessível 
6. Máximo 3 parágrafos — seja direto e prático 
7. Se houver passos sequenciais, use: 1) ... 2) ... 3)... 
8. Para cálculos de batelada: V-Mixer 100L, fator padrão 60%, densidade 0.65 kg/L 
9. Para ANVISA: base IN 28/2018, Power BI sincronizado diariamente às 03h
${secao_contexto ? `\n\nO usuário está lendo a seção: "${secao_contexto}"` : ''}`

  const messages = [
    ...(Array.isArray(historico_chat) ? historico_chat.slice(-6) : []),
    { role: 'user', content: pergunta }
  ]

  let resposta = ''
  let tokensUsados = 0

  // Primário: Google Gemini direto
  if (geminiKey) {
    try {
      const res = await fetch(GEMINI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${geminiKey}`,
        },
        body: JSON.stringify({
          model: 'gemini-2.5-flash',
          messages: [{ role: 'system', content: systemPrompt }, ...messages],
          max_tokens: 1000,
        }),
      })
      const data = await res.json()
      resposta = data?.choices?.[0]?.message?.content || ''
      tokensUsados = data?.usage?.total_tokens || 0
    } catch (e) {
      console.warn('[manual-ia] Gemini falhou:', e)
    }
  }

  // Fallback Anthropic
  if (!resposta && anthropicKey) {
    try {
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
          system: systemPrompt,
          messages,
        }),
      })
      const data = await res.json()
      resposta = data?.content?.[0]?.text || ''
      tokensUsados = (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0)
    } catch (e) {
      console.warn('[manual-ia] Claude falhou:', e)
    }
  }

  if (!resposta) {
    resposta = 'Não consegui processar sua pergunta no momento. Tente novamente ou abra um ticket de suporte em Configurações → Suporte.'
  }

  // Salvar histórico
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