/**
 * Função declarada no produto (formula_itens) — doutrina 07-ativo-vs-excipiente.
 * Discriminador = função no produto, nunca identidade química.
 * NULL / omitido → ATIVO (fail-safe estrito: omissão não aprova).
 */

export const FUNCOES_NO_PRODUTO = [
  "ATIVO",
  "EXCIPIENTE",
  "COADJUVANTE",
  "VEICULO",
] as const;

export type FuncaoNoProduto = (typeof FUNCOES_NO_PRODUTO)[number];

export function normalizarFuncaoNoProduto(
  valor: string | null | undefined,
): FuncaoNoProduto {
  const v = String(valor || "").trim().toUpperCase();
  if ((FUNCOES_NO_PRODUTO as readonly string[]).includes(v)) {
    return v as FuncaoNoProduto;
  }
  // Omissão = ATIVO — dívida de declaração não pode virar aprovação silenciosa.
  return "ATIVO";
}

export function ehNaoAtivo(valor: string | null | undefined): boolean {
  return normalizarFuncaoNoProduto(valor) !== "ATIVO";
}

/** Excipiente/coadjuvante/veículo: IN 211 não ingerida — não afirmar conformidade. */
export function exigeJustificativaFuncao(valor: string | null | undefined): boolean {
  return ehNaoAtivo(valor);
}

export function rotuloFuncaoNoProduto(valor: string | null | undefined): string {
  switch (normalizarFuncaoNoProduto(valor)) {
    case "ATIVO":
      return "Ativo";
    case "EXCIPIENTE":
      return "Excipiente";
    case "COADJUVANTE":
      return "Coadjuvante";
    case "VEICULO":
      return "Veículo";
    default:
      return "Ativo";
  }
}
