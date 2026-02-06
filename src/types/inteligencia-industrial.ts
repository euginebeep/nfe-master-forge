// ============================================================
// TIPOS PARA INTELIGÊNCIA INDUSTRIAL AVANÇADA
// ============================================================

// ============================================================
// MÓDULO 1: IA PREDITIVA DE DEMANDA & PRODUÇÃO
// ============================================================

export type PrioridadeProducao = 'URGENTE' | 'ALTA' | 'MEDIA' | 'BAIXA';

export interface PrevisaoProducao {
  id: string;
  produto_id: string;
  produto_nome?: string;
  periodo: string;
  demanda_prevista: number;
  lote_sugerido: number;
  ponto_reposicao: number;
  confianca_percentual: number;
  prioridade: PrioridadeProducao;
  alerta: string | null;
  dados_historico: Record<string, unknown>;
  gerado_em: string;
  valido_ate: string | null;
  created_at: string;
}

export interface AnaliseHistorico {
  vendas_ultimos_30_dias: number;
  vendas_ultimos_90_dias: number;
  media_mensal: number;
  tendencia: 'CRESCENTE' | 'ESTAVEL' | 'DECRESCENTE';
  sazonalidade: number[];
  lead_time_medio: number;
}

// ============================================================
// MÓDULO 2: DETECÇÃO DE ANOMALIAS
// ============================================================

export type TipoAnomalia = 
  | 'PESO_FORA_PADRAO'
  | 'CONSUMO_EXCESSIVO'
  | 'TEMPO_ANORMAL'
  | 'RENDIMENTO_BAIXO'
  | 'PERDA_ELEVADA'
  | 'DESVIO_CUSTO'
  | 'DESVIO_QUALIDADE';

export type SeveridadeAnomalia = 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA' | 'INFO';

export type StatusAnomalia = 'PENDENTE' | 'EM_ANALISE' | 'RESOLVIDA' | 'IGNORADA';

export interface AnomaliaOperacional {
  id: string;
  op_id: string | null;
  lote_id: string | null;
  formula_id: string | null;
  tipo_anomalia: TipoAnomalia;
  descricao: string;
  valor_esperado: number | null;
  valor_real: number | null;
  desvio_percentual: number | null;
  severidade: SeveridadeAnomalia;
  status: StatusAnomalia;
  responsavel_analise: string | null;
  analise_observacoes: string | null;
  resolvido_em: string | null;
  created_at: string;
}

export interface ParametrosDeteccao {
  peso_tolerancia_percent: number;
  consumo_tolerancia_percent: number;
  tempo_tolerancia_percent: number;
  rendimento_minimo_percent: number;
  perda_maxima_percent: number;
}

// ============================================================
// MÓDULO 3: RANKING DE FORNECEDORES
// ============================================================

export type ClassificacaoFornecedor = 'PREFERENCIAL' | 'REGULAR' | 'RISCO' | 'BLOQUEADO';

export interface RankingFornecedor {
  id: string;
  fornecedor_id: string;
  fornecedor_nome?: string;
  score_qualidade: number;
  score_custo: number;
  score_pontualidade: number;
  score_conformidade: number;
  score_variacao_preco: number;
  score_total: number;
  classificacao: ClassificacaoFornecedor;
  total_lotes_recebidos: number;
  total_nao_conformidades: number;
  total_entregas_atrasadas: number;
  custo_medio_kg: number;
  ultima_avaliacao: string | null;
  dados_historico: unknown[];
  created_at: string;
  updated_at: string;
}

export interface AvaliacaoFornecedor {
  id: string;
  fornecedor_id: string;
  lote_id: string | null;
  nota_entrada_id: string | null;
  tipo_avaliacao: string;
  score: number;
  observacoes: string | null;
  avaliado_por: string | null;
  created_at: string;
}

export interface CriteriosRanking {
  peso_qualidade: number;
  peso_custo: number;
  peso_pontualidade: number;
  peso_conformidade: number;
  peso_variacao_preco: number;
}

// ============================================================
// MÓDULO 4: AUTO-OTIMIZAÇÃO
// ============================================================

export type TipoSugestaoOtimizacao = 
  | 'AJUSTE_EXCIPIENTE'
  | 'ORDEM_MISTURA'
  | 'REDUCAO_PERDA'
  | 'MELHORIA_RENDIMENTO'
  | 'SUBSTITUICAO_INSUMO'
  | 'ALTERACAO_PROCESSO'
  | 'ECONOMIA_CUSTO';

export type StatusSugestao = 'PENDENTE' | 'EM_ANALISE' | 'APROVADA' | 'REJEITADA' | 'IMPLEMENTADA';

export interface SugestaoOtimizacao {
  id: string;
  entidade_tipo: 'FORMULA' | 'OP' | 'PROCESSO';
  entidade_id: string;
  entidade_codigo: string | null;
  tipo_sugestao: TipoSugestaoOtimizacao;
  titulo: string;
  descricao: string;
  justificativa_tecnica: string;
  impacto_estimado: number | null;
  impacto_unidade: string | null;
  dados_analise: Record<string, unknown>;
  status: StatusSugestao;
  aprovado_por: string | null;
  aprovado_em: string | null;
  implementado_em: string | null;
  observacoes_implementacao: string | null;
  created_at: string;
}

// ============================================================
// MÓDULO 5: GOVERNANÇA TÉCNICA
// ============================================================

export interface TrilhaAuditoriaTecnica {
  id: string;
  entidade_tipo: string;
  entidade_id: string;
  entidade_codigo: string | null;
  acao: string;
  usuario_id: string | null;
  usuario_nome: string | null;
  timestamp: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  diff_resumo: string | null;
  ip_origem: string | null;
  motivo: string | null;
  hash_integridade: string | null;
}

export interface VersaoParametroIndustrial {
  id: string;
  tipo_parametro: string;
  versao: number;
  dados: Record<string, unknown>;
  motivo_alteracao: string | null;
  alterado_por: string | null;
  alterado_em: string;
  ativo: boolean;
}

// ============================================================
// MÓDULO 6: ALERTAS EXECUTIVOS
// ============================================================

export type TipoAlertaExecutivo = 
  | 'MARGEM_BAIXA'
  | 'FORNECEDOR_RISCO'
  | 'PROCESSO_FORA_PADRAO'
  | 'RISCO_REGULATORIO'
  | 'ESTOQUE_CRITICO'
  | 'CUSTO_ELEVADO'
  | 'QUALIDADE_COMPROMETIDA'
  | 'VENCIMENTO_PROXIMO'
  | 'PRODUCAO_ATRASADA'
  | 'ANOMALIA_DETECTADA';

export type NivelAlerta = 'CRITICO' | 'ALTO' | 'MEDIO' | 'BAIXO';

export type StatusAlertaExecutivo = 'ATIVO' | 'VISUALIZADO' | 'EM_TRATAMENTO' | 'RESOLVIDO' | 'IGNORADO';

export interface AlertaExecutivo {
  id: string;
  tipo_alerta: TipoAlertaExecutivo;
  nivel: NivelAlerta;
  titulo: string;
  descricao: string;
  entidade_tipo: string | null;
  entidade_id: string | null;
  entidade_codigo: string | null;
  valor_referencia: number | null;
  valor_atual: number | null;
  impacto_financeiro: number | null;
  acao_sugerida: string | null;
  dados_contexto: Record<string, unknown>;
  status: StatusAlertaExecutivo;
  visualizado_por: string | null;
  visualizado_em: string | null;
  resolvido_por: string | null;
  resolvido_em: string | null;
  resolucao_observacoes: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface KPIsExecutivos {
  id: string;
  data_referencia: string;
  
  // Produção
  ops_finalizadas: number;
  ops_bloqueadas: number;
  rendimento_medio_percent: number;
  custo_medio_unitario: number;
  
  // Qualidade
  taxa_aprovacao_qc: number;
  total_anomalias: number;
  anomalias_criticas: number;
  
  // Fornecedores
  fornecedores_risco: number;
  nao_conformidades: number;
  
  // Financeiro
  margem_media_percent: number;
  custo_total_producao: number;
  
  // Compliance
  validacoes_bloqueio: number;
  alertas_regulatorios: number;
  
  dados_detalhados: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// FUNÇÕES UTILITÁRIAS
// ============================================================

export function calcularScoreTotal(ranking: Partial<RankingFornecedor>, pesos: CriteriosRanking): number {
  const somaP = pesos.peso_qualidade + pesos.peso_custo + pesos.peso_pontualidade + 
                pesos.peso_conformidade + pesos.peso_variacao_preco;
  
  const score = (
    (ranking.score_qualidade || 0) * pesos.peso_qualidade +
    (ranking.score_custo || 0) * pesos.peso_custo +
    (ranking.score_pontualidade || 0) * pesos.peso_pontualidade +
    (ranking.score_conformidade || 0) * pesos.peso_conformidade +
    (ranking.score_variacao_preco || 0) * pesos.peso_variacao_preco
  ) / somaP;
  
  return Math.round(score * 100) / 100;
}

export function classificarFornecedor(scoreTotal: number): ClassificacaoFornecedor {
  if (scoreTotal >= 80) return 'PREFERENCIAL';
  if (scoreTotal >= 50) return 'REGULAR';
  if (scoreTotal >= 30) return 'RISCO';
  return 'BLOQUEADO';
}

export function detectarAnomalia(
  valorEsperado: number, 
  valorReal: number, 
  toleranciaPercent: number
): { isAnomalia: boolean; desvioPercent: number; severidade: SeveridadeAnomalia } {
  const desvioPercent = valorEsperado !== 0 
    ? ((valorReal - valorEsperado) / valorEsperado) * 100 
    : 0;
  
  const desvioAbs = Math.abs(desvioPercent);
  const isAnomalia = desvioAbs > toleranciaPercent;
  
  let severidade: SeveridadeAnomalia = 'INFO';
  if (desvioAbs > toleranciaPercent * 3) severidade = 'CRITICA';
  else if (desvioAbs > toleranciaPercent * 2) severidade = 'ALTA';
  else if (desvioAbs > toleranciaPercent * 1.5) severidade = 'MEDIA';
  else if (desvioAbs > toleranciaPercent) severidade = 'BAIXA';
  
  return { isAnomalia, desvioPercent: Math.round(desvioPercent * 100) / 100, severidade };
}

export function gerarHashIntegridade(dados: Record<string, unknown>): string {
  const str = JSON.stringify(dados);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export const PESOS_RANKING_PADRAO: CriteriosRanking = {
  peso_qualidade: 30,
  peso_custo: 25,
  peso_pontualidade: 20,
  peso_conformidade: 15,
  peso_variacao_preco: 10,
};

export const PARAMETROS_DETECCAO_PADRAO: ParametrosDeteccao = {
  peso_tolerancia_percent: 10,
  consumo_tolerancia_percent: 15,
  tempo_tolerancia_percent: 20,
  rendimento_minimo_percent: 90,
  perda_maxima_percent: 10,
};
