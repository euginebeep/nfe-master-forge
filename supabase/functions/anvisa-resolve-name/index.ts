const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'

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

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) {
      // Fallback: return original term
      return new Response(JSON.stringify({ termos: [termo] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const response = await fetch(AI_GATEWAY, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em suplementos alimentares e nomenclatura ANVISA.
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
          },
          {
            role: 'user',
            content: termo,
          },
        ],
        temperature: 0,
        max_tokens: 300,
      }),
    })

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '[]'

    let termos: string[] = [termo]
    try {
      const parsed = JSON.parse(content.replace(/```json?\n?/g, '').replace(/```/g, '').trim())
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure original term is included
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
