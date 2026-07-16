/**
 * Valores canônicos de grupo populacional gravados em
 * formulas.grupo_populacional_alvo e passados a regulatory_validar_produto.
 *
 * Alinhado com AnvisaCheckerForm / laudo (ADULTOS, CRIANCAS_4_8, …).
 * O SQL anvisa_limite_por_grupo mapeia cada um → coluna limites_*.
 */

export const GRUPOS_POPULACIONAIS = [
  { value: "ADULTOS", label: "Adultos ≥19 anos", coluna: "limites_19_mais" },
  { value: "CRIANCAS_4_8", label: "Crianças 4–8 anos", coluna: "limites_4_8_anos" },
  { value: "CRIANCAS_9_18", label: "Crianças 9–18 anos", coluna: "limites_9_18_anos" },
  { value: "CRIANCAS_1_3", label: "Crianças 1–3 anos", coluna: "limites_1_3_anos" },
  { value: "GESTANTES", label: "Gestantes", coluna: "limites_gestantes" },
  { value: "LACTANTES", label: "Lactantes", coluna: "limites_lactantes" },
  { value: "IDOSOS", label: "Idosos ≥65 anos (usa limite adulto)", coluna: "limites_19_mais" },
] as const;

export type GrupoPopulacional = (typeof GRUPOS_POPULACIONAIS)[number]["value"];

export function labelGrupoPopulacional(value: string | null | undefined): string {
  if (!value) return "—";
  const hit = GRUPOS_POPULACIONAIS.find((g) => g.value === value);
  return hit?.label ?? value;
}
