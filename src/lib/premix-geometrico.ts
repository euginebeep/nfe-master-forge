/**
 * Roteiro de diluição geométrica para pré-mix de ativos ultra-críticos.
 * Reexporta o motor já usado em OPPreMixGeometrico.
 */
import {
  calcularDistribuicaoGeometrica,
  type PassoDistribuicao,
} from "@/lib/distribuicao-geometrica";

export { calcularDistribuicaoGeometrica, type PassoDistribuicao };

export type RoteiroPremixGeometrico = {
  massaAtivoMg: number;
  fatorDiluicao: number;
  diluenteMg: number;
  massaFinalPremixMg: number;
  passos: PassoDistribuicao[];
};

/** Monta o roteiro 1:N a partir da massa de ativo puro e do fator (ex.: 1000). */
export function montarRoteiroPremixGeometrico(
  massaAtivoMg: number,
  fatorDiluicao: number,
): RoteiroPremixGeometrico {
  const fator = Math.max(1, Number(fatorDiluicao) || 1);
  const diluenteMg = massaAtivoMg * (fator - 1);
  const passos = calcularDistribuicaoGeometrica(
    massaAtivoMg,
    Math.min(diluenteMg, 50_000),
  );
  return {
    massaAtivoMg,
    fatorDiluicao: fator,
    diluenteMg,
    massaFinalPremixMg: massaAtivoMg + diluenteMg,
    passos,
  };
}
