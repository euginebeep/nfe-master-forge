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
- "d3" / "colecalciferol" / "vitamina d3" → APENAS Colecalciferol, Vitamina D3 (NUNCA Ergocalciferol/D2, Calcidiol, Calcitriol, metabólitos de D, nem "Vitamina D" genérico)
- "d2" / "ergocalciferol" / "vitamina d2" → APENAS Ergocalciferol, Vitamina D2 (NUNCA Colecalciferol/D3, Calcidiol, Calcitriol)
- "vitamina d" genérico → pode incluir Colecalciferol e Ergocalciferol como formas distintas, mas NUNCA misture sinônimos de D3 com sinônimos de D2 no mesmo balde sem distinção
- "k1" / "filoquinona" → APENAS Filoquinona, Vitamina K1 (NUNCA Menaquinona/K2)
- "k2" / "menaquinona" → APENAS Menaquinona, Vitamina K2 (NUNCA Filoquinona/K1)
- "b12" → APENAS Cobalamina, Cianocobalamina, Vitamina B12 (NÃO inclua B1, B6 ou outras vitaminas B)
- "omega 3" → ["Ácido eicosapentaenoico", "EPA", "DHA", "Ômega 3"] (componentes do mesmo composto)
- "CoQ10" → ["Coenzima Q10", "Ubiquinona"] (mesma substância)
- "ashwaganda" → ["Withania somnifera", "Ashwagandha"] (mesmo ingrediente, correção de erro)
- "maca" → ["Lepidium meyenii", "Maca Peruana", "Maca"]
- "ora pronobilis" → ["Pereskia aculeata", "Ora-pro-nóbis"]

HARD RULE: formas numeradas de vitaminas (D2≠D3, K1≠K2, B12≠B6…) NUNCA cruzam sinônimos entre si.

O usuário pode digitar com erros ortográficos. Interprete a intenção mas retorne APENAS variações do MESMO ingrediente.
Responda APENAS com um JSON array de strings. Inclua o termo original.
Se não reconhecer, retorne apenas o termo original.
Responda somente o JSON, sem markdown.`

function normForma(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

type Forma = 'd3' | 'd2' | 'k1' | 'k2' | 'b12' | 'b6' | 'b1' | 'b2' | 'b3' | 'b5' | 'b7' | 'b9' | null

const RE_COLECALCIFEROL = /(colecalciferol|vitamina\s*d3|\bd3\b)/
const RE_ERGOCALCIFEROL = /(ergocalciferol|vitamina\s*d2|\bd2\b)/
const RE_CALCIDIOL = /(calcidiol|25[\s-]?hidroxi|25\(oh\)|hidroxicolecalciferol)/
const RE_CALCITRIOL = /(calcitriol|1[\s,]?25[\s-]?di.*hidroxi)/
const RE_K1 = /(filoquinona|vitamina\s*k1|\bk1\b)/
const RE_K2 = /(menaquinona|vitamina\s*k2|\bk2\b)/
const RE_B: Record<string, RegExp> = {
  b12: /(cobalamina|cianocobalamina|metilcobalamina|vitamina\s*b12|\bb12\b)/,
  b6: /(piridox|vitamina\s*b6|\bb6\b)/,
  b1: /(tiamina|vitamina\s*b1|\bb1\b)/,
  b2: /(riboflavina|vitamina\s*b2|\bb2\b)/,
  b3: /(niacina|nicotinamida|vitamina\s*b3|\bb3\b)/,
  b5: /(pantoten|vitamina\s*b5|\bb5\b)/,
  b7: /(biotina|vitamina\s*b7|vitamina\s*h|\bb7\b)/,
  b9: /(folic|folato|metilfolato|vitamina\s*b9|\bb9\b)/,
}

function detectarForma(termo: string): Forma {
  const n = normForma(termo)
  if (!n) return null
  if (RE_CALCIDIOL.test(n)) return 'calcidiol' as Forma
  if (RE_CALCITRIOL.test(n)) return 'calcitriol' as Forma
  if (RE_COLECALCIFEROL.test(n)) return 'd3'
  if (RE_ERGOCALCIFEROL.test(n)) return 'd2'
  if (RE_K1.test(n)) return 'k1'
  if (RE_K2.test(n)) return 'k2'
  for (const b of ['b12', 'b9', 'b7', 'b6', 'b5', 'b3', 'b2', 'b1']) {
    if (RE_B[b].test(n)) return b as Forma
  }
  const compact = n.replace(/\s+/g, '')
  if (/^(d3|d2|k1|k2|b12|b9|b7|b6|b5|b3|b2|b1)$/.test(compact)) return compact as Forma
  return null
}

function termoConflitaForma(forma: Forma, termo: string): boolean {
  if (!forma) return false
  const n = normForma(termo)
  if (forma === 'd3') {
    return RE_ERGOCALCIFEROL.test(n)
      || RE_CALCIDIOL.test(n)
      || RE_CALCITRIOL.test(n)
      || (/vitamina\s*d\b/.test(n) && !RE_COLECALCIFEROL.test(n))
  }
  if (forma === 'd2') {
    return RE_COLECALCIFEROL.test(n) || RE_CALCIDIOL.test(n) || RE_CALCITRIOL.test(n)
  }
  if (forma === 'k1') return RE_K2.test(n)
  if (forma === 'k2') return RE_K1.test(n)
  if (forma.startsWith('b')) {
    for (const b of Object.keys(RE_B)) {
      if (b === forma) continue
      if (RE_B[b].test(n)) return true
    }
  }
  return false
}

function filtrarTermosPorForma(termoOriginal: string, termos: string[]): string[] {
  const forma = detectarForma(termoOriginal)
  if (!forma) return termos
  const kept = termos.filter((t) => !termoConflitaForma(forma, t))
  return kept.length > 0 ? kept : [termoOriginal]
}

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
        termos = filtrarTermosPorForma(termo, Array.from(set))
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
