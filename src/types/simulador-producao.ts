// ============================================================
// TIPOS: SIMULADOR INDUSTRIAL DE PRODUÇÃO
// ============================================================

export interface ConfigCapacidadeProducao {
  id: string;
  
  // Máquinas
  encapsuladora_caps_min: number;
  misturador_capacidade_kg: number;
  
  // Tempos médios (minutos)
  tempo_setup_pesagem_min: number;
  tempo_pesagem_item_padrao_min: number;
  tempo_pesagem_item_critico_min: number;
  tempo_mistura_base_min: number;
  tempo_diluicao_geometrica_min: number;
  tempo_setup_encapsulamento_min: number;
  tempo_limpeza_min: number;
  tempo_qc_min: number;
  
  // Equipe
  operadores_disponiveis: number;
  tecnicos_disponiveis: number;
  
  // Fatores
  fator_eficiencia: number;
  
  updated_at: string;
}

export interface SimulacaoProducao {
  id: string;
  formula_id: string;
  formula_codigo: string;
  quantidade_unidades: number;
  
  // Tempos estimados (minutos)
  tempo_pesagem_estimado: number;
  tempo_mistura_estimado: number;
  tempo_encapsulamento_estimado: number;
  tempo_qc_estimado: number;
  tempo_total_estimado: number;
  
  // Custos estimados
  custo_mp_estimado: number;
  custo_mao_obra_estimado: number;
  custo_overhead_estimado: number;
  custo_total_estimado: number;
  custo_unitario_estimado: number;
  
  // Rendimento
  rendimento_esperado_percent: number;
  perdas_estimadas_unidades: number;
  
  // Gargalos e sugestões
  gargalos: Gargalo[];
  sugestoes: Sugestao[];
  
  // Comparação com real
  op_id?: string;
  custo_real?: number;
  tempo_real_min?: number;
  desvio_custo_percent?: number;
  desvio_tempo_percent?: number;
  
  created_at: string;
}

export interface Gargalo {
  etapa: string;
  descricao: string;
  impacto: 'ALTO' | 'MEDIO' | 'BAIXO';
  tempo_adicional_min: number;
}

export interface Sugestao {
  tipo: 'AUMENTAR_LOTE' | 'DIVIDIR_LOTE' | 'OTIMIZAR_EQUIPE' | 'REVISAR_FORMULA';
  descricao: string;
  economia_estimada?: number;
  tempo_economizado_min?: number;
}

export interface DadosFormulaSimulacao {
  id: string;
  codigo: string;
  nome: string;
  tipo_apresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO';
  peso_unidade_mg?: number;
  itens: Array<{
    nome: string;
    quantidade_mg: number;
    ativo_critico: boolean;
    exige_premix: boolean;
  }>;
}

// ============================================================
// HELPERS: SIMULAÇÃO DE PRODUÇÃO
// ============================================================

export function simularProducao(
  formula: DadosFormulaSimulacao,
  quantidade: number,
  config: ConfigCapacidadeProducao,
  custoMPEstimado: number
): Omit<SimulacaoProducao, 'id' | 'created_at'> {
  const gargalos: Gargalo[] = [];
  const sugestoes: Sugestao[] = [];

  // Contagem de itens
  const itensCriticos = formula.itens.filter(i => i.ativo_critico).length;
  const itensPadrao = formula.itens.length - itensCriticos;
  const itensPreMix = formula.itens.filter(i => i.exige_premix).length;

  // ============================================================
  // TEMPO DE PESAGEM
  // ============================================================
  let tempoPesagem = config.tempo_setup_pesagem_min;
  tempoPesagem += itensPadrao * config.tempo_pesagem_item_padrao_min;
  tempoPesagem += itensCriticos * config.tempo_pesagem_item_critico_min;

  if (itensCriticos > 3) {
    gargalos.push({
      etapa: 'PESAGEM',
      descricao: `${itensCriticos} ativos críticos requerem dupla conferência`,
      impacto: 'ALTO',
      tempo_adicional_min: itensCriticos * 5,
    });
    tempoPesagem += itensCriticos * 5;
  }

  // ============================================================
  // TEMPO DE MISTURA
  // ============================================================
  let tempoMistura = config.tempo_mistura_base_min;
  
  // Diluição geométrica para cada ativo crítico
  tempoMistura += itensCriticos * config.tempo_diluicao_geometrica_min;
  
  // Pré-mix adicional
  tempoMistura += itensPreMix * 10;

  // Verificar capacidade do misturador
  const pesoTotalKg = (formula.peso_unidade_mg || 500) * quantidade / 1_000_000;
  if (pesoTotalKg > config.misturador_capacidade_kg) {
    const numBateladas = Math.ceil(pesoTotalKg / config.misturador_capacidade_kg);
    gargalos.push({
      etapa: 'MISTURA',
      descricao: `Lote excede capacidade do misturador. Necessário ${numBateladas} bateladas`,
      impacto: 'ALTO',
      tempo_adicional_min: (numBateladas - 1) * config.tempo_mistura_base_min,
    });
    tempoMistura *= numBateladas;
  }

  // ============================================================
  // TEMPO DE ENCAPSULAMENTO
  // ============================================================
  let tempoEncapsulamento = config.tempo_setup_encapsulamento_min;
  
  if (formula.tipo_apresentacao === 'CAPSULA') {
    const tempoProducao = quantidade / config.encapsuladora_caps_min;
    tempoEncapsulamento += tempoProducao;
    
    // Aplicar fator de eficiência
    tempoEncapsulamento = tempoEncapsulamento / config.fator_eficiencia;
  } else {
    // Para líquido/pó: tempo proporcional
    tempoEncapsulamento += Math.ceil(quantidade / 100) * 2;
  }

  // ============================================================
  // TEMPO DE QC
  // ============================================================
  const tempoQC = config.tempo_qc_min;

  // ============================================================
  // TEMPO TOTAL
  // ============================================================
  const tempoLimpeza = config.tempo_limpeza_min;
  const tempoTotal = tempoPesagem + tempoMistura + tempoEncapsulamento + tempoQC + tempoLimpeza;

  // ============================================================
  // CUSTOS
  // ============================================================
  const horasTrabalho = tempoTotal / 60;
  const custoMaoObra = (
    horasTrabalho * config.operadores_disponiveis * 25 +
    horasTrabalho * config.tecnicos_disponiveis * 50
  );
  const custoOverhead = custoMaoObra * 0.1;
  const custoTotal = custoMPEstimado + custoMaoObra + custoOverhead;
  const custoUnitario = custoTotal / quantidade;

  // ============================================================
  // RENDIMENTO
  // ============================================================
  const rendimentoEsperado = 95; // 95% padrão
  const perdasEstimadas = Math.ceil(quantidade * 0.05);

  // ============================================================
  // SUGESTÕES
  // ============================================================
  if (quantidade < 5000 && formula.tipo_apresentacao === 'CAPSULA') {
    sugestoes.push({
      tipo: 'AUMENTAR_LOTE',
      descricao: 'Lotes maiores (>5000 un) otimizam o custo fixo de setup',
      economia_estimada: custoUnitario * 0.15 * quantidade,
    });
  }

  if (tempoTotal > 480) { // Mais de 8 horas
    sugestoes.push({
      tipo: 'DIVIDIR_LOTE',
      descricao: 'Produção ultrapassa jornada padrão. Considerar dividir em 2 dias',
      tempo_economizado_min: 0,
    });
  }

  if (itensCriticos > 5) {
    sugestoes.push({
      tipo: 'REVISAR_FORMULA',
      descricao: 'Muitos ativos críticos. Considerar uso de pré-mix industrial',
      tempo_economizado_min: itensCriticos * 10,
    });
  }

  return {
    formula_id: formula.id,
    formula_codigo: formula.codigo,
    quantidade_unidades: quantidade,
    tempo_pesagem_estimado: Math.round(tempoPesagem),
    tempo_mistura_estimado: Math.round(tempoMistura),
    tempo_encapsulamento_estimado: Math.round(tempoEncapsulamento),
    tempo_qc_estimado: tempoQC,
    tempo_total_estimado: Math.round(tempoTotal),
    custo_mp_estimado: custoMPEstimado,
    custo_mao_obra_estimado: custoMaoObra,
    custo_overhead_estimado: custoOverhead,
    custo_total_estimado: custoTotal,
    custo_unitario_estimado: custoUnitario,
    rendimento_esperado_percent: rendimentoEsperado,
    perdas_estimadas_unidades: perdasEstimadas,
    gargalos,
    sugestoes,
  };
}

export function formatarTempo(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const mins = minutos % 60;
  return mins > 0 ? `${horas}h ${mins}min` : `${horas}h`;
}

export function calcularDesvio(estimado: number, real: number): number {
  if (estimado === 0) return 0;
  return ((real - estimado) / estimado) * 100;
}
