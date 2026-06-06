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

// TRAVA DE SEGURANÇA FINAL — bloqueia qualquer falso positivo.
// Exige que cada linha aprovada compartilhe pelo menos UM token significativo
// (>=4 chars) do termo do usuário com o nome técnico ou nutriente da linha,
// OU que um deles seja substring direto do outro. Sem isso, descarta a linha.
function safetyFilterRows(rows: PowerBiRow[], termo: string): PowerBiRow[] {
  const termNorm = normalize(termo)
  if (!termNorm) return []
  const termTokens = termNorm.split(' ').filter((t) => t.length >= 4)
  return rows.filter((row) => {
    const name = normalize(row['Constituintes Autorizados'])
    const nutrient = normalize(row['Nutriente/Substância Bioativa/Enzima'])
    const haystack = `${name} ${nutrient}`.trim()
    if (!haystack) return false
    // Caso 1: o termo (>=4 chars) aparece literalmente no nome/nutriente, ou vice-versa.
    if (termNorm.length >= 4 && (haystack.includes(termNorm) || name.includes(termNorm) || nutrient.includes(termNorm))) return true
    if (name && termNorm.includes(name) && name.length >= 4) return true
    if (nutrient && termNorm.includes(nutrient) && nutrient.length >= 4) return true
    // Caso 2: pelo menos um token significativo do termo bate no nome/nutriente.
    if (termTokens.length > 0 && termTokens.some((tok) => name.includes(tok) || nutrient.includes(tok))) return true
    return false
  })
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

  const startedAt = Date.now()
  let termoLog = ''
  let origemLog = 'erro'
  let encontrouLog = false
  let totalLog = 0
  let usouIaLog = false
  const authHeader = req.headers.get('Authorization') || ''

  const logSearch = async () => {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      if (!supabaseUrl || !serviceKey || !termoLog) return
      let userId: string | null = null
      let companyId: string | null = null
      const token = authHeader.replace(/^Bearer\s+/i, '')
      if (token) {
        try {
          const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { Authorization: `Bearer ${token}`, apikey: serviceKey },
          })
          if (userRes.ok) {
            const u = await userRes.json()
            userId = u?.id ?? null
            if (userId) {
              const profRes = await fetch(
                `${supabaseUrl}/rest/v1/profiles?id=eq.${userId}&select=company_id`,
                { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
              )
              if (profRes.ok) {
                const arr = await profRes.json()
                companyId = arr?.[0]?.company_id ?? null
              }
            }
          }
        } catch (_) { /* ignore */ }
      }
      await fetch(`${supabaseUrl}/rest/v1/anvisa_search_log`, {
        method: 'POST',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          termo: termoLog.slice(0, 200),
          origem: origemLog,
          encontrou_match: encontrouLog,
          total_resultados: totalLog,
          usou_ia: usouIaLog,
          duracao_ms: Date.now() - startedAt,
          user_id: userId,
          company_id: companyId,
        }),
      })
    } catch (e) {
      console.warn('log search failed:', e instanceof Error ? e.message : e)
    }
  }

  try {
    const body = await req.json()
    const { termo, action } = body

    if (action === 'analyze_formula') {
      const systemPrompt = `Você é um especialista regulatório em suplementos 
alimentares brasileiros. Analise a fórmula fornecida com base na IN 28/2018 
e suas atualizações até IN 438/2026.

LIMITES CRÍTICOS VERIFICADOS:
- Vitamina D3: MÁXIMO 2.000 UI = 50 mcg/dia (IN 28 Anexo IV)
- Zinco: MÁXIMO 25 mg/dia (IN 28 Anexo IV)  
- Boro: MÁXIMO 6 mg/dia (IN 28 Anexo IV)
- Niacina B3: MÁXIMO 35 mg NE/dia (IN 28 Anexo IV)
- Ácido Fólico B9: MÁXIMO 400 mcg DFE/dia (IN 28 Anexo IV)
- Cromo: MÁXIMO 200 mcg/dia (IN 28 Anexo IV)
- Melatonina: MÁXIMO 0,21 mg/dia, exclusivo ≥19 anos (IN 102/2021)
- Berberina: NÃO autorizada (não consta Anexo I IN 28)
- Queratina: NÃO autorizada (não consta Anexo I IN 28)
- Silício Orgânico: NÃO autorizado (não consta Anexo I IN 28)
- L-Tirosina: AUTORIZADA — consta Anexo I IN 28 (CAS 60-18-4)

Retorne JSON com:
{
  "status_geral": "APROVADO|APROVADO COM RESSALVAS|BLOQUEADO",
  "alertas": [{"tipo": "err|warn|ok|info", "titulo": "", "corpo": ""}],
  "analise_ia": "texto explicativo da análise",
  "alegacoes_permitidas": ["..."],
  "alegacoes_proibidas": ["..."],
  "avisos_rotulo": ["..."],
  "sugestao_capsulas": {"n": 2, "tamanho": "#00", "frasco": 60, "obs": "..."}
}`
      
      const userMessage = JSON.stringify({
        produto: body.produto,
        cliente: body.cliente,
        publico: body.publico,
        ativos: body.ativos
      })

      const aiRes = await fetch(AI_GATEWAY, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage }
          ],
          response_format: { type: 'json_object' }
        })
      })

      if (!aiRes.ok) {
        const errorText = await aiRes.text();
        console.error('AI Gateway Error (analyze_formula):', errorText);
        throw new Error(`ai_gateway_error: ${aiRes.status} ${errorText}`);
      }
      const aiData = await aiRes.json()
      const content = JSON.parse(aiData.choices[0].message.content)

      return new Response(JSON.stringify(content), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    if (body.action === 'analyze_file') {
      const fileBase64 = body.file_base64 || '';
      const fileType = body.file_type || 'docx';
      const fileName = body.file_name || 'arquivo';
      const publico = body.publico || 'ADULTOS';
      const cliente = body.cliente || '';

      // Montar conteúdo para a IA com base no tipo de arquivo
      let fileContent = '';
      if (fileBase64 && fileType === 'image') {
        fileContent = '[imagem anexada para análise visual]';
      } else if (fileBase64) {
        try {
          const bytes = Uint8Array.from(atob(fileBase64), c => c.charCodeAt(0));
          const decoder = new TextDecoder('utf-8', { fatal: false });
          const rawText = decoder.decode(bytes);
          
          if (rawText.length > 100) {
            fileContent = rawText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').substring(0, 30000);
          } else {
            fileContent = `[Arquivo binário ${fileType} de ${bytes.length} bytes]`;
          }
        } catch (e) {
          fileContent = `[Erro ao ler conteúdo: ${e.message}]`;
        }
      }

      const systemPrompt = `Você é um especialista regulatório da Vitalnow Indústria Ltda. Sua tarefa é analisar TODOS os produtos contidos no arquivo enviado e retornar um JSON completo com a análise regulatória de CADA produto individualmente.

INSTRUÇÕES CRÍTICAS:
1. Se o arquivo for um ZIP com múltiplos briefings, analise CADA produto separadamente
2. NUNCA omitir produtos — se o arquivo contém 29 produtos, retorne 29 objetos no array
3. SEMPRE preencher o campo "nome" de cada ativo com o nome completo do ingrediente
4. SEMPRE preencher o campo "key" com a chave ANVISA correspondente (lista abaixo)
5. Retornar APENAS JSON válido — sem texto antes ou depois

MAPEAMENTO DE CHAVES ANVISA (campo "key" de cada ativo):
vitamina_d3 | vitamina_a | vitamina_c | vitamina_e | vitamina_b1 | vitamina_b2 | vitamina_b3 | vitamina_b5 | vitamina_b6 | vitamina_b7 | vitamina_b9 | vitamina_b12 | vitamina_k2 | zinco | ferro | magnesio | calcio | selenio | iodo | manganes | cobre | cromo | boro | fosforo | coenzima_q10 | cafeina | melatonina | luteina | zeaxantina | astaxantina | l_arginina | taurina | creatina | l_triptofano | l_tirosina | beta_alanina | leucina | isoleucina | valina | l_cistina | msm | acido_hialuronico | colageno_tipo2 | colageno_hidrolisado | omega3_epa_dha | espirulina | psyllium | curcuma | ext_laranja_moro | cha_verde | gengibre | feno_grego | propolis | berberina | queratina | silicio_organico | l_citrulina

LIMITES MÁXIMOS OBRIGATÓRIOS — IN 28/2018 Anexo IV:
- vitamina_d3: MÁXIMO 50 mcg = 2.000 UI/dia (NÃO 4.000 UI — erro crítico comum)
- zinco: MÁXIMO 25 mg/dia
- boro: MÁXIMO 6 mg/dia
- vitamina_b3: MÁXIMO 35 mg NE/dia
- vitamina_b9: MÁXIMO 400 mcg DFE/dia
- cromo: MÁXIMO 200 mcg/dia
- cafeina: MÁXIMO 210 mg/dose
- melatonina: MÁXIMO 0,21 mg/dia — exclusivo ≥19 anos
- l_arginina: MÁXIMO 3.000 mg/dia
- taurina: MÁXIMO 3.000 mg/dia
- creatina: MÁXIMO 3.000 mg/dia
- luteina: MÁXIMO 30 mg/dia
- cobre: MÁXIMO 0,9 mg/dia
- acido_hialuronico: MÍNIMO 50 mg obrigatório
- colageno_tipo2: MÍNIMO 40 mg UC-II não hidrolisado

CONSTITUINTES NÃO AUTORIZADOS (Anexo I IN 28 — STATUS = BLOQUEADO):
- berberina, queratina, silicio_organico, l_citrulina

CONSTITUINTES AUTORIZADOS — confirmar explicitamente:
- l_tirosina: APROVADO — CAS 60-18-4 Anexo I IN 28
- beta_alanina: APROVADO — IN 102/2021
- msm: APROVADO — Anexo I IN 28 sem limite máximo

ESTRUTURA DO JSON DE RETORNO:
{
  "total_produtos": number,
  "produtos": [
    {
      "nome": "",
      "cliente": "",
      "categoria": "",
      "status_geral": "APROVADO|APROVADO COM RESSALVAS|BLOQUEADO",
      "ativos": [
        { "nome": "", "dose": number, "unit": "mg|mcg|UI|g", "key": "" }
      ],
      "alertas": [
        { "tipo": "err|warn|ok|info", "titulo": "", "corpo": "" }
      ],
      "analise_ia": "",
      "alegacoes_permitidas": [ "" ],
      "alegacoes_proibidas": [ "" ],
      "avisos_rotulo": [ "" ],
      "sugestao_capsulas": { "n": number, "tamanho": "#00", "frasco": number, "obs": "" }
    }
  ]
}`;

      const userMessage = `Arquivo: ${fileName} (${fileType}). Cliente: ${cliente}. Público: ${publico}.
      
CONTEÚDO EXTRAÍDO:
${fileContent}

IMPORTANTE: Analise TODOS os produtos contidos no conteúdo acima. Se o arquivo for um ZIP com vários briefings ou um documento com múltiplas fórmulas, você DEVE extrair e retornar a análise de CADA produto individualmente no array "produtos". Não resuma, não ignore e não agrupe produtos diferentes. Se houver 10 produtos, retorne 10 objetos no array "produtos".

Retorne APENAS o JSON conforme a estrutura do sistema.`;

      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ];

      // Se for imagem ou se o nome sugerir imagem, adicionar como conteúdo multimodal
      const isImage = fileType === 'image' || fileName.match(/\.(jpg|jpeg|png|webp)$/i);
      if (fileBase64 && isImage) {
        messages[1] = {
          role: 'user',
          content: [
            { type: 'text', text: userMessage },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${fileBase64}` } }
          ]
        } as any;
      }


      const aiRes = await fetch(AI_GATEWAY, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.0-flash',

          messages,
          response_format: { type: 'json_object' }
        })
      });

      if (!aiRes.ok) {
        const errorText = await aiRes.text();
        throw new Error(`ai_gateway_error: ${aiRes.status} ${errorText}`);
      }
      
      const aiData = await aiRes.json();
      const rawContent = aiData.choices[0].message.content;
      const parsed = JSON.parse(rawContent);

      return new Response(JSON.stringify(parsed), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    if (!termo || String(termo).length < 2) {
      return new Response(JSON.stringify({ erro: 'termo_invalido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    termoLog = String(termo)

    let powerBiRows: PowerBiRow[] = []
    try {
      powerBiRows = await fetchPowerBiRows()
    } catch (error) {
      console.warn('Power BI ANVISA lookup failed:', error instanceof Error ? error.message : error)
    }

    const directRows = safetyFilterRows(matchPowerBiRows(powerBiRows, String(termo)), String(termo))
    if (directRows.length > 0) {
      const resultados = directRows.map((row) => powerBiRowToResult(row, String(termo)))
      origemLog = 'powerbi_anvisa'
      encontrouLog = true
      totalLog = resultados.length
      logSearch()
      return new Response(JSON.stringify({ termo, resultados, resultado: resultados[0], origem: 'powerbi_anvisa' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Nada encontrado na base oficial — NÃO usamos IA para inferir status
    // (a IA já demonstrou alucinar: ex. "maca peruana" → "maçã" → "Concentrado de maçã").
    // Reportamos honestamente que não consta na lista oficial consultada.
    origemLog = 'sem_match'
    encontrouLog = false
    totalLog = 0
    logSearch()
    return new Response(
      JSON.stringify({
        termo,
        resultados: [],
        resultado: null,
        origem: 'powerbi_anvisa',
        variacoes_testadas: expandSearchTerms(String(termo)),
        mensagem: 'Nenhuma correspondência encontrada na lista oficial ANVISA (IN 28/2018) consultada via Power BI.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('anvisa-ai-verify error:', msg)
    origemLog = 'erro'
    logSearch()
    return new Response(JSON.stringify({ erro: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
