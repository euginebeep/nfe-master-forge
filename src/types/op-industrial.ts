// ============================================================
// ORDEM DE PRODUÇÃO INDUSTRIAL - TIPOS ANVISA
// Sistema completo com todos os blocos obrigatórios
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

export type CategoriaMateriaPrima = 'ATIVO' | 'EXCIPIENTE_BASE' | 'EXCIPIENTE_TECNOLOGICO';

export type StatusQC = 'PENDENTE' | 'APROVADO' | 'REPROVADO';

export type CategoriaChecklist = 'PRE_PRODUCAO' | 'DURANTE_PRODUCAO' | 'POS_PRODUCAO' | 'QC';

export type StatusPesagemCritica = 'PENDENTE' | 'PESADO' | 'CONFERIDO' | 'REPROVADO';

// ============================================================
// BLOCO 1: IDENTIFICAÇÃO DA OP
// ============================================================

export interface OrdemProducaoIndustrial {
  id: string;
  codigo: string;
  
  // Produto
  produto_id?: string;
  produto_nome: string;
  
  // Fórmula vinculada (opcional)
  formula_id?: string;
  formula_codigo?: string;
  formula_versao?: number;
  
  // Quantidades (obrigatórias na criação)
  quantidade_frascos: number;
  capsulas_por_frasco: number;
  total_capsulas: number;
  acrescimo_percentual: number;
  total_capsulas_com_acrescimo: number;
  
  // Lote e datas
  lote_produto_acabado: string;
  data_fabricacao: string;
  data_validade: string;
  
  // Configuração técnica
  tipo_apresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO';
  peso_capsula_mg: number;
  tipo_capsula: string;
  excipiente_base: 'AMIDO' | 'CELULOSE' | 'PRE_BLEND';
  
  // Status
  status: StatusOP;
  
  // Equipe
  responsavel_producao_id?: string;
  responsavel_producao_nome?: string;
  operadores?: string[];
  
  // Workflow
  data_inicio_producao?: string;
  data_fim_producao?: string;
  
  // Observações
  observacoes?: string;
  motivo_bloqueio?: string;
  
  // Auditoria
  created_at: string;
  updated_at: string;
  created_by?: string;
  finalizado_por?: string;
}

// ============================================================
// BLOCO 2: MATÉRIAS-PRIMAS
// ============================================================

export interface OPMateriaPrima {
  id: string;
  op_id: string;
  
  // Insumo
  insumo_id?: string;
  insumo_nome: string;
  categoria: CategoriaMateriaPrima;
  
  // Lote selecionado
  lote_id?: string;
  numero_lote?: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  
  // Quantidades
  quantidade_teorica_mg: number;
  quantidade_teorica_g: number;
  quantidade_real_g?: number;
  unidade: string;
  
  // Pesagem
  pesagem_critica: boolean;
  motivo_critico?: string;
  tolerancia_percentual: number;
  quantidade_minima_g: number;
  quantidade_maxima_g: number;
  dentro_tolerancia?: boolean;
  
  // Ordem de mistura (FIXA ANVISA)
  ordem_mistura: number;
  
  // Conferência
  pesado_por?: string;
  pesado_em?: string;
  conferido_por?: string;
  conferido_em?: string;
  
  observacoes?: string;
  created_at: string;
}

// ============================================================
// BLOCO 3: EXCIPIENTES INDUSTRIAIS (FIXOS)
// ============================================================

export const EXCIPIENTES_TECNOLOGICOS_FIXOS = {
  TALCO: { nome: 'Talco Farmacêutico', percentual: 5.0 },
  DIOXIDO_SILICIO: { nome: 'Dióxido de Silício', percentual: 2.0 },
  ESTEARATO_MAGNESIO: { nome: 'Estearato de Magnésio', percentual: 2.5 },
} as const;

export const ORDEM_MISTURA_PADRAO = [
  { ordem: 1, categoria: 'ATIVO', descricao: 'Ativos de maior volume' },
  { ordem: 2, categoria: 'ATIVO', descricao: 'Ativos de menor volume' },
  { ordem: 3, categoria: 'EXCIPIENTE_BASE', descricao: 'Excipiente base (Amido/Celulose/Pré-blend)' },
  { ordem: 4, categoria: 'EXCIPIENTE_TECNOLOGICO', descricao: 'Dióxido de Silício' },
  { ordem: 5, categoria: 'EXCIPIENTE_TECNOLOGICO', descricao: 'Talco Farmacêutico' },
  { ordem: 6, categoria: 'EXCIPIENTE_TECNOLOGICO', descricao: 'Estearato de Magnésio (SEMPRE ÚLTIMO)' },
] as const;

// ============================================================
// BLOCO 5: PESAGEM CRÍTICA
// ============================================================

export interface OPPesagemCritica {
  id: string;
  op_id: string;
  materia_prima_id: string;
  
  // Dados do ativo
  insumo_nome: string;
  quantidade_teorica_mg: number;
  quantidade_pesada_mg?: number;
  
  // Conferência dupla obrigatória
  operador_pesagem_id?: string;
  operador_pesagem_nome?: string;
  assinatura_operador?: string;
  data_pesagem?: string;
  
  conferente_id?: string;
  conferente_nome?: string;
  assinatura_conferente?: string;
  data_conferencia?: string;
  
  // Status
  status: StatusPesagemCritica;
  observacoes?: string;
  
  created_at: string;
}

// ============================================================
// BLOCO 6: CHECKLIST OPERACIONAL
// ============================================================

export interface OPChecklist {
  id: string;
  op_id: string;
  
  item: string;
  categoria: CategoriaChecklist;
  ordem: number;
  obrigatorio: boolean;
  
  verificado: boolean;
  verificado_por?: string;
  verificado_em?: string;
  observacoes?: string;
  
  created_at: string;
}

export const CHECKLIST_PADRAO: Array<{ item: string; categoria: CategoriaChecklist; ordem: number; obrigatorio: boolean; codigo?: string }> = [
  // PRÉ-PRODUÇÃO (LIMPA TRAÇOS / LINE CLEARANCE)
  { codigo: 'LT-01', item: 'Remoção total de insumos e embalagens da OP anterior', categoria: 'PRE_PRODUCAO', ordem: 1, obrigatorio: true },
  { codigo: 'LT-02', item: 'Remoção de rótulos e documentos do lote anterior', categoria: 'PRE_PRODUCAO', ordem: 2, obrigatorio: true },
  { codigo: 'LT-03', item: 'Limpeza e sanitização (Álcool 70%) de bancadas e utensílios', categoria: 'PRE_PRODUCAO', ordem: 3, obrigatorio: true },
  { codigo: 'LT-04', item: 'Misturador/Equipamentos limpos, secos e identificados', categoria: 'PRE_PRODUCAO', ordem: 4, obrigatorio: true },
  { codigo: 'LT-05', item: 'Verificação de ausência de resíduos em frestas/placas', categoria: 'PRE_PRODUCAO', ordem: 5, obrigatorio: true },
  { codigo: 'LT-06', item: 'Conferência de lotes e validades das MPs da nova OP', categoria: 'PRE_PRODUCAO', ordem: 6, obrigatorio: true },
  { codigo: 'LT-07', item: 'Balança nivelada, limpa e com calibração em dia', categoria: 'PRE_PRODUCAO', ordem: 7, obrigatorio: true },
  
  // DURANTE PRODUÇÃO
  { codigo: 'PROD-01', item: 'Pesagem de ativos críticos com dupla conferência registrada', categoria: 'DURANTE_PRODUCAO', ordem: 8, obrigatorio: true },
  { codigo: 'PROD-02', item: 'Conferência de pesos reais dentro da tolerância (±10%)', categoria: 'DURANTE_PRODUCAO', ordem: 9, obrigatorio: true },
  { codigo: 'PROD-03', item: 'Ordem de mistura e tempos de homogeneização seguidos', categoria: 'DURANTE_PRODUCAO', ordem: 10, obrigatorio: true },
  { codigo: 'PROD-04', item: 'Limpeza concorrente de equipamentos entre bateladas', categoria: 'DURANTE_PRODUCAO', ordem: 11, obrigatorio: true },
  { codigo: 'PROD-05', item: 'Ajuste e teste de peso médio na encapsuladora', categoria: 'DURANTE_PRODUCAO', ordem: 12, obrigatorio: true },
  { codigo: 'PROD-06', item: 'Monitoramento de temperatura e umidade da sala', categoria: 'DURANTE_PRODUCAO', ordem: 13, obrigatorio: true },
  
  // PÓS-PRODUÇÃO
  { codigo: 'POS-01', item: 'Contagem final de unidades e conciliação de rendimento', categoria: 'POS_PRODUCAO', ordem: 14, obrigatorio: true },
  { codigo: 'POS-02', item: 'Conferência de lote e validade nos frascos/rótulos', categoria: 'POS_PRODUCAO', ordem: 15, obrigatorio: true },
  { codigo: 'POS-03', item: 'Amostra de retenção coletada e identificada', categoria: 'POS_PRODUCAO', ordem: 16, obrigatorio: true },
  { codigo: 'POS-04', item: 'Upload do rótulo final e fotos do produto no sistema', categoria: 'POS_PRODUCAO', ordem: 17, obrigatorio: true },
  { codigo: 'POS-05', item: 'Limpeza final e organização da área para próxima OP', categoria: 'POS_PRODUCAO', ordem: 18, obrigatorio: true },
  
  // CONTROLE DE QUALIDADE (QC)
  { codigo: 'QC-01', item: 'Teste de peso médio aprovado (conforme farmacopeia)', categoria: 'QC', ordem: 19, obrigatorio: true },
  { codigo: 'QC-02', item: 'Avaliação organoléptica (cor, odor, aspecto)', categoria: 'QC', ordem: 20, obrigatorio: true },
  { codigo: 'QC-03', item: 'Teste de desintegração/fluidez conforme aplicável', categoria: 'QC', ordem: 21, obrigatorio: true },
  { codigo: 'QC-04', item: 'Dossiê de produção completo e assinado pelo RT', categoria: 'QC', ordem: 22, obrigatorio: true },
];

// ============================================================
// CONTROLE DE QUALIDADE
// ============================================================

export interface OPControleQualidade {
  id: string;
  op_id: string;
  
  // Testes
  aparencia_po?: string;
  aparencia_conforme?: boolean;
  
  fluidez?: string;
  fluidez_conforme?: boolean;
  
  homogeneidade?: string;
  homogeneidade_conforme?: boolean;
  
  // Peso médio
  peso_medio_capsulas_mg?: number;
  peso_minimo_capsulas_mg?: number;
  peso_maximo_capsulas_mg?: number;
  desvio_padrao_peso?: number;
  peso_conforme?: boolean;
  
  // Resultado
  status: StatusQC;
  motivo_reprovacao?: string;
  observacoes?: string;
  
  avaliado_por?: string;
  avaliado_em?: string;
  
  created_at: string;
}

// ============================================================
// CONTROLE DE PERDAS
// ============================================================

export interface OPControlePerdas {
  id: string;
  op_id: string;
  
  quantidade_planejada: number;
  acrescimo_percentual: number;
  quantidade_com_acrescimo: number;
  
  quantidade_produzida: number;
  quantidade_aprovada: number;
  quantidade_rejeitada: number;
  
  perda_total: number;
  perda_percentual: number;
  rendimento_percentual: number;
  
  justificativa_perdas?: string;
  
  created_at: string;
  updated_at: string;
}

// ============================================================
// FORMULÁRIO DE CRIAÇÃO DE OP
// ============================================================

export interface CriarOPForm {
  // Produto
  produto_id?: string;
  produto_nome: string;
  
  // Fórmula (opcional)
  formula_id?: string;
  
  // Quantidades obrigatórias
  quantidade_frascos: number;
  capsulas_por_frasco: number;
  
  // Lote
  lote_produto_acabado: string;
  data_fabricacao: string;
  data_validade: string;
  
  // Configuração
  tipo_capsula: string;
  excipiente_base: 'AMIDO' | 'CELULOSE' | 'PRE_BLEND';
  
  // Responsável
  responsavel_producao_nome: string;
  
  // Observações
  observacoes?: string;
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

/**
 * Gera código único da OP
 */
export function gerarCodigoOP(sequencia: number): string {
  const ano = new Date().getFullYear();
  return `OP-${ano}-${String(sequencia).padStart(5, '0')}`;
}

/**
 * Gera número de lote do produto acabado
 * Formato: AAMMDD-XXX
 */
export function gerarLoteProdutoAcabado(dataFabricacao: Date, sequencia: number): string {
  const ano = String(dataFabricacao.getFullYear()).slice(-2);
  const mes = String(dataFabricacao.getMonth() + 1).padStart(2, '0');
  const dia = String(dataFabricacao.getDate()).padStart(2, '0');
  return `${ano}${mes}${dia}-${String(sequencia).padStart(3, '0')}`;
}

/**
 * Calcula data de validade (2 anos por padrão)
 */
export function calcularDataValidade(dataFabricacao: Date, meses: number = 24): Date {
  const validade = new Date(dataFabricacao);
  validade.setMonth(validade.getMonth() + meses);
  return validade;
}

/**
 * Identifica se um ativo é crítico (< 1mg ou unidade UI/MCG)
 */
export function isAtivoCritico(quantidadeMg: number, unidadeOriginal?: string): { critico: boolean; motivo?: string } {
  if (quantidadeMg < 1) {
    return { critico: true, motivo: 'Quantidade < 1mg' };
  }
  if (unidadeOriginal === 'MCG' || unidadeOriginal === 'UI') {
    return { critico: true, motivo: `Unidade ${unidadeOriginal}` };
  }
  return { critico: false };
}

/**
 * Calcula tolerância de pesagem (padrão ±10%)
 */
export function calcularTolerancia(quantidade: number, percentual: number = 10): { minimo: number; maximo: number } {
  const fator = percentual / 100;
  return {
    minimo: quantidade * (1 - fator),
    maximo: quantidade * (1 + fator),
  };
}

/**
 * Calcula excipientes tecnológicos para cápsula 500mg
 */
export function calcularExcipientesTecnologicos(pesoCapsula: number = 500): {
  talco_mg: number;
  dioxido_silicio_mg: number;
  estearato_mg: number;
  total_tecnologicos_mg: number;
} {
  const talco_mg = pesoCapsula * (EXCIPIENTES_TECNOLOGICOS_FIXOS.TALCO.percentual / 100);
  const dioxido_silicio_mg = pesoCapsula * (EXCIPIENTES_TECNOLOGICOS_FIXOS.DIOXIDO_SILICIO.percentual / 100);
  const estearato_mg = pesoCapsula * (EXCIPIENTES_TECNOLOGICOS_FIXOS.ESTEARATO_MAGNESIO.percentual / 100);
  
  return {
    talco_mg,
    dioxido_silicio_mg,
    estearato_mg,
    total_tecnologicos_mg: talco_mg + dioxido_silicio_mg + estearato_mg,
  };
}

/**
 * Calcula quantidade de excipiente base (Q.S.P.)
 */
export function calcularExcipienteBase(
  pesoCapsula: number,
  totalAtivosMg: number,
  totalTecnologicosMg: number
): number {
  return pesoCapsula - totalAtivosMg - totalTecnologicosMg;
}
