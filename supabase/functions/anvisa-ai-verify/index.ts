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
    let score = 0

    for (const term of terms) {
      const normalizedTerm = normalize(term)
      if (!normalizedTerm) continue
      const tokens = normalizedTerm.split(' ').filter((token) => token.length >= 3)
      // Match estrito: só nome técnico ou nutriente/substância bioativa,
      // nunca função/observação (para não dar falso positivo).
      if (name === normalizedTerm || nutrient === normalizedTerm) {
        score = Math.max(score, 100)
      } else if (normalizedTerm.length >= 4 && (name.includes(normalizedTerm) || nutrient.includes(normalizedTerm))) {
        score = Math.max(score, 92)
      } else if (tokens.length >= 2 && tokens.every((token) => name.includes(token) || nutrient.includes(token))) {
        score = Math.max(score, 85)
      } else if (tokens.length >= 1 && functionText && tokens.every((token) => functionText.includes(token)) && tokens.join(' ').length >= 6) {
        // Função só conta como evidência fraca se o termo inteiro (>=6 chars) bate em todos os tokens.
        score = Math.max(score, 70)
      }
    }

    return { row, score }
  })

  return scored
    .filter((item) => item.score >= 85)
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

// A IA NUNCA define status. Ela apenas sugere variações de grafia/sinônimos
// científicos para re-consultar a base oficial do Power BI ANVISA.
const SYSTEM_PROMPT = `Você ajuda a normalizar o nome de uma substância para consulta na lista oficial ANVISA (IN 28/2018, anexos I a VI).
Dado um termo informado pelo usuário, retorne apenas POSSÍVEIS GRAFIAS e SINÔNIMOS CIENTÍFICOS para localizar a entrada na lista oficial.
Não classifique como autorizada, proibida ou não listada. Não invente substâncias correlatas.
Inclua: nome científico, nome popular, variações de grafia/acentuação, abreviações comuns, formas químicas/sais formalmente listados na IN 28/2018.

Responda SOMENTE com JSON válido (sem markdown) no formato:
{ "variacoes": string[] }`

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

    let powerBiRows: PowerBiRow[] = []
    try {
      powerBiRows = await fetchPowerBiRows()
    } catch (error) {
      console.warn('Power BI ANVISA lookup failed:', error instanceof Error ? error.message : error)
    }

    const directRows = matchPowerBiRows(powerBiRows, String(termo))
    if (directRows.length > 0) {
      const resultados = directRows.map((row) => powerBiRowToResult(row, String(termo)))
      return new Response(JSON.stringify({ termo, resultados, resultado: resultados[0], origem: 'powerbi_anvisa' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Não achou direto. Tenta IA somente para gerar variações de grafia
    // e re-consulta o Power BI com essas variações. A IA NUNCA define status.
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')
    let variacoesIA: string[] = []
    if (lovableApiKey) {
      try {
        const response = await fetch(AI_GATEWAY, {
          method: 'POST',
          headers: { Authorization: `Bearer ${lovableApiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: SYSTEM_PROMPT },
              { role: 'user', content: `Termo informado: ${termo}` },
            ],
            temperature: 0,
            max_tokens: 400,
          }),
        })
        if (response.ok) {
          const data = await response.json()
          const content: string = data.choices?.[0]?.message?.content || '{}'
          const cleaned = content.replace(/```json?\n?/g, '').replace(/```/g, '').trim()
          try {
            const parsed = JSON.parse(cleaned)
            if (Array.isArray(parsed?.variacoes)) {
              variacoesIA = parsed.variacoes.filter((v: unknown) => typeof v === 'string' && v.trim().length >= 2)
            }
          } catch { /* ignora */ }
        }
      } catch (error) {
        console.warn('AI variação lookup failed:', error instanceof Error ? error.message : error)
      }
    }

    // Re-tenta Power BI com cada variação sugerida pela IA
    const matched: PowerBiRow[] = []
    const seen = new Set<string>()
    for (const variacao of variacoesIA) {
      for (const row of matchPowerBiRows(powerBiRows, variacao)) {
        const key = row['Constituintes Autorizados'] || ''
        if (key && !seen.has(key)) {
          seen.add(key)
          matched.push(row)
        }
      }
    }

    if (matched.length > 0) {
      const resultados = matched.map((row) => powerBiRowToResult(row, String(termo)))
      return new Response(
        JSON.stringify({ termo, resultados, resultado: resultados[0], origem: 'powerbi_anvisa_ia_grafia', variacoes_testadas: variacoesIA }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Nada encontrado na base oficial — NÃO afirmamos status. Apenas reportamos honestamente.
    return new Response(
      JSON.stringify({
        termo,
        resultados: [],
        resultado: null,
        origem: 'powerbi_anvisa',
        variacoes_testadas: variacoesIA,
        mensagem: 'Nenhuma correspondência encontrada na lista oficial ANVISA (IN 28/2018) consultada via Power BI.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('anvisa-ai-verify error:', msg)
    return new Response(JSON.stringify({ erro: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})