import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnvisaConstituinte } from "@/types/anvisa";

export interface LimiteGrupoAnvisa {
  grupo: string;
  grupo_label: string;
  limite_min: number | null;
  limite_max: number | null;
  unidade: string | null;
}

export const GRUPOS_LIMITES_COLUNAS = [
  { grupo: "lactentes_0_6", label: "0–6 meses", coluna: "limites_0_6_meses" },
  { grupo: "lactentes_7_11", label: "7–11 meses", coluna: "limites_7_11_meses" },
  { grupo: "criancas_1_3", label: "1–3 anos", coluna: "limites_1_3_anos" },
  { grupo: "criancas_4_8", label: "4–8 anos", coluna: "limites_4_8_anos" },
  { grupo: "criancas_9_18", label: "9–18 anos", coluna: "limites_9_18_anos" },
  { grupo: "adultos", label: "≥19 anos", coluna: "limites_19_mais" },
  { grupo: "gestantes", label: "Gestantes", coluna: "limites_gestantes" },
  { grupo: "lactantes", label: "Lactantes", coluna: "limites_lactantes" },
] as const satisfies ReadonlyArray<{
  grupo: string;
  label: string;
  coluna: keyof Pick<
    AnvisaConstituinte,
    | "limites_0_6_meses"
    | "limites_7_11_meses"
    | "limites_1_3_anos"
    | "limites_4_8_anos"
    | "limites_9_18_anos"
    | "limites_19_mais"
    | "limites_gestantes"
    | "limites_lactantes"
  >;
}>;

export async function fetchAnvisaLimitesGrupos(
  constituinteId: string,
): Promise<LimiteGrupoAnvisa[]> {
  const { data, error } = await supabase.rpc(
    "anvisa_limites_todos_grupos" as never,
    { p_constituinte_id: constituinteId } as never,
  );
  if (error) throw error;
  return ((data as LimiteGrupoAnvisa[] | null) ?? []).map((row) => ({
    grupo: row.grupo,
    grupo_label: row.grupo_label,
    limite_min: row.limite_min != null ? Number(row.limite_min) : null,
    limite_max: row.limite_max != null ? Number(row.limite_max) : null,
    unidade: row.unidade ?? null,
  }));
}

export function useAnvisaLimitesGrupos(constituinteId: string | undefined) {
  return useQuery({
    queryKey: ["anvisa", "limites-grupos", constituinteId],
    queryFn: () => fetchAnvisaLimitesGrupos(constituinteId!),
    enabled: Boolean(constituinteId),
    staleTime: 60_000,
  });
}

export interface GrupoLimiteExibicao {
  label: string;
  min: number | null;
  max: number | null;
  unidade: string | null;
}

/** Mescla RPC parseada com colunas JSONB — mantém visibilidade de linhas como antes. */
export function montarGruposLimites(
  constituinte: AnvisaConstituinte,
  limitesRpc: LimiteGrupoAnvisa[] | undefined,
): GrupoLimiteExibicao[] {
  const porGrupo = new Map(
    (limitesRpc ?? []).map((row) => [row.grupo, row]),
  );

  return GRUPOS_LIMITES_COLUNAS.filter(
    (g) => constituinte[g.coluna] != null,
  ).map((g) => {
    const parsed = porGrupo.get(g.grupo);
    return {
      label: g.label,
      min: parsed?.limite_min ?? null,
      max: parsed?.limite_max ?? null,
      unidade: parsed?.unidade ?? null,
    };
  });
}
