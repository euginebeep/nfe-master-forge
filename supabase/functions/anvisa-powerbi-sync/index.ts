// anvisa-powerbi-sync — motor de sincronização da base ANVISA
// REESCRITO 2026-07-04: usa o Power BI OFICIAL da ANVISA ("Contituintes IN 28")
// em vez de Firecrawl. Sem chave externa (relatório público). Popula anvisa_constituintes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

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

const normalize = (value: unknown) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

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
    const row = Object.fromEntries(
      POWERBI_FIELDS.map((field, index) => [field, values[index] ?? null]),
    ) as PowerBiRow
    if (row['Constituintes Autorizados']) rows.push(row)
  }
  return rows
}

async function fetchPowerBiRows(): Promise<PowerBiRow[]> {
  const headers = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ActivityId: crypto.randomUUID(),
    RequestId: crypto.randomUUID(),
    'X-PowerBI-ResourceKey': POWERBI_RESOURCE_KEY,
    Referer: 'https://app.powerbi.com/',
  }

  const metaResponse = await fetch(
    `${POWERBI_API}/public/reports/${POWERBI_RESOURCE_KEY}/modelsAndExploration?preferReadOnlySession=true`,
    { headers },
  )
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
  return decodePowerBiRows(await queryResponse.json())
}

const arr = (v: string | null) => (v && v.trim() ? [v.trim()] : [])
const jbo = (v: string | null) => (v && v.trim() ? { texto: v.trim() } : null)

function mapRow(row: PowerBiRow) {
  const nome = (row['Constituintes Autorizados'] || '').trim()
  return {
    chave_norm: normalize(nome),
    nome_tecnico: nome,
    nome_rotulo: nome,
    categoria: row['Categoria']?.trim() || 'Não classificado',
    subcategoria: row['Nutriente/Substância Bioativa/Enzima']?.trim() || null,
    fonte_de: row['Função']?.trim() || null,
    cas_number: row['CAS']?.trim() || null,
    limites_0_6_meses: jbo(row['0 a 6 meses']),
    limites_7_11_meses: jbo(row['7 a 11 meses']),
    limites_1_3_anos: jbo(row['1 a 3 anos']),
    limites_4_8_anos: jbo(row['4 a 8 anos ']),
    limites_9_18_anos: jbo(row['9 a 18 anos']),
    limites_19_mais: jbo(row['Maiores 19 anos ']),
    limites_gestantes: jbo(row['Gestantes ']),
    limites_lactantes: jbo(row['Lactantes']),
    alegacoes: arr(row['Alegações autorizadas e requisitos para uso da alegação']),
    rotulagem_complementar: arr(row['Requisitos de Rotulagem Complementar e outros']),
    advertencias: arr(row['Observações']),
    referencias_especificacao: arr(row['Especificações']),
    restricoes_uso: row['Outras Informações']?.trim() || null,
    fonte_url: row['Link de acesso a especificações publicadas']?.trim() || null,
    anexo_origem: 'IN 28 (Power BI ANVISA)',
    norma_inclusao: 'IN 28/2018',
    is_proibido: false,
    ativo: true,
    sincronizado_em: new Date().toISOString(),
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // auth: exige usuário autenticado (disparado pelo painel)
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // registra início do sync
  const { data: hist } = await supabase
    .from('anvisa_sync_history')
    .insert({ tipo: 'powerbi', status: 'em_andamento', iniciado_em: new Date().toISOString() })
    .select('id')
    .single()
  const histId = hist?.id

  try {
    const { count: antes } = await supabase
      .from('anvisa_constituintes')
      .select('*', { count: 'exact', head: true })

    const rows = await fetchPowerBiRows()
    if (!rows.length) throw new Error('powerbi_sem_dados: consulta retornou 0 linhas')

    const mapped = rows.map(mapRow)
    // dedupe por chave_norm (o Power BI pode repetir o nome do constituinte) — last-wins
    const seen = new Map<string, ReturnType<typeof mapRow>>()
    for (const p of mapped) if (p.chave_norm) seen.set(p.chave_norm, p)
    const payload = Array.from(seen.values())
    // upsert por chave_norm — NÃO inclui homologado/homologado_por/em (preserva flags da RT)
    const { error: upErr } = await supabase
      .from('anvisa_constituintes')
      .upsert(payload, { onConflict: 'chave_norm' })
    if (upErr) throw upErr

    const { count: depois } = await supabase
      .from('anvisa_constituintes')
      .select('*', { count: 'exact', head: true })

    const novos = Math.max(0, (depois || 0) - (antes || 0))
    const atualizados = payload.length - novos

    if (histId) {
      await supabase.from('anvisa_sync_history').update({
        status: 'sucesso',
        registros_novos: novos,
        registros_atualizados: atualizados,
        fonte_url: `${POWERBI_API}/public/reports/${POWERBI_RESOURCE_KEY}`,
        versao_legislacao: 'IN 28 (Power BI oficial)',
        finalizado_em: new Date().toISOString(),
        detalhes: { total_linhas: payload.length },
      }).eq('id', histId)
    }

    return new Response(JSON.stringify({
      ok: true, total: payload.length, novos, atualizados,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const anyE = e as any
    const msg = e instanceof Error ? e.message
      : (anyE?.message || anyE?.hint || anyE?.details || anyE?.code || JSON.stringify(anyE))
    if (histId) {
      await supabase.from('anvisa_sync_history').update({
        status: 'erro', erro_mensagem: msg, finalizado_em: new Date().toISOString(),
      }).eq('id', histId)
    }
    console.error('anvisa-powerbi-sync erro:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
