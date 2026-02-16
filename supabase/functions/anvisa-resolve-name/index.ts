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
            content: `Você é um especialista em suplementos alimentares, fitoterapia e nomenclatura ANVISA.
Dado um termo de busca (pode ser nome popular, comercial, abreviação, apelido, ou mesmo com ERROS DE DIGITAÇÃO), retorne os possíveis nomes técnicos/científicos correspondentes usados na legislação brasileira (IN 28/2018).

IMPORTANTE: O usuário pode digitar com erros ortográficos, abreviações ou nomes aproximados. Você deve interpretar a intenção e retornar os nomes corretos.

Exemplos:
- "maca" → ["Lepidium meyenii", "Maca Peruana", "Maca"]
- "vit d" → ["Colecalciferol", "Vitamina D3", "Vitamina D"]
- "omega" → ["Ácido eicosapentaenoico", "EPA", "DHA", "Ômega 3"]
- "whey" → ["Proteína do soro do leite", "Whey Protein"]
- "CoQ10" → ["Coenzima Q10", "Ubiquinona"]
- "ora pronobilis" → ["Pereskia aculeata", "Ora-pro-nóbis", "ora pronobilis"]
- "ashwaganda" → ["Withania somnifera", "Ashwagandha"]
- "glucosamina" → ["Glucosamina", "Sulfato de glucosamina"]
- "spirulina" → ["Spirulina", "Arthrospira platensis"]
- "curcuma" → ["Curcuma longa", "Cúrcuma", "Açafrão-da-terra"]

Responda APENAS com um JSON array de strings com os nomes técnicos/científicos. Inclua o termo original também.
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
