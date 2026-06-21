const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

// Endpoint nativo Gemini generateContent
const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

const SYSTEM_PROMPT = `Você é um especialista em suplementos alimentares e nomenclatura ANVISA.
Dado um termo de busca, retorne APENAS os nomes técnicos/científicos que são SINÔNIMOS ou VARIAÇÕES DO MESMO ingrediente ativo na legislação brasileira (IN 28/2018).

REGRA CRÍTICA: NÃO inclua substâncias diferentes, mesmo que sejam da mesma categoria ou tenham uso similar.
- "melatonina" → APENAS ["Melatonina"] (NÃO inclua L-Teanina, GABA, ou outros calmantes)
- "vitamina d" → APENAS ["Colecalciferol", "Vitamina D3", "Vitamina D"] (são a mesma substância)
- "omega 3" → ["Ácido eicosapentaenoico", "EPA", "DHA", "Ômega 3"] (componentes do mesmo composto)
- "CoQ10" → ["Coenzima Q10", "Ubiquinona"] (mesma substância)
- "ashwaganda" → ["Withania somnifera", "Ashwagandha"] (mesmo ingrediente, correção de erro)
- "maca" → ["Lepidium meyenii", "Maca Peruana", "Maca"]
- "ora pronobilis" → ["Pereskia aculeata", "Ora-pro-nóbis"]

O usuário pode digitar com erros ortográficos. Interprete a intenção mas retorne APENAS variações do MESMO ingrediente.
Responda APENAS com um JSON array de strings. Inclua o termo original.
Se não reconhecer, retorne apenas o termo original.
Responda somente o JSON, sem markdown.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { termo } = await req.json()

    if (!termo || termo.length < 2) {
      return new Response(JSON.stringify({ termos: [termo] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let geminiKey: string | null = Deno.env.get('GEMINI_API_KEY') || null
    if (!geminiKey) {
      // Fallback: buscar do banco erp_system_config (configuração global do ERP)
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (supabaseUrl && serviceKey) {
          const cfgRes = await fetch(
            `${supabaseUrl}/rest/v1/erp_system_config?chave=eq.gemini_api_key&select=valor&limit=1`,
            { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
          )
          if (cfgRes.ok) {
            const cfgData = await cfgRes.json()
            geminiKey = cfgData?.[0]?.valor || null
          }
        }
      } catch (_) { /* ignore — fallback silencioso */ }
    }
    if (!geminiKey) {
      // Sem chave: retorna o termo original sem chamar a IA
      return new Response(JSON.stringify({ termos: [termo] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Chamada ao endpoint nativo Gemini generateContent
    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${geminiKey}`
    const body = {
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: termo }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0,
        maxOutputTokens: 512,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error('Gemini API error (resolve-name):', errText)
      return new Response(JSON.stringify({ termos: [termo] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const rawText: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]'
    const cleanText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()

    let termos: string[] = [termo]
    try {
      const parsed = JSON.parse(cleanText)
      if (Array.isArray(parsed) && parsed.length > 0) {
        const set = new Set<string>(parsed.map((t: string) => t.trim()).filter(Boolean))
        set.add(termo)
        termos = Array.from(set)
      }
    } catch {
      termos = [termo]
    }

    return new Response(JSON.stringify({ termos }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('Resolve name error:', msg)
    return new Response(JSON.stringify({ termos: [], error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
