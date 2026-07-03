// DISTRIBUIÇÃO GEOMÉTRICA PARA MICRO-DOSES
// Função compartilhada entre tela (OPPreMixGeometrico) e impressão (OPImpressaoTemplate)
// ============================================================

export interface PassoDistribuicao {
  passo: number;
  descricao: string;
  massa_adicionada: string;  // Formato: "630 mg" (sem zeros inúteis)
  massa_total: string;       // Formato: "630 mg" (sem zeros inúteis)
  tempo_mistura: string;
}

/**
 * Calcula os passos de distribuição geométrica para micro-doses (< 1 g)
 * @param quantidadeAtivo - quantidade do ativo em mg
 * @param quantidadeDiluente - quantidade do diluente (excipiente base) em mg
 * @returns Array de passos com descrição, massa e tempo
 */
export function calcularDistribuicaoGeometrica(
  quantidadeAtivo: number,
  quantidadeDiluente: number
): PassoDistribuicao[] {
  const passos: PassoDistribuicao[] = [];
  let massaAtual = quantidadeAtivo;
  let passo = 1;
  
  // Passo 1: Peso do ativo
  const formatarMassa = (valor: number) => 
    `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} mg`;
  
  passos.push({
    passo: 1,
    descricao: `Pesar o ativo puro`,
    massa_adicionada: formatarMassa(quantidadeAtivo),
    massa_total: formatarMassa(quantidadeAtivo),
    tempo_mistura: '–'
  });
  
  // Passos de distribuição geométrica (dobrar a cada etapa)
  let massaDiluenteRestante = quantidadeDiluente;
  
  while (massaDiluenteRestante > 0 && passo < 10) {
    passo++;
    const massaAdicionar = Math.min(massaAtual, massaDiluenteRestante);
    massaDiluenteRestante -= massaAdicionar;
    massaAtual += massaAdicionar;
    
    passos.push({
      passo,
      descricao: passo === 2 ? 'Adicionar quantidade IGUAL de diluente' : `Dobrar volume com diluente`,
      massa_adicionada: formatarMassa(massaAdicionar),
      massa_total: formatarMassa(massaAtual),
      tempo_mistura: '2 minutos'
    });
  }
  
  // Passo final: Homogeneização
  passos.push({
    passo: passo + 1,
    descricao: 'Homogeneização final do pré-mix',
    massa_adicionada: '–',
    massa_total: formatarMassa(quantidadeAtivo + quantidadeDiluente),
    tempo_mistura: '5 minutos (mínimo)'
  });
  
  return passos;
}
