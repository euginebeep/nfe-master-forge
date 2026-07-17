/**
 * Formatação de massa de ativos — NUNCA usar toFixed(0) (zera micro-doses).
 */
export function fmtMassaAtivos(mg: number): string {
  if (!Number.isFinite(mg) || mg === 0) return "0";
  if (mg < 1) return mg.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  if (mg < 10) return mg.toFixed(2);
  return mg.toFixed(1);
}
