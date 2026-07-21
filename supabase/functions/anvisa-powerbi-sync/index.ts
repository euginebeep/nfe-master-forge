// anvisa-powerbi-sync — motor de sincronização da base ANVISA
// REESCRITO 2026-07-04: usa o Power BI OFICIAL da ANVISA ("Contituintes IN 28")
// em vez de Firecrawl. Sem chave externa (relatório público). Popula anvisa_constituintes.
// PATCH 2026-07: após upsert, emite alerta PENDENTE com delta (novos/removidos/limites/proibição).
// PATCH 4: falha alto — stack completa em anvisa_sync_history; cron 0 linhas/erro grita pra RT.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

const POWERBI_RESOURCE_KEY = '458ce16a-f74b-4e92-977a-e12e2927d746'
const POWERBI_API = 'https://wabi-brazil-south-api.analysis.windows.net'
const ANEXO_POWERBI = 'IN 28 (Power BI ANVISA)'

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

type DeltaCampo = {
  nome: string
  campo: string
  antes: string
  depois: string
}

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
    anexo_origem: ANEXO_POWERBI,
    norma_inclusao: 'IN 28/2018',
    is_proibido: false,
    ativo: true,
    sincronizado_em: new Date().toISOString(),
  }
}

type MappedRow = ReturnType<typeof mapRow>

async function sha256(texto: string): Promise<string> {
  const data = new TextEncoder().encode(texto)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function jsonStable(v: unknown): string {
  if (v == null) return ''
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function snapshotLimites(row: Record<string, unknown>) {
  return {
    limites_0_6_meses: row.limites_0_6_meses,
    limites_7_11_meses: row.limites_7_11_meses,
    limites_1_3_anos: row.limites_1_3_anos,
    limites_4_8_anos: row.limites_4_8_anos,
    limites_9_18_anos: row.limites_9_18_anos,
    limites_19_mais: row.limites_19_mais,
    limites_gestantes: row.limites_gestantes,
    limites_lactantes: row.limites_lactantes,
    is_proibido: row.is_proibido,
    ativo: row.ativo,
    restricoes_uso: row.restricoes_uso,
  }
}

function compararDeltas(
  existentes: Array<Record<string, unknown>>,
  payload: MappedRow[],
): {
  novos: string[]
  removidos: string[]
  alteracoes: DeltaCampo[]
} {
  const byKey = new Map(
    existentes
      .filter((r) => r.chave_norm)
      .map((r) => [String(r.chave_norm), r]),
  )
  const payloadKeys = new Set(payload.map((p) => p.chave_norm).filter(Boolean))

  const novos: string[] = []
  const alteracoes: DeltaCampo[] = []

  for (const p of payload) {
    const ant = byKey.get(p.chave_norm)
    if (!ant) {
      novos.push(p.nome_tecnico)
      continue
    }

    const campos: Array<[string, unknown, unknown]> = [
      ['limites_0_6_meses', ant.limites_0_6_meses, p.limites_0_6_meses],
      ['limites_7_11_meses', ant.limites_7_11_meses, p.limites_7_11_meses],
      ['limites_1_3_anos', ant.limites_1_3_anos, p.limites_1_3_anos],
      ['limites_4_8_anos', ant.limites_4_8_anos, p.limites_4_8_anos],
      ['limites_9_18_anos', ant.limites_9_18_anos, p.limites_9_18_anos],
      ['limites_19_mais', ant.limites_19_mais, p.limites_19_mais],
      ['limites_gestantes', ant.limites_gestantes, p.limites_gestantes],
      ['limites_lactantes', ant.limites_lactantes, p.limites_lactantes],
      ['is_proibido', ant.is_proibido, p.is_proibido],
      ['ativo', ant.ativo, p.ativo],
      ['restricoes_uso', ant.restricoes_uso, p.restricoes_uso],
    ]

    for (const [campo, antes, depois] of campos) {
      if (jsonStable(antes) !== jsonStable(depois)) {
        alteracoes.push({
          nome: p.nome_tecnico,
          campo,
          antes: jsonStable(antes) || '∅',
          depois: jsonStable(depois) || '∅',
        })
      }
    }
  }

  // Removidos: estavam no painel (anexo Power BI) e sumiram do payload atual
  const removidos = existentes
    .filter((r) => String(r.anexo_origem || '') === ANEXO_POWERBI)
    .filter((r) => r.chave_norm && !payloadKeys.has(String(r.chave_norm)))
    .map((r) => String(r.nome_tecnico || r.chave_norm))

  return { novos, removidos, alteracoes }
}

function montarDescricaoDelta(
  novos: string[],
  removidos: string[],
  alteracoes: DeltaCampo[],
): string {
  const linhas: string[] = [
    `Painel Power BI ANVISA — delta para revisão da RT (1 clique).`,
    `Novos: ${novos.length} | Removidos: ${removidos.length} | Campos alterados: ${alteracoes.length}`,
    '',
  ]

  if (novos.length) {
    linhas.push('➕ Novos constituintes:')
    for (const n of novos.slice(0, 40)) linhas.push(`  - ${n}`)
    if (novos.length > 40) linhas.push(`  … +${novos.length - 40} outros`)
    linhas.push('')
  }

  if (removidos.length) {
    linhas.push('➖ Removidos do painel:')
    for (const n of removidos.slice(0, 40)) linhas.push(`  - ${n}`)
    if (removidos.length > 40) linhas.push(`  … +${removidos.length - 40} outros`)
    linhas.push('')
  }

  if (alteracoes.length) {
    linhas.push('✏️ Alterações (nome + campo + antes/depois):')
    for (const a of alteracoes.slice(0, 60)) {
      linhas.push(`  - ${a.nome} | ${a.campo}: ${a.antes.slice(0, 120)} → ${a.depois.slice(0, 120)}`)
    }
    if (alteracoes.length > 60) linhas.push(`  … +${alteracoes.length - 60} outras`)
  }

  return linhas.join('\n')
}

/** Stack completa para anvisa_sync_history.erro_mensagem — sem falha calada. */
function erroStackCompleta(e: unknown): string {
  if (e instanceof Error) {
    return (e.stack && e.stack.trim()) || `${e.name}: ${e.message}`
  }
  try {
    return typeof e === 'string' ? e : JSON.stringify(e)
  } catch {
    return String(e)
  }
}

async function alertarFalhaSyncCron(
  supabase: ReturnType<typeof createClient>,
  motivo: string,
): Promise<void> {
  const { error } = await supabase.from('anvisa_alertas_normativos').insert({
    tipo: 'ATUALIZACAO',
    titulo: 'sync ANVISA falhou — base pode estar desatualizada',
    descricao:
      `O cron de sync Power BI falhou ou retornou 0 linhas.\n\n` +
      `Motivo registrado:\n${motivo.slice(0, 3500)}\n\n` +
      `A RT deve verificar anvisa_sync_history (status=erro) e a fonte oficial.`,
    norma: 'IN 28/2018',
    fonte_url: `${POWERBI_API}/public/reports/${POWERBI_RESOURCE_KEY}`,
    critico: true,
    status_revisao: 'PENDENTE',
  })
  if (error) {
    console.error('[anvisa-powerbi-sync] falha ao inserir alerta de sync cron:', error)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const startedAt = new Date().toISOString()
  console.error('[anvisa-powerbi-sync] INÍCIO', { method: req.method, startedAt })

  let histId: string | undefined
  let trigger: string | null = null
  let supabase: ReturnType<typeof createClient> | null = null

  // ── PATCH 4: try/catch no corpo inteiro — boot/fetch/auth também deixam rastro ──
  try {
    let body: Record<string, unknown> = {}
    try {
      body = await req.json()
    } catch {
      /* sem body (painel dispara sem payload) */
    }
    trigger = typeof body.trigger === 'string' ? body.trigger : null

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) {
      throw new Error('boot: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente')
    }

    supabase = createClient(supabaseUrl, serviceKey)

    // auth: painel (JWT user) ou cron (service role Bearer). verify_jwt=false no config.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error('Unauthorized: missing Bearer token')
    }

    // registra início do sync — se falhar, o catch ainda tenta insert status=erro
    const { data: hist, error: histErr } = await supabase
      .from('anvisa_sync_history')
      .insert({
        tipo: 'powerbi',
        status: 'em_andamento',
        iniciado_em: new Date().toISOString(),
        detalhes: { trigger: trigger ?? 'manual' },
      })
      .select('id')
      .single()
    if (histErr) throw histErr
    histId = hist?.id

    // Snapshot atual (antes do upsert) — base do delta
    const { data: existentes } = await supabase
      .from('anvisa_constituintes')
      .select(
        'chave_norm, nome_tecnico, anexo_origem, is_proibido, ativo, restricoes_uso, ' +
          'limites_0_6_meses, limites_7_11_meses, limites_1_3_anos, limites_4_8_anos, ' +
          'limites_9_18_anos, limites_19_mais, limites_gestantes, limites_lactantes',
      )

    const rows = await fetchPowerBiRows()
    if (!rows.length) {
      // cron: alerta PENDENTE explícito; histórico fica no catch abaixo
      throw new Error('powerbi_sem_dados: consulta retornou 0 linhas')
    }

    const mapped = rows.map(mapRow)
    // dedupe por chave_norm (o Power BI pode repetir o nome do constituinte) — last-wins
    const seen = new Map<string, MappedRow>()
    for (const p of mapped) if (p.chave_norm) seen.set(p.chave_norm, p)
    const payload = Array.from(seen.values())

    const { novos: nomesNovos, removidos: nomesRemovidos, alteracoes } = compararDeltas(
      (existentes ?? []) as Array<Record<string, unknown>>,
      payload,
    )

    // Hash estável do conteúdo relevante (para o monitor diário comparar)
    const hashPayload = await sha256(
      JSON.stringify(
        payload
          .map((p) => ({ k: p.chave_norm, s: snapshotLimites(p as unknown as Record<string, unknown>) }))
          .sort((a, b) => a.k.localeCompare(b.k)),
      ),
    )

    // Última execução com sucesso (antes desta) — compara hash
    let syncAnteriorQuery = supabase
      .from('anvisa_sync_history')
      .select('id, hash_conteudo')
      .eq('tipo', 'powerbi')
      .eq('status', 'sucesso')
      .order('finalizado_em', { ascending: false })
      .limit(1)
    if (histId) syncAnteriorQuery = syncAnteriorQuery.neq('id', histId)
    const { data: syncAnterior } = await syncAnteriorQuery.maybeSingle()

    const hashMudou =
      Boolean(syncAnterior?.hash_conteudo) && syncAnterior!.hash_conteudo !== hashPayload

    // upsert por chave_norm — NÃO inclui homologado/homologado_por/em (preserva flags da RT)
    const { error: upErr } = await supabase
      .from('anvisa_constituintes')
      .upsert(payload, { onConflict: 'chave_norm' })
    if (upErr) throw upErr

    const registrosNovos = nomesNovos.length
    const registrosRemovidos = nomesRemovidos.length
    const registrosAtualizados = alteracoes.length
      ? new Set(alteracoes.map((a) => a.nome)).size
      : 0

    if (histId) {
      await supabase.from('anvisa_sync_history').update({
        status: 'sucesso',
        registros_novos: registrosNovos,
        registros_removidos: registrosRemovidos,
        registros_atualizados: registrosAtualizados,
        hash_conteudo: hashPayload,
        fonte_url: `${POWERBI_API}/public/reports/${POWERBI_RESOURCE_KEY}`,
        versao_legislacao: 'IN 28 (Power BI oficial)',
        finalizado_em: new Date().toISOString(),
        detalhes: {
          trigger: trigger ?? 'manual',
          total_linhas: payload.length,
          hash_anterior: syncAnterior?.hash_conteudo ?? null,
          hash_mudou: hashMudou,
          novos_sample: nomesNovos.slice(0, 20),
          removidos_sample: nomesRemovidos.slice(0, 20),
          alteracoes_sample: alteracoes.slice(0, 30),
        },
      }).eq('id', histId)
    }

    // ── PATCH 3: grito na ingestão — alerta PENDENTE com delta por constituinte ──
    const houveDelta =
      registrosNovos > 0 ||
      registrosRemovidos > 0 ||
      alteracoes.length > 0 ||
      hashMudou

    if (houveDelta) {
      const titulo = 'Painel ANVISA (Power BI) — delta para revisão da RT'
      const descricao = montarDescricaoDelta(nomesNovos, nomesRemovidos, alteracoes)
      const afetados = [
        ...nomesNovos,
        ...nomesRemovidos,
        ...alteracoes.map((a) => a.nome),
      ]
      const afetadosUnicos = [...new Set(afetados)].slice(0, 100)

      const { error: alertErr } = await supabase.from('anvisa_alertas_normativos').insert({
        tipo: alteracoes.some((a) => a.campo === 'is_proibido' || a.campo.startsWith('limites_'))
          ? 'ALTERACAO_LIMITE'
          : 'ATUALIZACAO',
        titulo,
        descricao,
        norma: 'IN 28/2018',
        constituintes_afetados: afetadosUnicos.length ? afetadosUnicos : null,
        fonte_url: `${POWERBI_API}/public/reports/${POWERBI_RESOURCE_KEY}`,
        critico: true,
        status_revisao: 'PENDENTE',
      })

      if (alertErr) {
        // Não derruba o sync se o alerta falhar
        console.error('anvisa-powerbi-sync: falha ao inserir alerta normativo:', alertErr)
      } else {
        console.log(
          `anvisa-powerbi-sync: alerta PENDENTE emitido (novos=${registrosNovos}, ` +
            `removidos=${registrosRemovidos}, alteracoes=${alteracoes.length})`,
        )
      }
    }

    console.error('[anvisa-powerbi-sync] FIM ok', {
      histId,
      trigger,
      total: payload.length,
      novos: registrosNovos,
      removidos: registrosRemovidos,
      startedAt,
      finishedAt: new Date().toISOString(),
    })

    return new Response(JSON.stringify({
      ok: true,
      total: payload.length,
      novos: registrosNovos,
      removidos: registrosRemovidos,
      atualizados: registrosAtualizados,
      hash_conteudo: hashPayload,
      alerta_emitido: houveDelta,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    const stack = erroStackCompleta(e)
    console.error('[anvisa-powerbi-sync] FIM erro', {
      histId,
      trigger,
      startedAt,
      finishedAt: new Date().toISOString(),
      stack,
    })

    // Sempre deixa rastro em anvisa_sync_history (update ou insert se boot falhou antes)
    try {
      if (!supabase) {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')
        const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
        if (supabaseUrl && serviceKey) {
          supabase = createClient(supabaseUrl, serviceKey)
        }
      }

      if (supabase) {
        if (histId) {
          await supabase.from('anvisa_sync_history').update({
            status: 'erro',
            erro_mensagem: stack,
            finalizado_em: new Date().toISOString(),
            detalhes: { trigger: trigger ?? 'manual', falha_alto: true },
          }).eq('id', histId)
        } else {
          await supabase.from('anvisa_sync_history').insert({
            tipo: 'powerbi',
            status: 'erro',
            erro_mensagem: stack,
            iniciado_em: startedAt,
            finalizado_em: new Date().toISOString(),
            detalhes: { trigger: trigger ?? 'manual', falha_alto: true, fase: 'boot_ou_pre_hist' },
          })
        }

        // Cron: RT precisa saber que a fonte parou (0 linhas ou qualquer erro)
        if (trigger === 'cron') {
          await alertarFalhaSyncCron(supabase, stack)
        }
      } else {
        console.error(
          '[anvisa-powerbi-sync] impossível gravar histórico: cliente Supabase indisponível',
        )
      }
    } catch (logErr) {
      console.error('[anvisa-powerbi-sync] falha ao registrar erro em sync_history/alerta:', logErr)
    }

    const status = String(e).includes('Unauthorized') ? 401 : 500
    return new Response(JSON.stringify({ ok: false, error: stack }), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
