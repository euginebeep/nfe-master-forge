// ============================================================
// ORDEM DE PRODUÇÃO INDUSTRIAL - TIPOS E INTERFACES
// PADRÃO SEMI-AUTOMÁTICO COM RASTREABILIDADE ANVISA
// ============================================================

// ============================================================
// STATUS E ENUMS
// ============================================================

export type StatusOP = 
  | 'PLANEJADA' 
  | 'AGUARDANDO_MATERIAIS'
  | 'EM_PRODUCAO' 
  | 'FINALIZADA' 
  | 'BLOQUEADA'
  | 'CANCELADA';

export type TipoPesagem = 'CRITICA' | 'PADRAO';

export type StatusQC = 'PENDENTE' | 'APROVADO' | 'REPROVADO';

export type StatusAlocacaoLote = 'PENDENTE' | 'ALOCADO' | 'CONSUMIDO';

// ============================================================
// PICK LIST - ALOCAÇÃO DE LOTES
// ============================================================

export interface LoteDisponivel {
  lote_id: string;
  numero_lote: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  data_validade?: string;
  quantidade_disponivel: number;
  unidade: string;
  custo_unitario?: number;
  status: string;
}

export interface AlocacaoLoteOP {
  id: string;
  op_id: string;
  insumo_id: string;
  insumo_nome: string;
  
  // Lote selecionado
  lote_id: string;
  numero_lote: string;
  fornecedor_nome?: string;
  
  // Quantidades
  quantidade_necessaria_g: number;
  quantidade_alocada_g: number;
  quantidade_consumida_g: number;
  
  // Custo
  custo_unitario: number;
  custo_total: number;
  
  // Status
  status: StatusAlocacaoLote;
  
  // Rastreabilidade
  created_at: string;
  alocado_por?: string;
  consumido_em?: string;
}

// ============================================================
// PESAGEM INDUSTRIAL
// ============================================================

export interface ItemPesagem {
  id: string;
  op_id: string;
  ordem: number;
  
  // Identificação
  insumo_id?: string;
  insumo_nome: string;
  categoria: 'PREMIX' | 'ATIVO' | 'VEICULO_BASE' | 'TECNOLOGICO';
  
  // Classificação de pesagem
  tipo_pesagem: TipoPesagem;
  motivo_critico?: string; // "Quantidade < 1mg" | "Unidade UI" | etc
  
  // Quantidades
  quantidade_formula_mg: number;
  quantidade_lote_g: number;
  tolerancia_percentual: number;
  quantidade_minima_g: number;
  quantidade_maxima_g: number;
  
  // Pesagem realizada
  quantidade_pesada_g?: number;
  dentro_tolerancia?: boolean;
  tolerancia_utilizada?: boolean;
  
  // Conferência
  pesado_por?: string;
  conferido_por?: string; // Obrigatório para pesagem crítica
  pesado_em?: string;
  
  // Lote vinculado
  lote_id?: string;
  numero_lote?: string;
  
  // Observações
  observacoes?: string;
}

// ============================================================
// DISTRIBUIÇÃO GEOMÉTRICA
// ============================================================

export interface PassoDistribuicaoGeometrica {
  passo: number;
  descricao: string;
  proporcao: string;
  observacao?: string;
}

export interface ProcedimentoDistribuicaoGeometrica {
  ativo_nome: string;
  quantidade_ativo_mg: number;
  diluente_nome: string;
  passos: PassoDistribuicaoGeometrica[];
}

// ============================================================
// CONTROLE DE QUALIDADE
// ============================================================

export interface ControleQualidadeOP {
  id: string;
  op_id: string;
  
  // Testes obrigatórios
  aparencia_po?: string;
  aparencia_conforme?: boolean;
  
  fluidez?: string;
  fluidez_conforme?: boolean;
  
  homogeneidade?: string;
  homogeneidade_conforme?: boolean;
  
  peso_medio_capsulas_mg?: number;
  peso_minimo_capsulas_mg?: number;
  peso_maximo_capsulas_mg?: number;
  peso_conforme?: boolean;
  
  // Resultado
  status: StatusQC;
  observacoes?: string;
  motivo_reprovacao?: string;
  
  // Auditoria
  avaliado_por?: string;
  avaliado_em?: string;
}

// ============================================================
// CONTROLE DE PERDAS
// ============================================================

export interface ControlePerdas {
  // Planejamento
  quantidade_planejada: number;
  acrescimo_percentual: number; // Ex: 5%
  quantidade_com_acrescimo: number;
  
  // Realizado
  quantidade_produzida: number;
  quantidade_aprovada: number;
  quantidade_rejeitada: number;
  
  // Cálculos
  perda_total: number;
  perda_percentual: number;
  rendimento_percentual: number;
}

// ============================================================
// ORDEM DE PRODUÇÃO PRINCIPAL
// ============================================================

export interface OrdemProducaoIndustrial {
  id: string;
  codigo: string; // OP-2025-0001
  
  // Vínculo com fórmula
  formula_id: string;
  formula_codigo: string;
  formula_versao: number;
  
  // Produto acabado
  produto_nome: string;
  produto_id?: string;
  
  // Configuração
  tipo_apresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO';
  peso_unidade_mg?: number; // Para cápsula
  volume_unidade_ml?: number; // Para líquido
  
  // Quantidades
  quantidade_planejada: number;
  acrescimo_producao_percentual: number;
  quantidade_com_acrescimo: number;
  
  // Lote do produto acabado
  lote_produto_acabado?: string;
  data_fabricacao?: string;
  data_validade?: string;
  
  // Equipe
  responsavel_tecnico?: string;
  responsavel_tecnico_id?: string;
  operadores?: string[];
  
  // Datas
  data_planejada?: string;
  data_inicio?: string;
  data_conclusao?: string;
  
  // Status
  status: StatusOP;
  
  // Pick List e Pesagem
  alocacoes_lote: AlocacaoLoteOP[];
  itens_pesagem: ItemPesagem[];
  
  // Distribuição Geométrica (se houver ativos críticos)
  procedimentos_diluicao: ProcedimentoDistribuicaoGeometrica[];
  
  // QC
  controle_qualidade?: ControleQualidadeOP;
  
  // Perdas
  controle_perdas?: ControlePerdas;
  
  // Custos
  custo_total_insumos: number;
  custo_por_unidade: number;
  
  // Rastreabilidade
  lotes_mp_origem: string[]; // IDs dos lotes de MP consumidos
  
  // Observações
  observacoes?: string;
  
  // Auditoria
  created_at: string;
  updated_at: string;
  created_by?: string;
  finalizado_por?: string;
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Gera código único da OP
 */
export function gerarCodigoOP(ano: number, sequencia: number): string {
  return `OP-${ano}-${String(sequencia).padStart(4, '0')}`;
}

/**
 * Gera número de lote do produto acabado
 * Formato: AAMMDD-XXX (Ano, Mês, Dia, Sequência)
 */
export function gerarLoteProdutoAcabado(dataFabricacao: Date, sequencia: number): string {
  const ano = String(dataFabricacao.getFullYear()).slice(-2);
  const mes = String(dataFabricacao.getMonth() + 1).padStart(2, '0');
  const dia = String(dataFabricacao.getDate()).padStart(2, '0');
  return `${ano}${mes}${dia}-${String(sequencia).padStart(3, '0')}`;
}

/**
 * Classifica tipo de pesagem
 */
export function classificarPesagem(
  quantidadeMg: number,
  unidadeOriginal?: string
): { tipo: TipoPesagem; motivo?: string } {
  if (quantidadeMg < 1) {
    return { tipo: 'CRITICA', motivo: 'Quantidade < 1mg' };
  }
  if (unidadeOriginal === 'MCG' || unidadeOriginal === 'UI') {
    return { tipo: 'CRITICA', motivo: `Unidade ${unidadeOriginal}` };
  }
  return { tipo: 'PADRAO' };
}

/**
 * Gera procedimento de distribuição geométrica
 */
export function gerarDistribuicaoGeometrica(
  ativoNome: string,
  quantidadeAtivoMg: number,
  diluenteNome: string,
  quantidadeDiluenteTotal: number
): ProcedimentoDistribuicaoGeometrica {
  const passos: PassoDistribuicaoGeometrica[] = [
    {
      passo: 1,
      descricao: `Pesar ${quantidadeAtivoMg.toFixed(4)} mg de ${ativoNome}`,
      proporcao: '1:0',
      observacao: 'PESAGEM CRÍTICA - Dupla conferência obrigatória',
    },
    {
      passo: 2,
      descricao: `Adicionar quantidade IGUAL de ${diluenteNome}`,
      proporcao: '1:1',
      observacao: 'Homogeneizar por 2 minutos',
    },
    {
      passo: 3,
      descricao: `Dobrar volume com ${diluenteNome}`,
      proporcao: '1:2',
      observacao: 'Homogeneizar por 2 minutos',
    },
    {
      passo: 4,
      descricao: `Dobrar volume novamente`,
      proporcao: '1:4',
      observacao: 'Homogeneizar por 2 minutos',
    },
    {
      passo: 5,
      descricao: 'Repetir até completar volume total',
      proporcao: 'Progressivo',
      observacao: 'Manter proporção geométrica',
    },
    {
      passo: 6,
      descricao: 'Homogeneização final',
      proporcao: 'Final',
      observacao: 'Homogeneizar por 5 minutos',
    },
  ];
  
  return {
    ativo_nome: ativoNome,
    quantidade_ativo_mg: quantidadeAtivoMg,
    diluente_nome: diluenteNome,
    passos,
  };
}

/**
 * Calcula tolerância de pesagem
 * Padrão: ±10%
 */
export function calcularTolerancia(
  quantidade: number,
  percentual: number = 10
): { minimo: number; maximo: number } {
  const fator = percentual / 100;
  return {
    minimo: quantidade * (1 - fator),
    maximo: quantidade * (1 + fator),
  };
}

/**
 * Verifica se quantidade está dentro da tolerância
 */
export function verificarTolerancia(
  quantidadePesada: number,
  quantidadeEsperada: number,
  toleranciaPercentual: number = 10
): { dentro: boolean; desvio: number; desvioPercentual: number } {
  const { minimo, maximo } = calcularTolerancia(quantidadeEsperada, toleranciaPercentual);
  const desvio = quantidadePesada - quantidadeEsperada;
  const desvioPercentual = (desvio / quantidadeEsperada) * 100;
  
  return {
    dentro: quantidadePesada >= minimo && quantidadePesada <= maximo,
    desvio,
    desvioPercentual,
  };
}

/**
 * Calcula rendimento da produção
 */
export function calcularRendimento(
  quantidadePlanejada: number,
  quantidadeProduzida: number,
  quantidadeAprovada: number
): ControlePerdas {
  const acrescimo = 5; // 5% padrão
  const comAcrescimo = Math.ceil(quantidadePlanejada * (1 + acrescimo / 100));
  const rejeitada = quantidadeProduzida - quantidadeAprovada;
  const perdaTotal = comAcrescimo - quantidadeAprovada;
  
  return {
    quantidade_planejada: quantidadePlanejada,
    acrescimo_percentual: acrescimo,
    quantidade_com_acrescimo: comAcrescimo,
    quantidade_produzida: quantidadeProduzida,
    quantidade_aprovada: quantidadeAprovada,
    quantidade_rejeitada: rejeitada,
    perda_total: perdaTotal,
    perda_percentual: parseFloat(((perdaTotal / comAcrescimo) * 100).toFixed(2)),
    rendimento_percentual: parseFloat(((quantidadeAprovada / quantidadePlanejada) * 100).toFixed(2)),
  };
}

// ============================================================
// ORDEM DE MISTURA FIXA
// ============================================================

export const ORDEM_MISTURA_INDUSTRIAL = [
  { ordem: 1, categoria: 'PREMIX', descricao: 'Pré-diluições (quando houver)' },
  { ordem: 2, categoria: 'ATIVO', descricao: 'Ativos principais' },
  { ordem: 3, categoria: 'VEICULO_BASE', descricao: 'Veículo base (Amido/Celulose/Pré-blend)' },
  { ordem: 4, categoria: 'TECNOLOGICO', descricao: 'Talco Farmacêutico' },
  { ordem: 5, categoria: 'TECNOLOGICO', descricao: 'Dióxido de Silício' },
  { ordem: 6, categoria: 'TECNOLOGICO', descricao: 'Estearato de Magnésio (SEMPRE último)' },
] as const;
