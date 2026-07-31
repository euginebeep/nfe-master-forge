/**
 * Valores canônicos de grupo populacional gravados em
 * formulas.grupo_populacional_alvo (constraint chk_grupo_populacional)
 * e consumidos por anvisa_limite_por_grupo / anvisa_avaliar_formula.
 *
 * O value DEVE espelhar as chaves aceitas pelo banco e as colunas
 * limites_* de anvisa_constituintes. Labels são só exibição.
 *
 * Nota: AnvisaCheckerForm / anvisa-limits.ts usam outro vocabulário
 * (legado de laudo/monitoramento) — domínio separado; não misturar.
 */

export const GRUPOS_POPULACIONAIS = [
  { value: "0_6_meses", label: "Lactentes 0–6 meses", coluna: "limites_0_6_meses" },
  { value: "7_11_meses", label: "Lactentes 7–11 meses", coluna: "limites_7_11_meses" },
  { value: "1_3_anos", label: "Crianças 1–3 anos", coluna: "limites_1_3_anos" },
  { value: "4_8_anos", label: "Crianças 4–8 anos", coluna: "limites_4_8_anos" },
  { value: "9_18_anos", label: "Crianças 9–18 anos", coluna: "limites_9_18_anos" },
  { value: "19_mais", label: "Adultos ≥19 anos", coluna: "limites_19_mais" },
  { value: "gestantes", label: "Gestantes", coluna: "limites_gestantes" },
  { value: "lactantes", label: "Lactantes", coluna: "limites_lactantes" },
] as const;

export type GrupoPopulacional = (typeof GRUPOS_POPULACIONAIS)[number]["value"];

export function labelGrupoPopulacional(value: string | null | undefined): string {
  if (!value) return "—";
  const hit = GRUPOS_POPULACIONAIS.find((g) => g.value === value);
  return hit?.label ?? value;
}
