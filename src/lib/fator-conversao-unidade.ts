/**
 * Regra do fator de conversão comercial → unidade interna base.
 * fator = N × base(unidade), onde N é o prefixo numérico da unidade comercial.
 *
 * Bases (doc módulo fiscal 01/08/2026):
 * KG→1000 g, G→1 g, MG→0,001 g, UN→1 un, MI/MIL→1000 un, L→1000 ml
 */
export function calcularFatorDeUnidadeComercial(unidadeComercial: string): number | null {
  const raw = (unidadeComercial || "").trim().toUpperCase().replace(",", ".");
  if (!raw) return null;

  const match = raw.match(/^(\d+(?:\.\d+)?)\s*([A-Z%]+)$/) || raw.match(/^([A-Z%]+)$/);
  if (!match) return null;

  let n = 1;
  let unidade: string;
  if (match.length === 3 && match[2]) {
    n = parseFloat(match[1]);
    unidade = match[2];
  } else {
    unidade = match[1];
  }
  if (!Number.isFinite(n) || n <= 0) return null;

  const bases: Record<string, number> = {
    KG: 1000,
    G: 1,
    MG: 0.001,
    UN: 1,
    UND: 1,
    UNI: 1,
    MI: 1000,
    MIL: 1000,
    MILHEIRO: 1000,
    L: 1000,
    LT: 1000,
    ML: 1,
  };

  const base = bases[unidade];
  if (base == null) return null;
  return n * base;
}

export function normalizarDescricaoItem(descricao: string): string {
  return descricao
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
