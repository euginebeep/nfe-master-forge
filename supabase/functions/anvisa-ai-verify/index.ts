const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const AI_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions'
const POWERBI_RESOURCE_KEY = '458ce16a-f74b-4e92-977a-e12e2927d746'
const POWERBI_API = 'https://wabi-brazil-south-api.analysis.windows.net'

const POWERBI_FIELDS = [
  'Categoria',
  'Constituintes Autorizados',
  'CAS',
  'Função',
  '0 a 6 meses',
  '7 a 11 meses',
  '1 a 3 anos',
  '4 a 8 anos ',
  '9 a 18 anos',
  'Maiores 19 anos ',
  'Gestantes ',
  'Lactantes',
  'Alegações autorizadas e requisitos para uso da alegação',
  'Requisitos de Rotulagem Complementar e outros',
  'Especificações',
  'Observações',
  'Outras Informações',
  'Nutriente/Substância Bioativa/Enzima',
  'Link de acesso a especificações publicadas',
] as const

type PowerBiRow = Record<(typeof POWERBI_FIELDS)[number], string | null>

let powerBiCache: { rows: PowerBiRow[]; expiresAt: number } | null = null

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const compact = (value: unknown) => normalize(value).replace(/\s+/g, '')

function expandSearchTerms(termo: string): string[] {
  const base = normalize(termo)
  const terms = new Set<string>([termo, base])
  const aliases: Record<string, string[]> = {
    gaba: ['ácido gama aminobutírico', 'acido gama aminobutirico'],
    'acido folico': ['ácido fólico', 'vitamina b9', 'folato', 'ácido n pteroil l glutâmico'],
    folico: ['ácido fólico', 'vitamina b9', 'folato'],
    'vitamina b9': ['ácido fólico', 'folato', 'l metilfolato'],
    colageno: ['colágeno', 'colageno hidrolisado', 'gelatina hidrolisada', 'colageno tipo ii'],
    'omega 3': ['ômega 3', 'epa', 'dha', 'ácido eicosapentaenóico', 'ácido docosahexaenóico'],
    coq10: ['coenzima q10', 'ubiquinona'],
    q10: ['coenzima q10', 'ubiquinona'],
  }
  for (const [key, values] of Object.entries(aliases)) {
    if (base === key || base.includes(key) || key.includes(base)) values.forEach((v) => terms.add(v))
  }
  return Array.from(terms).filter((t) => normalize(t).length >= 2)
}

function decodePowerBiRows(payload: unknown): PowerBiRow[] {
  const data = payload as Record<string, any>
  const ds = data?.results?.[0]?.result?.data?.dsr?.DS?.[0]
  const records = ds?.PH?.[0]?.DM0
  const valueDicts = ds?.ValueDicts || {}
  if (!Array.isArray(records) || records.length === 0) return []
  const columns = records[0]?.S || []
  const previous = new Array(columns.length).fill(null)
  const rows: PowerBiRow[] = []

  for (const record of records) {
    const values: (string | null)[] = []
    const repeatedMask = Number(record.R || 0)
    const nullMask = Number(record['Ø'] || 0)
    const cells = Array.isArray(record.C) ? record.C : []
    let cellIndex = 0

    for (let index = 0; index < columns.length; index++) {
      let value: string | null = null
      if (repeatedMask & (1 << index)) {
        value = previous[index]
      } else if (nullMask & (1 << index)) {
        value = null
      } else {
        const raw = cells[cellIndex++]
        const dictName = columns[index]?.DN
        const dict = dictName ? valueDicts[dictName] : null
        value = Array.isArray(dict) && Number.isInteger(raw) ? dict[raw] ?? null : raw ?? null
      }
      values[index] = typeof value === 'string' ? value.replace(/^'|'$/g, '') : value
    }

    for (let index = 0; index < values.length; index++) previous[index] = values[index]
    const row = Object.fromEntries(POWERBI_FIELDS.map((field, index) => [field, values[index] ?? null])) as PowerBiRow
    if (row['Constituintes Autorizados']) rows.push(row)
  }
  return rows
}

async function fetchPowerBiRows(): Promise<PowerBiRow[]> {
  if (powerBiCache && powerBiCache.expiresAt > Date.now()) return powerBiCache.rows

  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ActivityId: crypto.randomUUID(),
    RequestId: crypto.randomUUID(),
    'X-PowerBI-ResourceKey': POWERBI_RESOURCE_KEY,
    Referer: 'https://app.powerbi.com/',
  }

  const metaResponse = await fetch(`${POWERBI_API}/public/reports/${POWERBI_RESOURCE_KEY}/modelsAndExploration?preferReadOnlySession=true`, { headers })
  if (!metaResponse.ok) throw new Error(`powerbi_metadata_${metaResponse.status}`)
  const meta = await metaResponse.json()
  const modelId = meta?.exploration?.report?.modelId || meta?.models?.[0]?.id
  const datasetId = meta?.models?.[0]?.dbName
  const reportId = String(meta?.exploration?.report?.id || meta?.exploration?.reportId || '')

  const select = POWERBI_FIELDS.map((field) => ({
    Column: { Expression: { SourceRef: { Source: 'c' } }, Property: field },
    Name: `Consulta1.${field}`,
  }))
  const semanticQuery = {
    Commands: [{
      SemanticQueryDataShapeCommand: {
        Query: { Version: 2, From: [{ Name: 'c', Entity: 'Contituintes IN 28', Type: 0 }], Select: select },
        Binding: {
          Primary: { Groupings: [{ Projections: POWERBI_FIELDS.map((_, index) => index) }] },
          DataReduction: { DataVolume: 4, Primary: { Window: { Count: 1000 } } },
          Version: 1,
        },
        ExecutionMetricsKind: 1,
      },
    }],
  }
  const queryResponse = await fetch(`${POWERBI_API}/public/reports/querydata?synchronous=true`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      version: '1.0.0',
      queries: [{
        Query: semanticQuery,
        CacheKey: JSON.stringify(semanticQuery),
        QueryId: '',
        ApplicationContext: { DatasetId: datasetId, Sources: [{ ReportId: reportId }] },
      }],
      cancelQueries: [],
      modelId,
    }),
  })
  if (!queryResponse.ok) throw new Error(`powerbi_query_${queryResponse.status}`)
  const rows = decodePowerBiRows(await queryResponse.json())
  powerBiCache = { rows, expiresAt: Date.now() + 60 * 60 * 1000 }
  return rows
}

function matchPowerBiRows(rows: PowerBiRow[], termo: string): PowerBiRow[] {
  const terms = expandSearchTerms(termo)
  const scored = rows.map((row) => {
    const name = normalize(row['Constituintes Autorizados'])
    const nutrient = normalize(row['Nutriente/Substância Bioativa/Enzima'])
    const functionText = normalize(row['Função'])
    const haystack = normalize(Object.values(row).filter(Boolean).join(' '))
    const haystackCompact = compact(haystack)
    let score = 0

    for (const term of terms) {
      const normalizedTerm = normalize(term)
      const compactTerm = compact(term)
      const tokens = normalizedTerm.split(' ').filter((token) => token.length > 1)
      if (name === normalizedTerm || nutrient === normalizedTerm) score = Math.max(score, 100)
      if (name.includes(normalizedTerm) || nutrient.includes(normalizedTerm)) score = Math.max(score, 90)
      if (functionText.includes(normalizedTerm)) score = Math.max(score, 82)
      if (normalizedTerm.length >= 4 && haystack.includes(normalizedTerm)) score = Math.max(score, 75)
      if (compactTerm.length >= 3 && haystackCompact.includes(compactTerm)) score = Math.max(score, 72)
      if (tokens.length > 1 && tokens.every((token) => haystack.includes(token))) score = Math.max(score, 68)
    }

    return { row, score }
  })

  return scored
    .filter((item) => item.score >= 68)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((item) => item.row)
}

function splitLegalText(value: string | null): string[] {
  if (!value || normalize(value).includes('nao foi aprovada alegacao')) return value ? [value] : []
  if (normalize(value).includes('nao ha requisitos adicionais')) return []
  return value.split(/\n(?=\d+\)|Alegação:)/g).map((part) => part.trim()).filter(Boolean)
}

function powerBiRowToResult(row: PowerBiRow, termo: string) {
  const faixas: Array<{ grupo: string; valor: string | null }> = [
    { grupo: '0 a 6 meses', valor: row['0 a 6 meses'] },
    { grupo: '7 a 11 meses', valor: row['7 a 11 meses'] },
    { grupo: '1 a 3 anos', valor: row['1 a 3 anos'] },
    { grupo: '4 a 8 anos', valor: row['4 a 8 anos '] },
    { grupo: '9 a 18 anos', valor: row['9 a 18 anos'] },
    { grupo: 'Maiores 19 anos', valor: row['Maiores 19 anos '] },
    { grupo: 'Gestantes', valor: row['Gestantes '] },
    { grupo: 'Lactantes', valor: row['Lactantes'] },
  ]

  return {
    autorizado: true,
    status: 'AUTORIZADO',
    nome_tecnico: row['Constituintes Autorizados'],
    nome_popular: row['Nutriente/Substância Bioativa/Enzima'] || row['Função'] || termo,
    variacoes_grafia: expandSearchTerms(termo),
    categoria: row['Categoria'] || 'Constituinte autorizado',
    anexo: 'Lista oficial de constituintes autorizados',
    fonte_legal: 'Power BI ANVISA – IN 28/2018 e atualizações oficiais',
    justificativa: `Encontrado na lista oficial de constituintes autorizados da ANVISA como “${row['Constituintes Autorizados']}”.`,
    alegacoes: splitLegalText(row['Alegações autorizadas e requisitos para uso da alegação']),
    advertencias: splitLegalText(row['Requisitos de Rotulagem Complementar e outros']),
    funcao: row['Função'] || null,
    cas: row['CAS'] || null,
    especificacoes: row['Especificações'] || null,
    link_especificacoes: row['Link de acesso a especificações publicadas'] || null,
    limites_idade: faixas,
    observacoes: row['Observações'] || null,
    outras_informacoes: row['Outras Informações'] || null,
    nutriente: row['Nutriente/Substância Bioativa/Enzima'] || null,
  }
}

function sanitizeAiResult(result: Record<string, unknown>) {
  const status = String(result.status || '').toUpperCase()
  const evidence = normalize(`${result.fonte_legal || ''} ${result.justificativa || ''} ${result.observacao || ''}`)
  if (status === 'PROIBIDO' && /(nao consta|nao encontrado|nao listado|nao previsto|ausencia|sem correspondencia)/.test(evidence)) {
    return { ...result, autorizado: false, status: 'NAO_LISTADO', observacao: 'Sem confirmação na lista oficial consultada; não classificar como proibido sem evidência expressa.' }
  }
  return result
}

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

    try {
      const officialRows = matchPowerBiRows(await fetchPowerBiRows(), String(termo))
      if (officialRows.length > 0) {
        const resultados = officialRows.map((row) => powerBiRowToResult(row, String(termo)))
        return new Response(JSON.stringify({ termo, resultados, resultado: resultados[0], origem: 'powerbi_anvisa' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    } catch (error) {
      console.warn('Power BI ANVISA lookup failed:', error instanceof Error ? error.message : error)
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
        resultados = parsed.resultados.map(sanitizeAiResult)
      } else if (parsed && typeof parsed === 'object' && (parsed.status || parsed.autorizado !== undefined)) {
        // tolerância: formato antigo de objeto único
        resultados = [sanitizeAiResult(parsed)]
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