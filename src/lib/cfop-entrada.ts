/**
 * Inverte CFOP de saída do fornecedor para CFOP de entrada do destinatário.
 * CFOPs de saída começam com 5 (interna) ou 6 (interestadual); entrada com 1 ou 2.
 * Exterior (7→3) também é coberto.
 *
 * Não inventa natureza: só troca o primeiro dígito da perspectiva.
 */
export function inverterCfopParaEntrada(cfop: string | null | undefined): string | null {
  if (!cfop) return null;
  const digits = String(cfop).replace(/\D/g, "");
  if (digits.length < 4) return cfop;

  const first = digits[0];
  const rest = digits.slice(1);
  const map: Record<string, string> = {
    "5": "1", // saída interna → entrada interna
    "6": "2", // saída interestadual → entrada interestadual
    "7": "3", // saída exterior → entrada exterior
  };

  if (map[first]) return map[first] + rest;
  // Já é CFOP de entrada (1/2/3) ou desconhecido — manter
  return digits.slice(0, 4);
}
