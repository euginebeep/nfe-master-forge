const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'

const SYSTEM_PROMPT = `Você é um especialista em legislação ANVISA para suplementos alimentares (IN 28/2018, RDC 243/2018, RDC 240/2018 e atualizações).
Avalie TODAS as substâncias que possam corresponder ao termo informado pelo usuário, considerando:

1) Variações de grafia, acentuação, hifenização, pluralização, abreviações e erros ortográficos comuns
   (ex.: "colageno" = "Colágeno"; "ashwaganda"/"axuagandha" = "Ashwagandha"; "omega-3"/"ômega 3"/"ômega três" = "Ômega 3";
   "vit d"/"vit. d3"/"vitamina d" = "Vitamina D / Colecalciferol"; "q10"/"coq10"/"co q-10" = "Coenzima Q10").
2) Sinônimos científicos e nomes populares
   (ex.: "Maca" = "Lepidium meyenii"; "Ora pro nóbis" = "Pereskia aculeata"; "Cúrcuma" = "Curcuma longa / Curcumina").
3) Diferentes formas químicas/sais/variantes que aparecem na legislação como entradas separadas
   (ex.: "Magnésio" → citrato, bisglicinato, óxido, cloreto, malato; "Vitamina D" → D2 ergocalciferol e D3 colecalciferol;
   "Ômega 3" → EPA, DHA, ALA; "Colágeno" → peptídeos de colágeno, proteína de colágeno hidrolisado, colágeno tipo II não desnaturado).
4) Categorias correlatas autorizadas (anexos I a VI da IN 28/2018, plantas autorizadas, RDC 243/2018) e a lista de proibidos.

Liste TODAS as correspondências plausíveis (uma entrada por forma/variante legal). NÃO inclua substâncias diferentes só por terem uso parecido.
Se houver formas autorizadas E formas proibidas com o mesmo nome popular, retorne ambas.

Retorne SOMENTE um JSON válido (sem markdown) na forma:
{
  "resultados": [
    {
      "autorizado": boolean,
      "status": "AUTORIZADO" | "PROIBIDO" | "NAO_LISTADO" | "REGULAMENTACAO_ESPECIFICA",
      "nome_tecnico": string,
      "nome_popular": string,
      "variacoes_grafia": string[],
      "categoria": string,
      "anexo": string,
      "fonte_legal": string,
      "justificativa": string,
      "alegacoes": string[],
      "advertencias": string[],
      "observacao": string
    }
  ]
}

Regras de status:
- "AUTORIZADO": consta nos anexos permitidos.
- "REGULAMENTACAO_ESPECIFICA": permitido com regramento próprio (ex.: medicamento, novel food).
- "PROIBIDO": consta em lista de proibidos.
- "NAO_LISTADO": não previsto na legislação de suplementos.

Se não houver qualquer correspondência, retorne {"resultados": []}.`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { termo } = await req.json()
    if (!termo || String(termo).length < 2) {
      return new Response(JSON.stringify({ erro: 'termo_invalido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    if (!lovableApiKey) {
      return new Response(JSON.stringify({ erro: 'lovable_api_key_missing' }), {
        status: 500,
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
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `Substância buscada: ${termo}` },
        ],
        temperature: 0,
        max_tokens: 2500,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      let aviso = 'ai_gateway_error'
      if (response.status === 402) aviso = 'sem_creditos_ia'
      else if (response.status === 429) aviso = 'limite_requisicoes_ia'
      // Retorna 200 com aviso para evitar tela em branco no cliente
      return new Response(
        JSON.stringify({ termo, resultados: [], resultado: null, aviso, detalhe: text }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const data = await response.json()
    const content: string = data.choices?.[0]?.message?.content || '{}'
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

    type Res = Record<string, unknown> & { autorizado?: boolean; status?: string }
    let resultados: Res[] = []
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed?.resultados)) {
        resultados = parsed.resultados
      } else if (parsed && typeof parsed === 'object' && (parsed.status || parsed.autorizado !== undefined)) {
        // tolerância: formato antigo de objeto único
        resultados = [parsed]
      }
    } catch {
      resultados = []
    }

    const primeiro = resultados[0] || null

    return new Response(JSON.stringify({ termo, resultados, resultado: primeiro }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('anvisa-ai-verify error:', msg)
    return new Response(JSON.stringify({ erro: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})