// Sistema de Ordens de Produção Industrial
// Integrado com Formulação e Estoque

export type StatusOrdemProducao = 
  | 'RASCUNHO'
  | 'AGUARDANDO_MATERIAIS'
  | 'AGUARDANDO_INICIO'
  | 'EM_PRODUCAO'
  | 'PAUSADA'
  | 'FINALIZADA'
  | 'CANCELADA';

export type StatusBaixaEstoque = 'PENDENTE' | 'PARCIAL' | 'COMPLETA';

export interface ConsumoInsumoOP {
  id: string;
  insumo_id: string;
  item_id?: string;
  lote_id?: string;
  
  // Identificação
  nome_insumo: string;
  categoria: 'ATIVO' | 'EXCIPIENTE' | 'ADITIVO_TECNOLOGICO';
  
  // Quantidades calculadas
  quantidade_por_capsula_mg: number;
  quantidade_total_mg: number;
  quantidade_total_g: number;
  quantidade_total_kg: number;
  
  // Custo
  custo_unitario_kg?: number;
  custo_total?: number;
  
  // Baixa de estoque
  quantidade_baixada_g: number;
  status_baixa: StatusBaixaEstoque;
  
  // Lote utilizado
  lote_numero?: string;
  lote_validade?: string;
}

export interface OrdemProducao {
  id: string;
  codigo: string;                // OP-2025-0001
  
  // Vínculo com fórmula/produto
  formula_id: string;
  formula_codigo: string;
  produto_nome: string;
  
  // Configuração de produção
  quantidade_doses: number;
  capsulas_por_dose: number;
  total_capsulas: number;
  tipo_capsula: string;
  
  // Peso total
  peso_por_capsula_mg: number;
  peso_total_lote_g: number;
  peso_total_lote_kg: number;
  
  // Consumo de insumos
  insumos: ConsumoInsumoOP[];
  
  // Custo total
  custo_total_insumos: number;
  custo_por_capsula: number;
  
  // Datas
  data_prevista_inicio?: string;
  data_inicio?: string;
  data_conclusao?: string;
  
  // Progresso
  progresso: number;            // 0-100
  capsulas_produzidas: number;
  
  // Status
  status: StatusOrdemProducao;
  status_baixa_estoque: StatusBaixaEstoque;
  
  // Observações
  observacoes?: string;
  responsavel?: string;
  
  // Metadados
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// Função auxiliar para gerar código de OP
export function gerarCodigoOP(ano: number, sequencia: number): string {
  return `OP-${ano}-${String(sequencia).padStart(4, '0')}`;
}

// Função para calcular consumo total de insumos
export function calcularConsumoInsumos(
  ingredientes: Array<{
    insumo_id: string;
    item_id?: string;
    nome_interno: string;
    categoria: string;
    peso_a_pesar_mg: number;
    custo_por_kg?: number;
  }>,
  excipientes: Array<{
    nome: string;
    peso_mg: number;
    custo_por_kg?: number;
  }>,
  totalCapsulas: number
): ConsumoInsumoOP[] {
  const consumos: ConsumoInsumoOP[] = [];
  
  // Ingredientes ativos
  ingredientes.forEach(ing => {
    const qtdTotalMg = ing.peso_a_pesar_mg * totalCapsulas;
    const qtdTotalG = qtdTotalMg / 1000;
    const qtdTotalKg = qtdTotalG / 1000;
    
    consumos.push({
      id: crypto.randomUUID(),
      insumo_id: ing.insumo_id,
      item_id: ing.item_id,
      nome_insumo: ing.nome_interno,
      categoria: ing.categoria as 'ATIVO' | 'EXCIPIENTE' | 'ADITIVO_TECNOLOGICO',
      quantidade_por_capsula_mg: ing.peso_a_pesar_mg,
      quantidade_total_mg: qtdTotalMg,
      quantidade_total_g: Math.round(qtdTotalG * 1000) / 1000,
      quantidade_total_kg: Math.round(qtdTotalKg * 1000000) / 1000000,
      custo_unitario_kg: ing.custo_por_kg,
      custo_total: ing.custo_por_kg ? qtdTotalKg * ing.custo_por_kg : undefined,
      quantidade_baixada_g: 0,
      status_baixa: 'PENDENTE',
    });
  });
  
  // Excipientes
  excipientes.forEach(exc => {
    const qtdTotalMg = exc.peso_mg * totalCapsulas;
    const qtdTotalG = qtdTotalMg / 1000;
    const qtdTotalKg = qtdTotalG / 1000;
    
    consumos.push({
      id: crypto.randomUUID(),
      insumo_id: '',
      nome_insumo: exc.nome,
      categoria: 'EXCIPIENTE',
      quantidade_por_capsula_mg: exc.peso_mg,
      quantidade_total_mg: qtdTotalMg,
      quantidade_total_g: Math.round(qtdTotalG * 1000) / 1000,
      quantidade_total_kg: Math.round(qtdTotalKg * 1000000) / 1000000,
      custo_unitario_kg: exc.custo_por_kg,
      custo_total: exc.custo_por_kg ? qtdTotalKg * exc.custo_por_kg : undefined,
      quantidade_baixada_g: 0,
      status_baixa: 'PENDENTE',
    });
  });
  
  return consumos;
}

// Função para formatar quantidade em múltiplas unidades
export function formatarQuantidadeMultipla(valorMg: number): {
  mg: string;
  g: string;
  kg: string;
} {
  return {
    mg: valorMg.toFixed(2),
    g: (valorMg / 1000).toFixed(4),
    kg: (valorMg / 1000000).toFixed(6),
  };
}
