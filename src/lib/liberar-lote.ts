import { supabase } from "@/integrations/supabase/client";

export type ConferenciaKey =
  | "quantidade"
  | "integridade"
  | "identificacao"
  | "arte"
  | "validade";

export type ConferenciaOpcao = {
  key: ConferenciaKey;
  label: string;
};

const TIPOS_COA_DISPENSADO = new Set(["ROTULO", "POTE", "TAMPA", "EMBALAGEM"]);

export function coaDispensadoParaTipo(tipoItem: string | null | undefined): boolean {
  return !!tipoItem && TIPOS_COA_DISPENSADO.has(tipoItem);
}

/** Checkboxes obrigatórios conforme regra do banco (`liberar_lote`). */
export function getConferenciasObrigatorias(
  tipoItem: string | null | undefined
): ConferenciaOpcao[] {
  const base: ConferenciaOpcao[] = [
    { key: "quantidade", label: "Quantidade conferida" },
    { key: "integridade", label: "Integridade da embalagem" },
    { key: "identificacao", label: "Identificação do lote" },
  ];

  if (tipoItem === "ROTULO") {
    return [
      ...base,
      { key: "arte", label: "Arte do rótulo confere com a versão aprovada" },
    ];
  }

  if (tipoItem === "POTE" || tipoItem === "TAMPA" || tipoItem === "EMBALAGEM") {
    return base;
  }

  return [
    ...base,
    { key: "validade", label: "Validade conferida" },
  ];
}

export function precisaJustificativaSemCoa(
  tipoItem: string | null | undefined,
  temCoaValidado: boolean
): boolean {
  return !coaDispensadoParaTipo(tipoItem) && !temCoaValidado;
}

export function conferenciasPendentes(
  tipoItem: string | null | undefined,
  marcadas: Record<string, boolean>
): ConferenciaOpcao[] {
  return getConferenciasObrigatorias(tipoItem).filter((c) => !marcadas[c.key]);
}

export function montarConferenciasPayload(
  tipoItem: string | null | undefined,
  marcadas: Record<string, boolean>
): Record<string, boolean> {
  const payload: Record<string, boolean> = {};
  for (const c of getConferenciasObrigatorias(tipoItem)) {
    payload[c.key] = !!marcadas[c.key];
  }
  return payload;
}

export type LiberarLoteResultado = {
  sucesso?: boolean;
  liberado_por?: string;
  mensagem?: string;
  [key: string]: unknown;
};

/**
 * Chama a RPC `liberar_lote` (já em produção). Só resolve se `sucesso === true`.
 */
export async function chamarLiberarLote(params: {
  loteId: string;
  conferencias: Record<string, boolean>;
  justificativa: string | null;
}): Promise<LiberarLoteResultado> {
  const { data, error } = await (supabase as any).rpc("liberar_lote", {
    p_lote_id: params.loteId,
    p_conferencias: params.conferencias,
    p_justificativa: params.justificativa,
  });

  if (error) {
    const err = new Error(error.message || error.code || "Erro ao liberar lote");
    (err as Error & { code?: string }).code = error.code;
    throw err;
  }

  const resultado = (Array.isArray(data) ? data[0] : data) as LiberarLoteResultado | null;

  if (!resultado || resultado.sucesso !== true) {
    const msg =
      (resultado?.mensagem as string | undefined) ||
      "Liberação não confirmada pelo servidor";
    throw new Error(msg);
  }

  return resultado;
}

export const PLACEHOLDER_JUSTIFICATIVA_SEM_COA =
  "Descreva o que foi conferido e por que o lote pode ser liberado sem CoA";

export const MIN_JUSTIFICATIVA_SEM_COA = 30;
