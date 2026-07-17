import { supabase } from "@/integrations/supabase/client";

export type CapsulaIndustrialResult = {
  ok: boolean;
  motivo?: string;
  formula_id?: string;
  densidade_kg_l?: number;
  dose_ativos_total_mg?: number;
  alvo_comercial_mg?: number;
  teto_comercial_mg?: number;
  teto_fisico_mg?: number;
  limite_por_capsula_mg?: number;
  cabe_ativo_por_capsula_mg?: number;
  n_capsulas_por_dose?: number;
  por_capsula?: {
    ativo_mg: number;
    excipientes_8pct_mg: number;
    qsp_amido_mg: number;
    peso_total_mg: number;
  };
  peso_total_dose_mg?: number;
  densidade_e_default?: boolean;
  alerta_densidade?: string | null;
};

export type DensidadeBlendEstimada = {
  ok: boolean;
  formula_id?: string;
  densidade_estimada_kg_l?: number | null;
  massa_total_mg?: number;
  itens_ativos?: number;
  ativos_sem_densidade_coa?: number;
  e_estimativa?: boolean;
  requer_medicao_blend?: boolean;
  observacao?: string;
  motivo?: string;
};

/** Fonte única oficial — usar ao aprovar fórmula e gerar OP. */
export async function rpcCalcularCapsulaIndustrial(
  formulaId: string,
): Promise<CapsulaIndustrialResult> {
  const { data, error } = await supabase.rpc("calcular_capsula_industrial", {
    p_formula_id: formulaId,
  });
  if (error) {
    return { ok: false, motivo: error.message };
  }
  return (data ?? { ok: false, motivo: "RESPOSTA_VAZIA" }) as CapsulaIndustrialResult;
}

export async function rpcDensidadeBlendEstimada(
  formulaId: string,
): Promise<DensidadeBlendEstimada> {
  const { data, error } = await (supabase as any).rpc("densidade_blend_estimada", {
    p_formula_id: formulaId,
  });
  if (error) {
    return { ok: false, motivo: error.message };
  }
  return (data ?? { ok: false, motivo: "RESPOSTA_VAZIA" }) as DensidadeBlendEstimada;
}

/** Constantes alinhadas ao banco (não divergir). */
export const CAPSULA_CONST = {
  EXCIPIENTES_PCT: 8,
  FRACAO_ATIVO: 0.92,
  VOLUME_CAPSULA_0_ML: 0.68,
  DENSIDADE_DEFAULT_KG_L: 0.65,
  ALVO_COMERCIAL_MG: 500,
} as const;
