// supabase/functions/_shared/datalegis.ts
//
// Cliente Datalegis (AnvisaLegis) — fetch, transcode, parse, hash.
//
// FATOS VERIFICADOS CONTRA O SITE (13/07/2026):
//   - NÃO existe API JSON. HTML server-side, portal PHP legado.
//   - Charset ISO-8859-1 (latin1). Sem transcodificar => mojibake e hash inútil.
//   - URL pública canônica: UrlPublicasAction.php?acao=abrirAtoPublico&...
//   - O ato exibe status de vigência ("Vigente com Alterações") e notas de
//     alteração inline por dispositivo.
//   - seq_ato varia (000, 222...). NÃO adivinhar: resolver e persistir.
//
// FILOSOFIA DO PARSER: falhar RUIDOSAMENTE.
// Um parser quebrado que devolve string vazia é pior que um erro — ele apagaria
// silenciosamente as regras que sustentam laudos. Toda função lança em vez de
// devolver vazio.

const BASE = "https://anvisalegis.datalegis.net/action/UrlPublicasAction.php";
const USER_AGENT = "BrainX-ERP/1.0 (compliance monitor; contato: ti@brainxerp.com)";

export class DatalegisError extends Error {
  constructor(msg: string, readonly url?: string) {
    super(msg);
    this.name = "DatalegisError";
  }
}

export type StatusVigencia =
  | "vigente"
  | "vigente_com_alteracoes"
  | "revogado"
  | "revogado_parcialmente"
  | "desconhecido";

export interface AtoRef {
  tipo: string;      // RDC | IN | RE | PRT | LEI
  numero: number;
  ano: number;
  sglOrgao: string;  // RDC/DC/ANVISA/MS
  seqAto?: string;   // default '000'
}

export interface NotaAlteracao {
  tipoAlteracao: "altera" | "revoga" | "acrescenta" | "suprime" | "renumera";
  alteradorRef: string | null;  // 'RDC 990/2025'
  dispositivo: string | null;   // 'Art. 32'
  trecho: string;
}

export interface AtoParseado {
  ref: AtoRef;
  url: string;
  titulo: string;
  statusVigencia: StatusVigencia;
  textoConsolidado: string;
  hashTexto: string;
  notas: NotaAlteracao[];
  referencias: AtoRef[];   // grafo de citações (LinkTexto)
  capturadoEm: string;
}

// ---------------------------------------------------------------------------
// URL canônica
// ---------------------------------------------------------------------------
export function montarUrl(ref: AtoRef): string {
  const p = new URLSearchParams({
    acao: "abrirAtoPublico",
    num_ato: String(ref.numero).padStart(8, "0"), // 843 -> 00000843
    sgl_tipo: ref.tipo,
    sgl_orgao: ref.sglOrgao,
    vlr_ano: String(ref.ano),
    seq_ato: ref.seqAto ?? "000",
  });
  return `${BASE}?${p.toString()}`;
}

// ---------------------------------------------------------------------------
// Fetch + transcode ISO-8859-1 -> UTF-8
// ---------------------------------------------------------------------------
export async function baixarHtml(url: string, tentativas = 3): Promise<string> {
  let ultimoErro: unknown;

  for (let i = 0; i < tentativas; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, "Accept": "text/html" },
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok) throw new DatalegisError(`HTTP ${res.status}`, url);

      const buf = await res.arrayBuffer();

      // O portal declara iso-8859-1. Respeitamos o header quando existir,
      // mas o default É latin1 — nunca utf-8.
      const ct = res.headers.get("content-type") ?? "";
      const charset = /charset=([\w-]+)/i.exec(ct)?.[1]?.toLowerCase() ?? "iso-8859-1";
      const enc = charset.includes("utf") ? "utf-8" : "iso-8859-1";

      const html = new TextDecoder(enc).decode(buf);

      // Sanidade: se veio mojibake, o decode está errado. Grita.
      if (/Ã§|Ã£|Ã©|Ã¡/.test(html)) {
        throw new DatalegisError(`Mojibake detectado (charset=${enc} errado)`, url);
      }
      if (html.length < 500) {
        throw new DatalegisError(`Resposta suspeita: ${html.length} bytes`, url);
      }
      return html;
    } catch (e) {
      ultimoErro = e;
      if (i < tentativas - 1) {
        await new Promise((r) => setTimeout(r, 1500 * 2 ** i)); // backoff
      }
    }
  }
  throw new DatalegisError(
    `Falha após ${tentativas} tentativas: ${String(ultimoErro)}`,
    url,
  );
}

// ---------------------------------------------------------------------------
// Extração de texto
// ---------------------------------------------------------------------------
function htmlParaTexto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * Recorta a partir do cabeçalho do ato ("MINISTÉRIO DA SAÚDE") para descartar
 * menus e navegação. Se o âncora sumir, NÃO devolve o texto todo em silêncio:
 * lança, porque o hash ficaria contaminado por conteúdo de menu.
 */
function recortarCorpo(texto: string, url: string): string {
  const inicio = texto.search(/MINIST[ÉE]RIO DA SA[ÚU]DE/i);
  if (inicio < 0) {
    throw new DatalegisError(
      "Âncora do corpo do ato não encontrada — layout do Datalegis mudou. PARSER PRECISA DE REVISÃO.",
      url,
    );
  }
  return texto.slice(inicio).trim();
}

/** Normaliza para hash: o hash não pode oscilar por espaço ou acento. */
function normalizarParaHash(texto: string): string {
  return texto
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Status de vigência
// ---------------------------------------------------------------------------
export function extrairStatus(texto: string): StatusVigencia {
  const t = texto.slice(0, 4000).toLowerCase(); // status fica no topo do ato
  if (/revogad[ao]\s+parcialmente|revogação parcial/.test(t)) return "revogado_parcialmente";
  if (/\brevogad[ao]\b/.test(t)) return "revogado";
  if (/vigente\s+com\s+altera[çc][õo]es/.test(t)) return "vigente_com_alteracoes";
  if (/\bvigente\b/.test(t)) return "vigente";
  return "desconhecido";
}

// ---------------------------------------------------------------------------
// Notas de alteração — regex sobre TEXTO (robusto a mudança de HTML)
// ---------------------------------------------------------------------------
const RX_NOTA =
  /\((?:(Reda[çc][ãa]o dada|Inclu[íi]d[oa]|Acrescentad[oa]|Revogad[oa]|Suprimid[oa]|Renumerad[oa])[^)]*?por[^)]*?)\)/gi;

const RX_ATO_REF =
  /\b(RDC|IN|RE|PRT|Lei|Decreto|Resolu[çc][ãa]o(?:\s+da\s+Diretoria\s+Colegiada)?(?:\s*-\s*RDC)?|Instru[çc][ãa]o\s+Normativa(?:\s*-\s*IN)?)\s*n?[º°.]?\s*([\d.]+)[,\s]+de\s+\d{1,2}\s+de\s+\w+\s+de\s+(\d{4})|(?:\b(RDC|IN)\s*n?[º°.]?\s*([\d.]+)\/(\d{4}))/i;

function tipoDaNota(m: string): NotaAlteracao["tipoAlteracao"] {
  const s = m.toLowerCase();
  if (s.startsWith("revogad")) return "revoga";
  if (s.startsWith("suprimid")) return "suprime";
  if (s.startsWith("inclu") || s.startsWith("acrescentad")) return "acrescenta";
  if (s.startsWith("renumerad")) return "renumera";
  return "altera";
}

function normalizarRefAto(trecho: string): string | null {
  const m = RX_ATO_REF.exec(trecho);
  if (!m) return null;
  const rawTipo = (m[1] ?? m[4] ?? "").toLowerCase();
  const num = (m[2] ?? m[5] ?? "").replace(/\./g, "");
  const ano = m[3] ?? m[6];
  if (!num || !ano) return null;

  let tipo = "RDC";
  if (rawTipo.startsWith("in") || rawTipo.includes("instru")) tipo = "IN";
  else if (rawTipo.startsWith("lei")) tipo = "LEI";
  else if (rawTipo.startsWith("decreto")) tipo = "DEC";
  else if (rawTipo === "re") tipo = "RE";
  else if (rawTipo === "prt") tipo = "PRT";

  return `${tipo} ${Number(num)}/${ano}`;
}

/** Encontra o dispositivo (Art./Anexo/§) mais próximo ANTES da nota. */
function dispositivoAnterior(texto: string, idx: number): string | null {
  const janela = texto.slice(Math.max(0, idx - 1200), idx);
  const achados = [...janela.matchAll(/\b(Art\.\s*\d+[ºo]?(?:\s*[-,]\s*[§\w º]+)?|Anexo\s+[IVXL]+|§\s*\d+[ºo]?)/gi)];
  return achados.length ? achados[achados.length - 1][1].trim() : null;
}

export function extrairNotas(texto: string): NotaAlteracao[] {
  const notas: NotaAlteracao[] = [];
  for (const m of texto.matchAll(RX_NOTA)) {
    const trecho = m[0];
    const verbo = m[1] ?? "";
    notas.push({
      tipoAlteracao: tipoDaNota(verbo),
      alteradorRef: normalizarRefAto(trecho),
      dispositivo: dispositivoAnterior(texto, m.index ?? 0),
      trecho: trecho.slice(0, 300),
    });
  }
  return notas;
}

// ---------------------------------------------------------------------------
// Grafo de citações — LinkTexto('RES','00000585','000','2021','RDC/DC/ANVISA/MS',...)
// ---------------------------------------------------------------------------
const RX_LINKTEXTO =
  /LinkTexto\('([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'/g;

export function extrairReferencias(html: string): AtoRef[] {
  const out = new Map<string, AtoRef>();
  for (const m of html.matchAll(RX_LINKTEXTO)) {
    const [, tipo, numero, seq, ano, orgao] = m;
    const n = Number(numero);
    const a = Number(ano);
    if (!Number.isFinite(n) || !Number.isFinite(a) || a < 1970) continue;
    const ref: AtoRef = {
      tipo: tipo.toUpperCase(),
      numero: n,
      ano: a,
      sglOrgao: orgao || "ANVISA/MS",
      seqAto: seq || "000",
    };
    out.set(`${ref.tipo}-${ref.numero}-${ref.ano}-${ref.sglOrgao}`, ref);
  }
  return [...out.values()];
}

// ---------------------------------------------------------------------------
// Pipeline principal
// ---------------------------------------------------------------------------
export async function buscarAto(ref: AtoRef): Promise<AtoParseado> {
  const url = montarUrl(ref);
  const html = await baixarHtml(url);

  const tituloRaw = /<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "";
  const titulo = htmlParaTexto(tituloRaw);

  // Guard: a página existe mas é do ato certo?
  if (!new RegExp(`\\b${ref.numero}\\b`).test(titulo)) {
    throw new DatalegisError(
      `Título não confere com o ato pedido (esperado nº ${ref.numero}, veio "${titulo}"). ` +
        `Provável sgl_orgao ou seq_ato errado.`,
      url,
    );
  }

  const textoBruto = htmlParaTexto(html);
  const textoConsolidado = recortarCorpo(textoBruto, url);

  if (textoConsolidado.length < 800) {
    throw new DatalegisError(
      `Texto consolidado curto demais (${textoConsolidado.length} chars) — parse suspeito.`,
      url,
    );
  }

  return {
    ref,
    url,
    titulo,
    statusVigencia: extrairStatus(textoBruto),
    textoConsolidado,
    hashTexto: await sha256(normalizarParaHash(textoConsolidado)),
    notas: extrairNotas(textoConsolidado),
    referencias: extrairReferencias(html),
    capturadoEm: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Resolver — descobre sgl_orgao / seq_ato quando não se conhece
// ---------------------------------------------------------------------------
const ORGAOS_CANDIDATOS: Record<string, string[]> = {
  RDC: ["RDC/DC/ANVISA/MS", "ANVISA/MS"],
  IN:  ["IN/DC/ANVISA/MS", "IN/DC/ANVISA", "ANVISA/MS"],
  RE:  ["RE/GGFIS/ANVISA/MS", "RE/GHCOS/ANVISA/MS", "ANVISA/MS"],
  PRT: ["ANVISA/MS"],
};
const SEQS_CANDIDATOS = ["000", "222"];

/**
 * Tenta as combinações plausíveis de sgl_orgao × seq_ato até uma bater.
 * Roda UMA vez por ato; o resultado é persistido em reg_atos.
 */
export async function resolverAto(
  tipo: string,
  numero: number,
  ano: number,
): Promise<AtoParseado> {
  const orgaos = ORGAOS_CANDIDATOS[tipo] ?? ["ANVISA/MS"];
  const erros: string[] = [];

  for (const sglOrgao of orgaos) {
    for (const seqAto of SEQS_CANDIDATOS) {
      try {
        return await buscarAto({ tipo, numero, ano, sglOrgao, seqAto });
      } catch (e) {
        erros.push(`${sglOrgao}/${seqAto}: ${(e as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, 800)); // educação com o servidor
    }
  }
  throw new DatalegisError(
    `Não foi possível resolver ${tipo} ${numero}/${ano}. Tentativas:\n${erros.join("\n")}`,
  );
}
