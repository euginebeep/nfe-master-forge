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
  
  // Embalagem padrão (OBSOLETOS — não usar em cálculos novos)
  custo_capsula_vazia?: number;
  custo_frasco_padrao?: number;
  custo_rotulo_padrao?: number;
  custo_lacre_padrao?: number;
  
  // Complementos padrão (NOVOS — referências de itens do cadastro)
  capsula_padrao_id?: string | null;
  pote_padrao_id?: string | null;
  tampa_padrao_id?: string | null;
  rotulo_padrao_id?: string | null;
  lacre_padrao_id?: string | null;
  
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

/**
 * Calcula custo de embalagem lendo preços dos itens padrão cadastrados.
 * Se algum item não tiver preço ou não estiver configurado, trata como custo 0 e sinaliza.
 * 
 * @param quantidade Quantidade de unidades
 * @param tipo Tipo de apresentação (CAPSULA, LIQUIDO, PO)
 * @param config Configuração de custos (contém IDs dos itens padrão)
 * @param precosItens Mapa de preços dos itens: { [itemId]: custo_por_unidade_interna }
 * @returns Custo total de embalagem
 */
export function calcularCustoEmbalagem(
  quantidade: number,
  tipo: 'CAPSULA' | 'LIQUIDO' | 'PO',
  config: ConfigCustosProducao,
  precosItens?: Record<string, number>
): number {
  // Se não houver mapa de preços, usar fallback aos campos obsoletos (compatibilidade)
  if (!precosItens) {
    if (tipo === 'CAPSULA') {
      return quantidade * (config.custo_capsula_vazia || 0);
    }
    return quantidade * ((config.custo_frasco_padrao || 0) + (config.custo_rotulo_padrao || 0) + (config.custo_lacre_padrao || 0));
  }

  if (tipo === 'CAPSULA') {
    // Cápsula padrão
    if (!config.capsula_padrao_id) return 0; // Não configurado
    const precoCapsulaPorUnidade = precosItens[config.capsula_padrao_id] || 0;
    return quantidade * precoCapsulaPorUnidade;
  }

  // Para líquido e pó: pote + tampa + rótulo + lacre
  let custoTotal = 0;
  
  if (config.pote_padrao_id) {
    custoTotal += precosItens[config.pote_padrao_id] || 0;
  }
  if (config.tampa_padrao_id) {
    custoTotal += precosItens[config.tampa_padrao_id] || 0;
  }
  if (config.rotulo_padrao_id) {
    custoTotal += precosItens[config.rotulo_padrao_id] || 0;
  }
  if (config.lacre_padrao_id) {
    custoTotal += precosItens[config.lacre_padrao_id] || 0;
  }

  return quantidade * custoTotal;
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
