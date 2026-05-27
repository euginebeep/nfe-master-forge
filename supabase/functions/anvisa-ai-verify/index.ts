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
          {
            role: 'system',
            content: `Você é um especialista em legislação ANVISA para suplementos alimentares (IN 28/2018, RDC 243/2018, RDC 240/2018 e atualizações).
Avalie se a substância informada PODE ser utilizada em suplementos alimentares no Brasil.

Considere TODAS as listas oficiais ANVISA:
- Anexo I (Nutrientes — vitaminas e minerais)
- Anexo II (Substâncias bioativas — ex.: cafeína, luteína, licopeno)
- Anexo III (Enzimas)
- Anexo IV (Probióticos)
- Anexo VI (Proteínas e aminoácidos — INCLUI proteína/peptídeos de colágeno, whey, caseína, soja, BCAAs, creatina, etc.)
- Plantas autorizadas (Instrução Normativa nº 28/2018, anexo de plantas)
- Constituintes proibidos / não autorizados (RDC 243/2018 art. 7º e listas complementares)

Reconheça nomes populares e variações (ex.: "Colágeno" = "Peptídeos de colágeno / Proteína de colágeno hidrolisado", "Ômega 3" = EPA/DHA, "Whey" = Proteína do soro do leite, "Ashwagandha" = Withania somnifera).

Retorne SOMENTE um JSON válido (sem markdown) com a forma:
{
  "autorizado": boolean,
  "status": "AUTORIZADO" | "PROIBIDO" | "NAO_LISTADO" | "REGULAMENTACAO_ESPECIFICA",
  "nome_tecnico": string,
  "nome_popular": string,
  "categoria": string,            // ex: "Proteína / Aminoácido", "Vitamina", "Probiótico", "Planta"
  "anexo": string,                // ex: "Anexo VI IN 28/2018"
  "fonte_legal": string,          // ex: "IN 28/2018 - Anexo VI; RDC 243/2018"
  "justificativa": string,        // 1-2 frases claras
  "alegacoes": string[],          // alegações de propriedade funcional permitidas, se houver
  "advertencias": string[],       // advertências obrigatórias de rotulagem, se houver
  "observacao": string            // restrições, limites ou observações relevantes
}

Se realmente não houver previsão na legislação, use status "NAO_LISTADO" e autorizado=false.
Se for proibida, status "PROIBIDO" e autorizado=false.
Se permitida (mesmo com regulamento específico), autorizado=true.`
          },
          { role: 'user', content: `Substância: ${termo}` },
        ],
        temperature: 0,
        max_tokens: 800,
      }),
    })

    if (!response.ok) {
      const text = await response.text()
      return new Response(JSON.stringify({ erro: 'ai_gateway_error', detalhe: text }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const data = await response.json()
    const content: string = data.choices?.[0]?.message?.content || '{}'
    const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()

    let parsed: Record<string, unknown> = {}
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      parsed = { autorizado: false, status: 'NAO_LISTADO', justificativa: content }
    }

    return new Response(JSON.stringify({ termo, resultado: parsed }), {
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