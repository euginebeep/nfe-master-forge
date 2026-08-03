/**
 * Edge Function: monitor-anvisa-diario
 *
 * Cron diário — monitora fontes ANVISA e detecta mudanças.
 * REGRA ABSOLUTA: só detecta e alerta — NUNCA publica automaticamente.
 * Toda mudança fica com status_revisao = 'PENDENTE' até aprovação humana.
 *
 * Correções 02/08/2026 (CURSOR_MONITOR_LEGISLACAO):
 * T1 — fontes ativas vêm de legislacao_monitor_config (não lista fixa)
 * T2 — falha de fetch ≠ mudança (nunca anvisa_alertas_normativos)
 * T3 — DataLegis decodificado como ISO-8859-1 (não resp.text())
 * T4 — endpoints DOU via /consulta/-/buscar (config no banco; não reativar leiturajornal)
 * T5 — ao fim, ler v_legislacao_monitor_saude → alerta de infraestrutura
 *
 * status_revisao ∈ PENDENTE | APROVADO | DESCARTADO — nunca 'revisado'.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MIN_CHARS_VALIDOS = 2000;

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface FonteConfig {
  fonte: string;
  url: string;
  metodo: string | null;
  alvo: string | null;
  ativo: boolean;
  motivo_inativa: string | null;
  deve_variar: boolean | null;
  dias_max_congelado: number | null;
}

interface FonteMonitorada {
  id: string;
  url: string;
  descricao: string;
  metodo: string;
  /** DataLegis serve ISO-8859-1 — não usar resp.text() */
  decodificarIso88591: boolean;
  filtro?: string;
  retryAcesso: boolean;
}

/** Payload acumulado para o grito (send-anvisa-alert) — só mudança normativa */
interface AlertaAcumulado {
  title: string;
  type: string;
  message: string;
  severity: "critical" | "warning";
  status_revisao: "PENDENTE";
  fonte?: string;
  affectedProducts?: string[];
}

interface ResultadoFonte {
  fonte: string;
  mudanca: boolean;
  status: string;
  mensagem: string;
}

/** Fontes cuja mudança gera alerta critico=true. Notícias = warning (rebaixado). */
const FONTES_ALERTA_CRITICO = new Set([
  "ANVISALEGIS_IN28",
  "DOU_IN211",
  "DOU_RDC_SUPLEMENTOS",
  "DOU_CONSULTAS_PUBLICAS",
  "DOU_RESOLUCOES_RE",
  "PAINEL_CONSTITUINTES",
  "INGREDIENTES_ANVISA",
]);

/** Fallback mínimo se a tabela de config ainda não existir neste ambiente. */
const FONTES_FALLBACK: FonteConfig[] = [
  {
    fonte: "ANVISALEGIS_IN28",
    url: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=INM&numeroAto=00000028&seqAto=000&valorAno=2018&orgao=DC%2FANVISA%2FMS&cod_menu=1696&cod_modulo=134&pesquisa=true",
    metodo: "hash_html",
    alvo: "ANVISALegis — IN 28/2018 consolidada",
    ativo: true,
    motivo_inativa: null,
    deve_variar: true,
    dias_max_congelado: 30,
  },
  {
    fonte: "NOTICIAS_ANVISA",
    url: "https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa",
    metodo: "hash_html",
    alvo: "Notícias ANVISA — filtro: suplemento",
    ativo: true,
    motivo_inativa: null,
    deve_variar: true,
    dias_max_congelado: 7,
  },
  {
    fonte: "INGREDIENTES_ANVISA",
    url: "https://www.gov.br/anvisa/pt-br/assuntos/alimentos/ingredientes",
    metodo: "hash_html",
    alvo: "Página de Ingredientes/REs",
    ativo: true,
    motivo_inativa: null,
    deve_variar: true,
    dias_max_congelado: 30,
  },
  {
    fonte: "DOU_RESOLUCOES_RE",
    url: "https://www.in.gov.br/consulta/-/buscar/dou?q=suplemento+alimentar+resolucao+RE&s=do1",
    metodo: "hash_html",
    alvo: "DOU — Resoluções-RE",
    ativo: true,
    motivo_inativa: null,
    deve_variar: true,
    dias_max_congelado: 3,
  },
  {
    fonte: "DOU_IN211",
    url: 'https://www.in.gov.br/consulta/-/buscar/dou?q=%22Instru%C3%A7%C3%A3o%20Normativa%22%20%22IN%20n%C2%BA%20211%22%20aditivos&s=do1',
    metodo: "hash_html",
    alvo: "DOU — IN 211 e alteradoras",
    ativo: true,
    motivo_inativa: null,
    deve_variar: true,
    dias_max_congelado: 3,
  },
  {
    fonte: "DOU_RDC_SUPLEMENTOS",
    url: 'https://www.in.gov.br/consulta/-/buscar/dou?q=%22Resolu%C3%A7%C3%A3o%20da%20Diretoria%20Colegiada%22%20suplemento%20alimentar&s=do1',
    metodo: "hash_html",
    alvo: "DOU — RDCs de suplementos",
    ativo: true,
    motivo_inativa: null,
    deve_variar: true,
    dias_max_congelado: 3,
  },
  {
    fonte: "DOU_CONSULTAS_PUBLICAS",
    url: 'https://www.in.gov.br/consulta/-/buscar/dou?q=%22Consulta%20P%C3%BAblica%22%20anvisa%20suplemento&s=do1',
    metodo: "hash_html",
    alvo: "DOU — Consultas Públicas ANVISA",
    ativo: true,
    motivo_inativa: null,
    deve_variar: true,
    dias_max_congelado: 3,
  },
  {
    fonte: "PAINEL_CONSTITUINTES",
    url: "https://www.gov.br/anvisa/pt-br/assuntos/alimentos/paineis-de-consulta-de-alimentos",
    metodo: "powerbi_sync",
    alvo: "Painel de Constituintes (via anvisa_sync_history)",
    ativo: true,
    motivo_inativa: null,
    deve_variar: true,
    dias_max_congelado: 30,
  },
];

function configParaFonte(row: FonteConfig): FonteMonitorada {
  const url = String(row.url || "");
  const isDatalegis = /datalegis/i.test(url);
  const isDouBusca = /in\.gov\.br\/consulta/i.test(url);
  const isLeiturasJornal = /leiturajornal/i.test(url);
  const metodo = String(row.metodo || "hash_html").toLowerCase();

  // T4: nunca buscar /leiturajornal — hash congelado (casca JS).
  if (isLeiturasJornal) {
    throw new Error(
      `${row.fonte}: URL /leiturajornal é casca JS — use /consulta/-/buscar/dou (fonte deveria estar inativa)`,
    );
  }

  let filtro: string | undefined;
  if (/noticias/i.test(row.fonte) || /noticias/i.test(url)) filtro = "suplemento";
  else if (/ingredientes/i.test(row.fonte)) filtro = "suplemento";
  else if (isDouBusca) filtro = undefined; // query já está na URL

  return {
    id: row.fonte,
    url,
    descricao: row.alvo || row.fonte,
    metodo,
    decodificarIso88591: isDatalegis,
    filtro,
    retryAcesso: isDouBusca || /ingredientes/i.test(row.fonte),
  };
}

async function carregarFontesAtivas(supabase: SupabaseClient): Promise<FonteMonitorada[]> {
  const { data, error } = await supabase
    .from("legislacao_monitor_config")
    .select(
      "fonte, url, metodo, alvo, ativo, motivo_inativa, deve_variar, dias_max_congelado",
    )
    .eq("ativo", true);

  if (error) {
    console.warn(
      "[monitor-anvisa-diario] legislacao_monitor_config indisponível — fallback embutido:",
      error.message,
    );
    return FONTES_FALLBACK.filter((f) => f.ativo).map(configParaFonte);
  }

  const rows = (data ?? []) as FonteConfig[];
  if (rows.length === 0) {
    console.warn("[monitor-anvisa-diario] config vazia — fallback embutido");
    return FONTES_FALLBACK.filter((f) => f.ativo).map(configParaFonte);
  }

  const fontes: FonteMonitorada[] = [];
  for (const row of rows) {
    try {
      fontes.push(configParaFonte(row));
    } catch (e) {
      console.error(`[monitor-anvisa-diario] fonte ${row.fonte} ignorada:`, e);
    }
  }
  return fontes;
}

async function sha256(texto: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** T3: DataLegis = ISO-8859-1. Nunca confiar em resp.text() (UTF-8). */
async function decodificarResposta(resp: Response, iso88591: boolean): Promise<string> {
  const buffer = await resp.arrayBuffer();
  const headerCs = resp.headers.get("content-type")?.match(/charset=([^\s;]+)/i)?.[1];
  let charset = iso88591 ? "iso-8859-1" : "utf-8";
  if (headerCs) {
    const h = headerCs.toLowerCase().replace(/['"]/g, "");
    if (h.includes("8859-1") || h === "latin1" || h === "iso-8859-1") {
      charset = "iso-8859-1";
    } else if (h.includes("utf-8")) {
      charset = iso88591 ? "iso-8859-1" : "utf-8"; // DataLegis mentirosa → forçar ISO
    }
  }
  return new TextDecoder(charset).decode(buffer);
}

function temEncodingQuebrado(texto: string): boolean {
  return texto.includes("Ã§") || texto.includes("Ã£") || texto.includes("Ã©");
}

function validarConteudoFonte(
  texto: string,
  exigeMarcador?: string,
): { ok: true } | { ok: false; motivo: string } {
  if (temEncodingQuebrado(texto)) {
    return {
      ok: false,
      motivo: "Encoding inválido (mojibake Ã§/Ã£ — esperado ISO-8859-1 no Datalegis)",
    };
  }
  if (texto.length < MIN_CHARS_VALIDOS) {
    return {
      ok: false,
      motivo: `Conteúdo muito curto (${texto.length} chars, mínimo ${MIN_CHARS_VALIDOS})`,
    };
  }
  if (exigeMarcador && !texto.toLowerCase().includes(exigeMarcador.toLowerCase())) {
    return { ok: false, motivo: `Marcador obrigatório "${exigeMarcador}" não encontrado` };
  }
  return { ok: true };
}

function extrairTextoRelevante(html: string, filtro?: string): string {
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  if (!filtro) return texto.slice(0, 5000);

  const palavras = filtro.toLowerCase().split(" ");
  const linhas = texto.split(/[.!?]\s+/);
  const relevantes = linhas.filter((l) =>
    palavras.some((p) => l.toLowerCase().includes(p))
  );

  return relevantes.slice(0, 50).join(". ").slice(0, 5000);
}

function extrairEmailDeFrom(from: string): string | null {
  const m = from.match(/<([^>]+)>/);
  if (m?.[1]) return m[1].trim();
  const bare = from.trim();
  return bare.includes("@") ? bare : null;
}

async function resolverEmailRT(
  supabase: SupabaseClient,
): Promise<{ to: string; viaFallback: boolean }> {
  const { data: rts } = await supabase
    .from("responsaveis_tecnicos")
    .select("email, nome_completo, company_id")
    .eq("status", "ATIVO")
    .not("email", "is", null)
    .order("validade_registro", { ascending: false })
    .limit(20);

  const emails = [
    ...new Set(
      (rts ?? [])
        .map((r) => String(r.email || "").trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  ];

  if (emails.length > 0) {
    return { to: emails[0], viaFallback: false };
  }

  const { data: companies } = await supabase
    .from("company")
    .select("email_fiscal, email_financeiro")
    .limit(5);

  for (const c of companies ?? []) {
    for (const cand of [c.email_fiscal, c.email_financeiro]) {
      const e = String(cand || "").trim();
      if (e.includes("@")) return { to: e, viaFallback: false };
    }
  }

  const fallbackRaw = (Deno.env.get("RESEND_DEFAULT_FROM") || "").trim();
  const fallback = extrairEmailDeFrom(fallbackRaw) || fallbackRaw;
  if (fallback.includes("@")) {
    console.warn(
      "[monitor-anvisa-diario] RT sem e-mail — RESEND_DEFAULT_FROM:",
      fallback,
    );
    return { to: fallback, viaFallback: true };
  }

  throw new Error(
    "Sem e-mail da RT (responsaveis_tecnicos.email) e sem RESEND_DEFAULT_FROM",
  );
}

/**
 * T2: falha de infraestrutura — mudanca_detectada=false, hash_novo=null.
 * NUNCA grava em anvisa_alertas_normativos.
 */
async function registrarFalhaInfra(
  supabase: SupabaseClient,
  fonte: FonteMonitorada,
  motivo: string,
): Promise<void> {
  const resumo = `FALHA_INFRA: ${motivo}`.slice(0, 500);
  const row: Record<string, unknown> = {
    fonte_monitorada: fonte.id,
    url: fonte.url,
    hash_anterior: null,
    hash_novo: null,
    mudanca_detectada: false,
    resumo_mudanca: resumo,
    status_revisao: "PENDENTE",
  };
  // Coluna erro pode existir (migration recente) — tentar; se falhar, sem ela.
  const comErro = { ...row, erro: String(motivo).slice(0, 1000) };
  const { error } = await supabase.from("legislacao_monitoramento").insert(comErro);
  if (error) {
    const { error: e2 } = await supabase.from("legislacao_monitoramento").insert(row);
    if (e2) {
      console.error(`[monitor-anvisa-diario] falha ao registrar infra ${fonte.id}:`, e2);
    }
  }
  console.warn(`[monitor-anvisa-diario] FALHA_INFRA ${fonte.id}: ${motivo}`);
}

async function sinalizarRehomologacaoIn28(
  supabase: SupabaseClient,
  resumo: string | null,
): Promise<string[]> {
  const { data: homologados } = await supabase
    .from("anvisa_constituintes")
    .select("id, nome_tecnico")
    .eq("homologado", true)
    .eq("ativo", true);

  const nomes = (homologados ?? []).map((c) => c.nome_tecnico as string);
  if (!homologados?.length) return [];

  const motivo =
    `Possível alteração na IN 28/2018 detectada pelo monitor. ` +
    `Reconfirmar limites/alegações. ${resumo ? `Resumo: ${resumo.slice(0, 200)}` : ""}`;

  await supabase
    .from("anvisa_constituintes")
    .update({
      requer_rehomologacao: true,
      requer_rehomologacao_motivo: motivo.slice(0, 500),
      requer_rehomologacao_em: new Date().toISOString(),
    })
    .eq("homologado", true)
    .eq("ativo", true);

  return nomes;
}

async function registrarAlertaMudanca(
  supabase: SupabaseClient,
  fonte: FonteMonitorada,
  resumo: string | null,
  monitoramentoId: string | null,
  constituintesAfetados: string[],
  alertasNovos: AlertaAcumulado[],
): Promise<void> {
  const isIn28 = fonte.id === "ANVISALEGIS_IN28";
  const titulo = `Mudança detectada: ${fonte.id}`;
  const descricao =
    (resumo ||
      `Alteração de conteúdo em ${fonte.descricao}. Revisar antes de qualquer ação na base.`) +
    (constituintesAfetados.length
      ? `\n\nConstituintes homologados que podem precisar de re-homologação (${constituintesAfetados.length}): ${
        constituintesAfetados.slice(0, 30).join("; ")
      }${constituintesAfetados.length > 30 ? "…" : ""}`
      : "\n\nNenhum constituinte homologado no momento — apenas revisar a fonte.");

  const critico = FONTES_ALERTA_CRITICO.has(fonte.id);
  await supabase.from("anvisa_alertas_normativos").insert({
    tipo: isIn28 ? "ALTERACAO_LIMITE" : "ATUALIZACAO",
    titulo,
    descricao,
    norma: isIn28 ? "IN 28/2018" : fonte.id,
    constituintes_afetados: constituintesAfetados.length ? constituintesAfetados : null,
    fonte_url: fonte.url,
    critico,
    status_revisao: "PENDENTE",
    monitoramento_id: monitoramentoId,
  });

  alertasNovos.push({
    title: titulo,
    type: isIn28 ? "ALTERACAO_LIMITE" : "ATUALIZACAO",
    message: descricao,
    severity: critico ? "critical" : "warning",
    status_revisao: "PENDENTE",
    fonte: fonte.id,
    affectedProducts: constituintesAfetados.length ? constituintesAfetados.slice(0, 50) : undefined,
  });
}

async function baixarFonteHtml(
  fonte: FonteMonitorada,
): Promise<{ html: string; bytes: number; userAgent: string; iso: boolean }> {
  const tentativas: Array<{ ua: string; iso: boolean; label: string }> = [
    {
      ua: "BrainXERP-Monitor/1.0 (regulatorio@brainxerp.com)",
      iso: fonte.decodificarIso88591,
      label: "default",
    },
  ];

  if (fonte.retryAcesso) {
    tentativas.push(
      { ua: BROWSER_UA, iso: false, label: "browser-ua" },
      { ua: BROWSER_UA, iso: fonte.decodificarIso88591, label: "browser-ua+charset" },
    );
  } else if (fonte.decodificarIso88591) {
    // DataLegis: segunda tentativa explícita ISO se a primeira falhar encoding
    tentativas.push({ ua: BROWSER_UA, iso: true, label: "browser-ua+iso88591" });
  }

  let ultimoErro = "sem resposta";
  for (const t of tentativas) {
    const resp = await fetch(fonte.url, {
      headers: {
        "User-Agent": t.ua,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
      signal: AbortSignal.timeout(20000),
      redirect: "follow",
    });

    if (!resp.ok) {
      ultimoErro = `HTTP ${resp.status} (${t.label})`;
      console.warn(`[monitor-anvisa-diario] ${fonte.id}: ${ultimoErro}`);
      continue;
    }

    const html = await decodificarResposta(resp, t.iso);
    console.log(
      `[monitor-anvisa-diario] ${fonte.id}: ${html.length} chars (tentativa ${t.label}, iso=${t.iso})`,
    );

    const marcador = fonte.id === "ANVISALEGIS_IN28" ? "constituinte" : undefined;
    const validacao = validarConteudoFonte(html, marcador);
    if (validacao.ok) {
      return { html, bytes: html.length, userAgent: t.ua, iso: t.iso };
    }

    ultimoErro = validacao.motivo;
    if (!fonte.retryAcesso && !fonte.decodificarIso88591) {
      throw new Error(validacao.motivo);
    }
    console.warn(
      `[monitor-anvisa-diario] ${fonte.id}: tentativa ${t.label} falhou (${validacao.motivo})`,
    );
  }

  throw new Error(ultimoErro);
}

async function monitorarPainelViaSyncHistory(
  supabase: SupabaseClient,
  fonte: FonteMonitorada,
  alertasNovos: AlertaAcumulado[],
  resultados: ResultadoFonte[],
): Promise<void> {
  try {
    const { data: syncs, error } = await supabase
      .from("anvisa_sync_history")
      .select(
        "id, registros_novos, registros_removidos, hash_conteudo, finalizado_em, detalhes, status",
      )
      .eq("tipo", "powerbi")
      .eq("status", "sucesso")
      .order("finalizado_em", { ascending: false })
      .limit(2);

    if (error) throw error;

    const [ultimo, anterior] = syncs ?? [];
    if (!ultimo) {
      resultados.push({
        fonte: fonte.id,
        mudanca: false,
        status: "SEM_SYNC",
        mensagem: "Nenhum sync Power BI com sucesso ainda — painel não comparado.",
      });
      return;
    }

    const novos = Number(ultimo.registros_novos ?? 0);
    const removidos = Number(ultimo.registros_removidos ?? 0);
    const hashUltimo = ultimo.hash_conteudo || null;
    const hashAnteriorSync = anterior?.hash_conteudo || null;
    const hashDiferente =
      Boolean(hashUltimo) && Boolean(hashAnteriorSync) && hashUltimo !== hashAnteriorSync;
    const mudouPainel = novos > 0 || removidos > 0 || hashDiferente;

    const hashMonitor = hashUltimo || `powerbi:${ultimo.id}:n${novos}:r${removidos}`;

    const { data: ultimoMon } = await supabase
      .from("legislacao_monitoramento")
      .select("hash_novo, id")
      .eq("fonte_monitorada", fonte.id)
      .not("hash_novo", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const jaProcessado = ultimoMon?.hash_novo === hashMonitor;
    const mudancaDetectada = mudouPainel && !jaProcessado;

    const resumoMudanca = mudancaDetectada
      ? `Painel ANVISA mudou: ${novos} novos, ${removidos} removidos` +
        (hashDiferente ? " (hash_conteudo diferente do sync anterior)" : "")
      : null;

    const { data: monRow } = await supabase
      .from("legislacao_monitoramento")
      .insert({
        fonte_monitorada: fonte.id,
        url: fonte.url,
        hash_anterior: ultimoMon?.hash_novo ?? hashAnteriorSync,
        hash_novo: hashMonitor,
        mudanca_detectada: mudancaDetectada,
        resumo_mudanca: resumoMudanca,
        status_revisao: "PENDENTE",
      })
      .select("id")
      .single();

    if (mudancaDetectada) {
      await registrarAlertaMudanca(
        supabase,
        fonte,
        resumoMudanca,
        monRow?.id ?? null,
        [],
        alertasNovos,
      );
    }

    resultados.push({
      fonte: fonte.id,
      mudanca: mudancaDetectada,
      status: mudancaDetectada
        ? "MUDANÇA_DETECTADA"
        : jaProcessado
        ? "JA_PROCESSADO"
        : "SEM_MUDANÇA",
      mensagem: mudancaDetectada
        ? `⚠️ ${resumoMudanca}`
        : `✓ Painel sem delta novo (novos=${novos}, removidos=${removidos}).`,
    });
  } catch (e) {
    console.error("[monitor-anvisa-diario] PAINEL via sync history:", e);
    await registrarFalhaInfra(supabase, fonte, String(e));
    resultados.push({
      fonte: fonte.id,
      mudanca: false,
      status: "FALHA_INFRA",
      mensagem: String(e),
    });
  }
}

async function monitorarFonteHtml(
  supabase: SupabaseClient,
  openai: OpenAI,
  fonte: FonteMonitorada,
  alertasNovos: AlertaAcumulado[],
  resultados: ResultadoFonte[],
): Promise<void> {
  try {
    let html: string;
    try {
      const baixado = await baixarFonteHtml(fonte);
      html = baixado.html;
      console.log(`[monitor-anvisa-diario] ${fonte.id}: tamanho real=${baixado.bytes} chars`);
    } catch (acessoErr) {
      const motivo = String(acessoErr);
      await registrarFalhaInfra(supabase, fonte, motivo);
      resultados.push({
        fonte: fonte.id,
        mudanca: false,
        status: "FALHA_INFRA",
        mensagem: `fonte inacessível: ${motivo}`,
      });
      return;
    }

    const textoRelevante = extrairTextoRelevante(html, fonte.filtro);
    const hashNovo = await sha256(textoRelevante);

    const { data: ultimoRegistro } = await supabase
      .from("legislacao_monitoramento")
      .select("hash_novo, id")
      .eq("fonte_monitorada", fonte.id)
      .not("hash_novo", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const hashAnterior = ultimoRegistro?.hash_novo || null;
    const mudancaDetectada = hashAnterior !== null && hashAnterior !== hashNovo;

    let resumoMudanca: string | null = null;
    if (mudancaDetectada && textoRelevante.length > 100) {
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0,
          max_tokens: 300,
          messages: [
            {
              role: "system",
              content:
                "Você é um assistente que resume mudanças em legislação ANVISA para suplementos alimentares. Seja objetivo e cite apenas o que mudou. AVISO: este resumo será revisado por um humano antes de qualquer ação.",
            },
            {
              role: "user",
              content:
                `Detectei uma mudança no conteúdo de: ${fonte.descricao}\n\nTrecho relevante atual:\n${
                  textoRelevante.slice(0, 2000)
                }\n\nResuma em 2-3 frases o que pode ter mudado, com base no contexto.`,
            },
          ],
        });
        resumoMudanca = completion.choices[0].message.content || null;
      } catch {
        resumoMudanca = "Resumo automático indisponível — revisar manualmente.";
      }
    }

    const { data: monRow } = await supabase
      .from("legislacao_monitoramento")
      .insert({
        fonte_monitorada: fonte.id,
        url: fonte.url,
        hash_anterior: hashAnterior,
        hash_novo: hashNovo,
        mudanca_detectada: mudancaDetectada,
        resumo_mudanca: resumoMudanca,
        status_revisao: "PENDENTE",
      })
      .select("id")
      .single();

    if (mudancaDetectada) {
      let afetados: string[] = [];
      if (fonte.id === "ANVISALEGIS_IN28") {
        afetados = await sinalizarRehomologacaoIn28(supabase, resumoMudanca);
      }
      await registrarAlertaMudanca(
        supabase,
        fonte,
        resumoMudanca,
        monRow?.id ?? null,
        afetados,
        alertasNovos,
      );
    }

    resultados.push({
      fonte: fonte.id,
      mudanca: mudancaDetectada,
      status: mudancaDetectada ? "MUDANÇA_DETECTADA" : "SEM_MUDANÇA",
      mensagem: mudancaDetectada
        ? `⚠️ Mudança detectada em ${fonte.descricao}. Aguardando revisão humana.`
        : `✓ Sem alterações em ${fonte.descricao}.`,
    });
  } catch (fonteErr) {
    const motivo = String(fonteErr);
    console.error(`Erro ao monitorar ${fonte.id}:`, fonteErr);
    await registrarFalhaInfra(supabase, fonte, motivo);
    resultados.push({
      fonte: fonte.id,
      mudanca: false,
      status: "FALHA_INFRA",
      mensagem: `fonte inacessível: ${motivo}`,
    });
  }
}

/**
 * T5: consumir v_legislacao_monitor_saude.
 * Diagnóstico ≠ OK → log/infra (não anvisa_alertas_normativos).
 */
async function consumirSaudeMonitor(
  supabase: SupabaseClient,
  resultados: ResultadoFonte[],
): Promise<Array<{ fonte: string; diagnostico: string }>> {
  const { data, error } = await supabase.from("v_legislacao_monitor_saude").select("*");
  if (error) {
    console.warn(
      "[monitor-anvisa-diario] v_legislacao_monitor_saude indisponível:",
      error.message,
    );
    return [];
  }

  const saude: Array<{ fonte: string; diagnostico: string }> = [];
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const fonte = String(r.fonte || r.fonte_monitorada || "");
    const diagnostico = String(r.diagnostico || r.status || "");
    if (!fonte) continue;
    saude.push({ fonte, diagnostico });

    if (!diagnostico || diagnostico === "OK" || diagnostico.startsWith("DESLIGADA")) {
      continue;
    }

    // Infraestrutura — registrar no log de monitoramento, sem alerta normativo.
    await supabase.from("legislacao_monitoramento").insert({
      fonte_monitorada: fonte,
      url: String(r.url || `saude://${fonte}`),
      hash_anterior: null,
      hash_novo: null,
      mudanca_detectada: false,
      resumo_mudanca: `SAUDE_MONITOR: ${diagnostico}`.slice(0, 500),
      status_revisao: "PENDENTE",
    });

    resultados.push({
      fonte,
      mudanca: false,
      status: "SAUDE_ALERTA",
      mensagem: `infra: ${diagnostico}`,
    });
    console.warn(`[monitor-anvisa-diario] saúde ${fonte}: ${diagnostico}`);
  }
  return saude;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    const resultados: ResultadoFonte[] = [];
    const alertasNovos: AlertaAcumulado[] = [];

    // T1: fontes ativas do banco
    const fontes = await carregarFontesAtivas(supabase);
    console.log(
      `[monitor-anvisa-diario] ${fontes.length} fonte(s) ativas: ${
        fontes.map((f) => f.id).join(", ")
      }`,
    );

    for (const fonte of fontes) {
      const metodo = fonte.metodo.toLowerCase();
      if (
        fonte.id === "PAINEL_CONSTITUINTES"
        || metodo === "powerbi_sync"
        || metodo === "sync_history"
      ) {
        await monitorarPainelViaSyncHistory(supabase, fonte, alertasNovos, resultados);
      } else {
        await monitorarFonteHtml(supabase, openai, fonte, alertasNovos, resultados);
      }
    }

    // T5: health check
    const saude = await consumirSaudeMonitor(supabase, resultados);

    const mudancas = resultados.filter((r) => r.mudanca);
    const falhasInfra = resultados.filter(
      (r) => r.status === "FALHA_INFRA" || r.status === "SAUDE_ALERTA",
    );
    if (mudancas.length > 0 || falhasInfra.length > 0) {
      console.log(
        `[monitor-anvisa-diario] ${mudancas.length} mudança(s), ` +
          `${falhasInfra.length} falha(s)/saúde, ` +
          `${alertasNovos.length} alerta(s) normativo(s) PENDENTE.`,
      );
    }

    // Grito por e-mail: só mudanças normativas (nunca falha de infra)
    let emailStatus: string | null = null;
    const pendentes = alertasNovos.filter((a) => a.status_revisao === "PENDENTE");
    if (pendentes.length >= 1) {
      try {
        const { to, viaFallback } = await resolverEmailRT(supabase);
        const { error: invokeErr } = await supabase.functions.invoke("send-anvisa-alert", {
          body: {
            to,
            subject: "🚨 ALERTA CRÍTICO ANVISA",
            alerts: pendentes,
            productsNonCompliant: [],
            timestamp: new Date().toISOString(),
          },
        });
        if (invokeErr) {
          console.error(
            "[monitor-anvisa-diario] send-anvisa-alert falhou (monitor segue):",
            invokeErr,
          );
          emailStatus = `ERRO_INVOKE: ${invokeErr.message || String(invokeErr)}`;
        } else {
          emailStatus = viaFallback ? `ENVIADO_FALLBACK:${to}` : `ENVIADO:${to}`;
          console.log(`[monitor-anvisa-diario] grito enviado → ${emailStatus}`);
        }
      } catch (mailErr) {
        console.error(
          "[monitor-anvisa-diario] falha ao resolver/enviar alerta (monitor segue):",
          mailErr,
        );
        emailStatus = `ERRO: ${String(mailErr)}`;
      }
    }

    return new Response(
      JSON.stringify({
        executado_em: new Date().toISOString(),
        resultados,
        saude,
        total_mudancas: mudancas.length,
        total_falhas_infra: falhasInfra.length,
        total_alertas_pendentes: pendentes.length,
        email_status: emailStatus,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("monitor-anvisa-diario error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
