/**
 * Fonte única de consulta ANVISA — RPC public.anvisa_consultar.
 * Todas as telas devem usar esta API (não misturar fuzzy/popular/tabela).
 */

import { supabase } from "@/integrations/supabase/client";

export type AnvisaConsultaStatus =
  | "encontrado"
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
  return (data ?? {
    ok: false,
    status: "nao_encontrado",
    mensagem: "Resposta vazia da RPC anvisa_consultar.",
  }) as AnvisaConsultaResult;
}

export type AnvisaStatusUi = {
  tom: "verde" | "vermelho" | "cinza";
  label: string;
  className: string;
};

/** Mapa de status → UI (selo). */
export function estiloStatusAnvisaConsulta(status: string | undefined): AnvisaStatusUi {
  switch (status) {
    case "encontrado":
    case "conforme":
      return {
        tom: "verde",
        label: status === "conforme" ? "CONFORME" : "AUTORIZADO",
        className: "border-green-500/40 bg-green-500/10 text-green-700",
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

export function statusPositivo(status: string | undefined): boolean {
  return status === "encontrado" || status === "conforme";
}

export function statusNegativo(status: string | undefined): boolean {
  return status === "acima_limite" || status === "proibido" || status === "nao_autorizado_grupo";
}
