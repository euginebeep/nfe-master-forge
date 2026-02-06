// ============================================================
// TIPOS: CUSTO REAL INDUSTRIAL POR OP
// ============================================================

export interface CustoOP {
  id: string;
  op_id: string;
  op_codigo: string;
  
  // Custos detalhados
  custo_materia_prima_real: number;
  custo_excipientes: number;
  custo_embalagem: number;
  custo_mao_obra: number;
  custo_overhead: number;
  custo_perdas: number;
  
  // Rateio de impostos
  impostos_icms_rateado: number;
  impostos_ipi_rateado: number;
  impostos_pis_rateado: number;
  impostos_cofins_rateado: number;
  impostos_total_rateado: number;
  
  // Totais
  custo_total_real: number;
  custo_unitario_real: number;
  quantidade_produzida: number;
  quantidade_perdas: number;
  
  // Controle
  status: 'ABERTO' | 'FECHADO';
  fechado_em?: string;
  fechado_por?: string;
  
  // Auditoria
  created_at: string;
  updated_at: string;
}

export interface CustoOPLote {
  id: string;
  custo_op_id: string;
  lote_id: string;
  numero_lote: string;
  insumo_nome: string;
  quantidade_consumida_g: number;
  custo_unitario_lote: number;
  custo_total_lote: number;
  
  // Impostos do lote
  icms_valor: number;
  ipi_valor: number;
  pis_valor: number;
  cofins_valor: number;
  
  created_at: string;
}

export interface ConfigCustosProducao {
  id: string;
  
  // Mão de obra
  custo_hora_operador: number;
  custo_hora_tecnico: number;
  
  // Overhead
  custo_overhead_hora: number;
  percentual_overhead: number;
  
  // Embalagem padrão
  custo_capsula_vazia: number;
  custo_frasco_padrao: number;
  custo_rotulo_padrao: number;
  custo_lacre_padrao: number;
  
  // Perdas estimadas
  percentual_perda_padrao: number;
  
  updated_at: string;
}

// ============================================================
// HELPERS: CÁLCULO DE CUSTO
// ============================================================

export function calcularCustoMaoObra(
  tempoTotalMinutos: number,
  config: ConfigCustosProducao,
  numOperadores: number = 1,
  numTecnicos: number = 1
): number {
  const horasTrabalhadas = tempoTotalMinutos / 60;
  const custoOperadores = horasTrabalhadas * config.custo_hora_operador * numOperadores;
  const custoTecnicos = horasTrabalhadas * config.custo_hora_tecnico * numTecnicos;
  return custoOperadores + custoTecnicos;
}

export function calcularCustoOverhead(
  custoBase: number,
  config: ConfigCustosProducao
): number {
  return custoBase * (config.percentual_overhead / 100);
}

export function calcularCustoEmbalagem(
  quantidade: number,
  tipo: 'CAPSULA' | 'LIQUIDO' | 'PO',
  config: ConfigCustosProducao
): number {
  if (tipo === 'CAPSULA') {
    return quantidade * config.custo_capsula_vazia;
  }
  // Para líquido e pó: frasco + rótulo + lacre
  return quantidade * (config.custo_frasco_padrao + config.custo_rotulo_padrao + config.custo_lacre_padrao);
}

export function calcularCustoPerdas(
  custoTotal: number,
  quantidadePlanejada: number,
  quantidadeProduzida: number
): number {
  if (quantidadeProduzida >= quantidadePlanejada) return 0;
  const percentualPerda = ((quantidadePlanejada - quantidadeProduzida) / quantidadePlanejada) * 100;
  return (custoTotal * percentualPerda) / 100;
}

export function calcularRateioImpostos(
  lotesConsumidos: CustoOPLote[],
  custoTotalMP: number
): {
  icms: number;
  ipi: number;
  pis: number;
  cofins: number;
  total: number;
} {
  const totais = lotesConsumidos.reduce(
    (acc, lote) => ({
      icms: acc.icms + (lote.icms_valor || 0),
      ipi: acc.ipi + (lote.ipi_valor || 0),
      pis: acc.pis + (lote.pis_valor || 0),
      cofins: acc.cofins + (lote.cofins_valor || 0),
    }),
    { icms: 0, ipi: 0, pis: 0, cofins: 0 }
  );
  
  return {
    ...totais,
    total: totais.icms + totais.ipi + totais.pis + totais.cofins,
  };
}
