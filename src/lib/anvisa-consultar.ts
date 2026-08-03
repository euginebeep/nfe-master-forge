/**
 * Fonte única de consulta ANVISA — RPC public.anvisa_consultar.
 * Todas as telas devem usar esta API (não misturar fuzzy/popular/tabela).
 *
 * Contrato v2 (20260803092612): status ∈ encontrado | ambiguo | sugestao | nao_encontrado
 * (+ dose: conforme | acima_limite | nao_autorizado_grupo | proibido).
 * ambiguo/sugestao NUNCA recebem selo AUTORIZADO.
 */

import { supabase } from "@/integrations/supabase/client";

export type AnvisaConsultaStatus =
  | "encontrado"
  | "ambiguo"
  | "sugestao"
  | "nao_encontrado"
  | "proibido"
  | "conforme"
  | "acima_limite"
  | "nao_autorizado_grupo"
  | "termo_vazio";

export type AnvisaConsultaResult = {
  ok: boolean;
  status: AnvisaConsultaStatus | string;
  termo?: string;
  mensagem?: string;
  constituinte_id?: string;
  nome_tecnico?: string;
  /** Similaridade 0–1 — só em sugestao (não autoriza). */
  similaridade?: number;
  categoria?: string;
  norma_inclusao?: string;
  alegacoes?: unknown;
  advertencias?: unknown;
  limites?: Record<string, unknown>;
  motivo?: string;
  grupo?: string;
  dose_mg?: number;
  limite_maximo_mg?: number;
  limite_texto?: string;
  /** Casamento ambíguo — nomes técnicos para a RT escolher. */
  candidatos?: string[];
  n_candidatos?: number;
  /** Sugestão fraca — nome próximo, NÃO autorizado. */
  sugestao_nome?: string | null;
};

/** Normaliza rótulos de grupo populacional → chaves da RPC. */
export function normalizarGrupoAnvisa(grupo: string | null | undefined): string | null {
  if (!grupo) return null;
  const g = grupo
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_");

  if (["19_mais", "19+", "adulto", "adultos", "maiores_19", "maiores_19_anos"].includes(g)) {
    return "19_mais";
  }
  if (g.startsWith("gestant")) return "gestantes";
  if (g.startsWith("lactant")) return "lactantes";
  if (["0_6", "0_6_meses", "0a6"].includes(g)) return "0_6_meses";
  if (["7_11", "7_11_meses", "7a11"].includes(g)) return "7_11_meses";
  if (["1_3", "1_3_anos", "1a3"].includes(g)) return "1_3_anos";
  if (["4_8", "4_8_anos", "4a8"].includes(g)) return "4_8_anos";
  if (["9_18", "9_18_anos", "9a18"].includes(g)) return "9_18_anos";
  return g;
}

function nomesDeCandidatos(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return raw
      .map((x) => {
        if (typeof x === "string") return x.trim();
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          for (const k of ["nome_tecnico", "constituinte", "nome", "label"]) {
            if (typeof o[k] === "string" && String(o[k]).trim()) return String(o[k]).trim();
          }
        }
        return "";
      })
      .filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

function parseConsulta(data: unknown): AnvisaConsultaResult {
  const raw = (data ?? {}) as Record<string, unknown>;
  const candidatos = nomesDeCandidatos(raw.candidatos);
  const n =
    raw.n_candidatos != null && Number.isFinite(Number(raw.n_candidatos))
      ? Number(raw.n_candidatos)
      : candidatos.length || undefined;
  return {
    ok: raw.ok !== false,
    status: String(raw.status || "nao_encontrado"),
    termo: (raw.termo as string) ?? undefined,
    mensagem: (raw.mensagem as string) ?? undefined,
    constituinte_id: (raw.constituinte_id as string) ?? undefined,
    nome_tecnico: (raw.nome_tecnico as string) ?? undefined,
    similaridade:
      raw.similaridade == null ? undefined : Number(raw.similaridade),
    categoria: (raw.categoria as string) ?? undefined,
    norma_inclusao: (raw.norma_inclusao as string) ?? undefined,
    alegacoes: raw.alegacoes ?? undefined,
    advertencias: raw.advertencias ?? undefined,
    limites: (raw.limites as Record<string, unknown>) ?? undefined,
    motivo: (raw.motivo as string) ?? undefined,
    grupo: (raw.grupo as string) ?? undefined,
    dose_mg: raw.dose_mg == null ? undefined : Number(raw.dose_mg),
    limite_maximo_mg:
      raw.limite_maximo_mg == null ? undefined : Number(raw.limite_maximo_mg),
    limite_texto: (raw.limite_texto as string) ?? undefined,
    candidatos: candidatos.length ? candidatos : undefined,
    n_candidatos: n,
    sugestao_nome: (raw.sugestao_nome as string) ?? null,
  };
}

export async function rpcAnvisaConsultar(params: {
  termo: string;
  grupo?: string | null;
  doseMg?: number | null;
}): Promise<AnvisaConsultaResult> {
  const termo = (params.termo || "").trim();
  if (termo.length < 2) {
    return {
      ok: false,
      status: "termo_vazio",
      mensagem: "Informe um termo para consultar.",
    };
  }

  const args: Record<string, unknown> = { p_termo: termo };
  const grupo = normalizarGrupoAnvisa(params.grupo);
  if (grupo) args.p_grupo = grupo;
  if (params.doseMg != null && Number.isFinite(params.doseMg)) {
    args.p_dose_mg = params.doseMg;
  }

  const { data, error } = await (supabase as any).rpc("anvisa_consultar", args);
  if (error) {
    return { ok: false, status: "nao_encontrado", mensagem: error.message };
  }
  return parseConsulta(data ?? {
    ok: false,
    status: "nao_encontrado",
    mensagem: "Resposta vazia da RPC anvisa_consultar.",
  });
}

export type AnvisaStatusUi = {
  tom: "verde" | "vermelho" | "ambar" | "cinza";
  label: string;
  className: string;
};

/** Mapa de status → UI (selo). ambiguo/sugestao NÃO são AUTORIZADO. */
export function estiloStatusAnvisaConsulta(status: string | undefined): AnvisaStatusUi {
  switch (status) {
    case "encontrado":
    case "conforme":
      return {
        tom: "verde",
        label: status === "conforme" ? "CONFORME" : "AUTORIZADO",
        className: "border-green-500/40 bg-green-500/10 text-green-700",
      };
    case "ambiguo":
      return {
        tom: "ambar",
        label: "AMBÍGUO — ESCOLHER",
        className: "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
      };
    case "sugestao":
      return {
        tom: "ambar",
        label: "SUGESTÃO — NÃO AUTORIZADO",
        className: "border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-100",
      };
    case "acima_limite":
    case "proibido":
    case "nao_autorizado_grupo":
      return {
        tom: "vermelho",
        label:
          status === "acima_limite"
            ? "ACIMA DO LIMITE"
            : status === "proibido"
              ? "PROIBIDO"
              : "NÃO AUTORIZADO (GRUPO)",
        className: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    case "nao_encontrado":
    default:
      return {
        tom: "cinza",
        label: "CONSULTE ANVISA / PENDENTE_RT",
        className: "border-muted-foreground/30 bg-muted text-muted-foreground",
      };
  }
}

/** Só encontrado/conforme autorizam uso — ambiguo e sugestao NÃO. */
export function statusPositivo(status: string | undefined): boolean {
  return status === "encontrado" || status === "conforme";
}

export function statusNegativo(status: string | undefined): boolean {
  return status === "acima_limite" || status === "proibido" || status === "nao_autorizado_grupo";
}

/** Motor respondeu sem autorizar um único constituinte. */
export function statusExigeEscolhaOuNaoAutoriza(status: string | undefined): boolean {
  return (
    status === "ambiguo"
    || status === "sugestao"
    || status === "nao_encontrado"
    || status === "termo_vazio"
  );
}
