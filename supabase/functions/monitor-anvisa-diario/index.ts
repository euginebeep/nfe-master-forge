/**
 * Edge Function: monitor-anvisa-diario
 *
 * Cron diário (06h) — monitora fontes ANVISA e detecta mudanças.
 * REGRA ABSOLUTA: só detecta e alerta — NUNCA publica automaticamente.
 * Toda mudança fica com status_revisao = 'PENDENTE' até aprovação humana.
 *
 * Fontes monitoradas:
 * 1. ANVISALegis — IN 28/2018 consolidada
 * 2. Notícias ANVISA (filtro: suplemento)
 * 3. DOU Seção 1 (filtro: suplemento alimentar)
 * 4. Painel de Constituintes — via anvisa_sync_history (Power BI), NÃO via HTML
 * 5. Ingredientes/REs ANVISA
 * 6. DOU — Resoluções-RE (proibição/apreensão)
 *
 * Ao final: se houver ≥1 alerta PENDENTE novo, invoca send-anvisa-alert (grito RT).
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

interface FonteMonitorada {
  id: string;
  url: string;
  descricao: string;
  marcador: string;
  filtro?: string;
  /** Datalegis serve ISO-8859-1 — não usar resp.text() */
  decodificarIso88591?: boolean;
  /** Tentar UA de navegador + ISO se a fonte vier curta/bloqueada */
  retryAcesso?: boolean;
}

/** Payload acumulado para o grito (send-anvisa-alert) */
interface AlertaAcumulado {
  title: string;
  type: string;
  message: string;
  severity: "critical" | "warning";
  status_revisao: "PENDENTE";
  fonte?: string;
  affectedProducts?: string[];
}

/** Fontes monitoradas por hash de HTML (PAINEL_CONSTITUINTES fica de fora — Power BI embed). */
const FONTES_HTML: FonteMonitorada[] = [
  {
    id: "ANVISALEGIS_IN28",
    url: "https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=INM&numeroAto=00000028&seqAto=000&valorAno=2018&orgao=DC%2FANVISA%2FMS&cod_menu=1696&cod_modulo=134&pesquisa=true",
    descricao: "ANVISALegis — IN 28/2018 consolidada (listas/limites/alegações de suplementos)",
    marcador: "listas de constituintes",
    decodificarIso88591: true,
  },
  {
    id: "NOTICIAS_ANVISA",
    url: "https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa",
    descricao: "Notícias ANVISA — filtro: suplemento alimentar",
    marcador: "notícias",
    filtro: "suplemento",
  },
  {
    id: "DOU_SECAO1",
    url: "https://www.in.gov.br/leiturajornal?data=hoje&secao=do1",
    descricao: "DOU Seção 1 — filtro: suplemento alimentar, RDC, IN, ANVISA",
    marcador: "imprensa nacional",
    filtro: "suplemento alimentar",
  },
  {
    id: "INGREDIENTES_ANVISA",
    url: "https://www.gov.br/anvisa/pt-br/assuntos/alimentos/ingredientes",
    descricao: "Página de Ingredientes/REs — novos constituintes por resolução específica",
    marcador: "ingredientes",
    filtro: "suplemento",
    retryAcesso: true,
  },
  {
    id: "DOU_RESOLUCOES_RE",
    url: "https://www.in.gov.br/consulta/-/buscar/dou?q=suplemento+alimentar+resolucao+RE&s=do1",
    descricao: "DOU — Resoluções-RE de proibição/apreensão de suplementos (fiscalização)",
    marcador: "resolucao",
    filtro: "suplemento",
    retryAcesso: true,
  },
];

const FONTE_PAINEL: FonteMonitorada = {
  id: "PAINEL_CONSTITUINTES",
  url: "https://www.gov.br/anvisa/pt-br/assuntos/alimentos/paineis-de-consulta-de-alimentos",
  descricao:
    "Painel de Constituintes Autorizados — monitorado via anvisa-powerbi-sync (não via HTML embed)",
  marcador: "constituintes autorizados",
};

/** Fontes cuja mudança deve gerar alerta critico=true (urgente para a RT) */
const FONTES_ALERTA_CRITICO = new Set([
  "ANVISALEGIS_IN28",
  "DOU_SECAO1",
  "DOU_RESOLUCOES_RE",
  "PAINEL_CONSTITUINTES",
  "INGREDIENTES_ANVISA",
]);

async function sha256(texto: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function decodificarResposta(resp: Response, iso88591: boolean): Promise<string> {
  const buffer = await resp.arrayBuffer();
  const charset = iso88591 ? "iso-8859-1" : "utf-8";
  return new TextDecoder(charset).decode(buffer);
}

function temEncodingQuebrado(texto: string): boolean {
  return texto.includes("Ã§") || texto.includes("Ã£");
}

function validarConteudoFonte(
  texto: string,
  marcador: string,
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
  if (!texto.toLowerCase().includes(marcador.toLowerCase())) {
    return { ok: false, motivo: `Marcador obrigatório "${marcador}" não encontrado no texto` };
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

/** RT do tenant: responsaveis_tecnicos.email; fallback RESEND_DEFAULT_FROM. */
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

  // Equivalente a company_settings.rt_email — company.email_fiscal como último recurso de tenant
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
      "[monitor-anvisa-diario] RT sem e-mail cadastrado — usando RESEND_DEFAULT_FROM como fallback:",
      fallback,
    );
    return { to: fallback, viaFallback: true };
  }

  throw new Error(
    "Sem e-mail da RT (responsaveis_tecnicos.email) e sem RESEND_DEFAULT_FROM configurado",
  );
}

async function registrarFonteInacessivel(
  supabase: SupabaseClient,
  fonte: FonteMonitorada,
  motivo: string,
  alertasNovos: AlertaAcumulado[],
): Promise<void> {
  const resumo = `🚨 ALERTA ALTA — Fonte inacessível: ${motivo}`;

  const { data: mon } = await supabase
    .from("legislacao_monitoramento")
    .insert({
      fonte_monitorada: fonte.id,
      url: fonte.url,
      hash_anterior: null,
      hash_novo: null,
      mudanca_detectada: true,
      resumo_mudanca: resumo,
      status_revisao: "PENDENTE",
    })
    .select("id")
    .single();

  const titulo = `Fonte inacessível: ${fonte.id}`;
  const descricao = `${fonte.descricao}. ${motivo}`;
  await supabase.from("anvisa_alertas_normativos").insert({
    tipo: "ATUALIZACAO",
    titulo,
    descricao,
    norma: fonte.id,
    fonte_url: fonte.url,
    critico: true,
    status_revisao: "PENDENTE",
    monitoramento_id: mon?.id ?? null,
  });

  alertasNovos.push({
    title: titulo,
    type: "ATUALIZACAO",
    message: descricao,
    severity: "critical",
    status_revisao: "PENDENTE",
    fonte: fonte.id,
  });

  console.error(`[monitor-anvisa-diario] FONTE INACESSÍVEL ${fonte.id}: ${motivo}`);
}

/**
 * DOU_RESOLUCOES_RE / INGREDIENTES: registra presença da falha sem gritar mudança falsa.
 * mudanca_detectada=false + resumo 'fonte inacessível'.
 */
async function registrarFonteInacessivelSilencioso(
  supabase: SupabaseClient,
  fonte: FonteMonitorada,
  motivo: string,
): Promise<void> {
  await supabase.from("legislacao_monitoramento").insert({
    fonte_monitorada: fonte.id,
    url: fonte.url,
    hash_anterior: null,
    hash_novo: null,
    mudanca_detectada: false,
    resumo_mudanca: "fonte inacessível",
    status_revisao: "PENDENTE",
  });
  console.warn(
    `[monitor-anvisa-diario] ${fonte.id}: fonte inacessível (${motivo}) — registrado sem alerta crítico`,
  );
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

/** Busca HTML com retries (UA navegador + ISO) para fontes sujeitas a redirect/bloqueio. */
async function baixarFonteHtml(
  fonte: FonteMonitorada,
): Promise<{ html: string; bytes: number; userAgent: string; iso: boolean }> {
  const tentativas: Array<{ ua: string; iso: boolean; label: string }> = [
    {
      ua: "BrainXERP-Monitor/1.0 (regulatorio@brainxerp.com)",
      iso: fonte.decodificarIso88591 === true,
      label: "default",
    },
  ];

  if (fonte.retryAcesso) {
    tentativas.push(
      { ua: BROWSER_UA, iso: false, label: "browser-ua" },
      { ua: BROWSER_UA, iso: true, label: "browser-ua+iso88591" },
    );
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
      `[monitor-anvisa-diario] ${fonte.id}: recebidos ${html.length} chars (tentativa ${t.label}, iso=${t.iso})`,
    );

    const validacao = validarConteudoFonte(html, fonte.marcador);
    if (validacao.ok) {
      return { html, bytes: html.length, userAgent: t.ua, iso: t.iso };
    }

    ultimoErro = validacao.motivo;
    // Se não é fonte com retry, ou se o problema não é tamanho/redirect, não insiste
    if (!fonte.retryAcesso) {
      throw new Error(validacao.motivo);
    }
    const curto = html.length < MIN_CHARS_VALIDOS;
    console.warn(
      `[monitor-anvisa-diario] ${fonte.id}: tentativa ${t.label} falhou (${validacao.motivo}); curto=${curto}`,
    );
  }

  throw new Error(ultimoErro);
}

/** Painel: alerta a partir do último anvisa_sync_history tipo=powerbi (não hasheia HTML embed). */
async function monitorarPainelViaSyncHistory(
  supabase: SupabaseClient,
  alertasNovos: AlertaAcumulado[],
  resultados: Array<{ fonte: string; mudanca: boolean; status: string; mensagem: string }>,
): Promise<void> {
  const fonte = FONTE_PAINEL;

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
      const titulo = `Mudança detectada: ${fonte.id}`;
      const descricao =
        `Painel ANVISA mudou: ${novos} novos, ${removidos} removidos. ` +
        `Revisar sync Power BI (${ultimo.id}) antes de qualquer ação na base.`;

      await supabase.from("anvisa_alertas_normativos").insert({
        tipo: "ATUALIZACAO",
        titulo,
        descricao,
        norma: fonte.id,
        fonte_url: fonte.url,
        critico: true,
        status_revisao: "PENDENTE",
        monitoramento_id: monRow?.id ?? null,
      });

      alertasNovos.push({
        title: titulo,
        type: "ATUALIZACAO",
        message: descricao,
        severity: "critical",
        status_revisao: "PENDENTE",
        fonte: fonte.id,
      });
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
    resultados.push({
      fonte: fonte.id,
      mudanca: false,
      status: "ERRO",
      mensagem: String(e),
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    const supabase = createClient(supabaseUrl, serviceKey);
    const openai = new OpenAI({ apiKey: openaiKey });

    const resultados: Array<{
      fonte: string;
      mudanca: boolean;
      status: string;
      mensagem: string;
    }> = [];

    const alertasNovos: AlertaAcumulado[] = [];

    for (const fonte of FONTES_HTML) {
      try {
        let html: string;
        try {
          const baixado = await baixarFonteHtml(fonte);
          html = baixado.html;
          if (fonte.retryAcesso || fonte.id === "DOU_RESOLUCOES_RE" || fonte.id === "INGREDIENTES_ANVISA") {
            console.log(
              `[monitor-anvisa-diario] ${fonte.id}: tamanho real=${baixado.bytes} chars`,
            );
          }
        } catch (acessoErr) {
          const motivo = String(acessoErr);
          if (fonte.retryAcesso) {
            await registrarFonteInacessivelSilencioso(supabase, fonte, motivo);
            resultados.push({
              fonte: fonte.id,
              mudanca: false,
              status: "FONTE_INACESSIVEL",
              mensagem: `fonte inacessível: ${motivo}`,
            });
          } else {
            await registrarFonteInacessivel(supabase, fonte, motivo, alertasNovos);
            resultados.push({
              fonte: fonte.id,
              mudanca: true,
              status: "FONTE_INACESSIVEL",
              mensagem: `🚨 Fonte inacessível: ${motivo}`,
            });
          }
          continue;
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
          .single();

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
        if (fonte.retryAcesso) {
          await registrarFonteInacessivelSilencioso(supabase, fonte, motivo);
          resultados.push({
            fonte: fonte.id,
            mudanca: false,
            status: "FONTE_INACESSIVEL",
            mensagem: `fonte inacessível: ${motivo}`,
          });
        } else {
          await registrarFonteInacessivel(supabase, fonte, motivo, alertasNovos);
          resultados.push({
            fonte: fonte.id,
            mudanca: true,
            status: "FONTE_INACESSIVEL",
            mensagem: `🚨 Fonte inacessível: ${motivo}`,
          });
        }
      }
    }

    // Painel: fora do laço de hash HTML — usa resultado do anvisa-powerbi-sync
    await monitorarPainelViaSyncHistory(supabase, alertasNovos, resultados);

    const mudancas = resultados.filter((r) => r.mudanca);
    const fontesInacessiveis = resultados.filter((r) => r.status === "FONTE_INACESSIVEL");
    if (mudancas.length > 0 || fontesInacessiveis.length > 0) {
      console.log(
        `[monitor-anvisa-diario] ${mudancas.length} mudança(s), ` +
          `${fontesInacessiveis.length} fonte(s) inacessível(is), ` +
          `${alertasNovos.length} alerta(s) PENDENTE novos.`,
      );
    }

    // ── PATCH 1: grito por e-mail se houver alerta PENDENTE novo ───────────
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
          emailStatus = viaFallback
            ? `ENVIADO_FALLBACK:${to}`
            : `ENVIADO:${to}`;
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
        total_mudancas: mudancas.length,
        total_fontes_inacessiveis: fontesInacessiveis.length,
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
