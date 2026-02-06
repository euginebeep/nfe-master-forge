
-- ====================================================================
-- MÓDULO 1: IA PREDITIVA DE DEMANDA & PRODUÇÃO
-- ====================================================================

CREATE TABLE public.previsoes_producao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.itens(id) ON DELETE CASCADE,
  periodo TEXT NOT NULL,
  demanda_prevista INTEGER NOT NULL DEFAULT 0,
  lote_sugerido INTEGER NOT NULL DEFAULT 0,
  ponto_reposicao INTEGER DEFAULT 0,
  confianca_percentual NUMERIC(5,2) DEFAULT 0,
  prioridade TEXT DEFAULT 'MEDIA' CHECK (prioridade IN ('URGENTE', 'ALTA', 'MEDIA', 'BAIXA')),
  alerta TEXT,
  dados_historico JSONB DEFAULT '{}',
  gerado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  valido_ate TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.previsoes_producao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for previsoes_producao" ON public.previsoes_producao
  FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- MÓDULO 2: DETECÇÃO DE ANOMALIAS (ANTI-ERRO HUMANO)
-- ====================================================================

CREATE TYPE public.tipo_anomalia AS ENUM (
  'PESO_FORA_PADRAO',
  'CONSUMO_EXCESSIVO',
  'TEMPO_ANORMAL',
  'RENDIMENTO_BAIXO',
  'PERDA_ELEVADA',
  'DESVIO_CUSTO',
  'DESVIO_QUALIDADE'
);

CREATE TYPE public.severidade_anomalia AS ENUM (
  'CRITICA',
  'ALTA',
  'MEDIA',
  'BAIXA',
  'INFO'
);

CREATE TABLE public.anomalias_operacionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID,
  lote_id UUID,
  formula_id UUID,
  tipo_anomalia tipo_anomalia NOT NULL,
  descricao TEXT NOT NULL,
  valor_esperado NUMERIC,
  valor_real NUMERIC,
  desvio_percentual NUMERIC,
  severidade severidade_anomalia NOT NULL DEFAULT 'MEDIA',
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ANALISE', 'RESOLVIDA', 'IGNORADA')),
  responsavel_analise UUID,
  analise_observacoes TEXT,
  resolvido_em TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.anomalias_operacionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anomalias_operacionais" ON public.anomalias_operacionais
  FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- MÓDULO 3: RANKING AUTOMÁTICO DE FORNECEDORES
-- ====================================================================

CREATE TABLE public.ranking_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  score_qualidade NUMERIC(5,2) DEFAULT 0,
  score_custo NUMERIC(5,2) DEFAULT 0,
  score_pontualidade NUMERIC(5,2) DEFAULT 0,
  score_conformidade NUMERIC(5,2) DEFAULT 0,
  score_variacao_preco NUMERIC(5,2) DEFAULT 0,
  score_total NUMERIC(5,2) DEFAULT 0,
  classificacao TEXT DEFAULT 'REGULAR' CHECK (classificacao IN ('PREFERENCIAL', 'REGULAR', 'RISCO', 'BLOQUEADO')),
  total_lotes_recebidos INTEGER DEFAULT 0,
  total_nao_conformidades INTEGER DEFAULT 0,
  total_entregas_atrasadas INTEGER DEFAULT 0,
  custo_medio_kg NUMERIC DEFAULT 0,
  ultima_avaliacao TIMESTAMP WITH TIME ZONE,
  dados_historico JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(fornecedor_id)
);

ALTER TABLE public.ranking_fornecedores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for ranking_fornecedores" ON public.ranking_fornecedores
  FOR ALL USING (true) WITH CHECK (true);

-- Histórico detalhado de avaliações
CREATE TABLE public.avaliacoes_fornecedor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  lote_id UUID,
  nota_entrada_id UUID,
  tipo_avaliacao TEXT NOT NULL,
  score NUMERIC(5,2) NOT NULL,
  observacoes TEXT,
  avaliado_por UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.avaliacoes_fornecedor ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for avaliacoes_fornecedor" ON public.avaliacoes_fornecedor
  FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- MÓDULO 4: AUTO-OTIMIZAÇÃO DE FÓRMULAS & PROCESSOS
-- ====================================================================

CREATE TYPE public.tipo_sugestao_otimizacao AS ENUM (
  'AJUSTE_EXCIPIENTE',
  'ORDEM_MISTURA',
  'REDUCAO_PERDA',
  'MELHORIA_RENDIMENTO',
  'SUBSTITUICAO_INSUMO',
  'ALTERACAO_PROCESSO',
  'ECONOMIA_CUSTO'
);

CREATE TABLE public.sugestoes_otimizacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_tipo TEXT NOT NULL CHECK (entidade_tipo IN ('FORMULA', 'OP', 'PROCESSO')),
  entidade_id UUID NOT NULL,
  entidade_codigo TEXT,
  tipo_sugestao tipo_sugestao_otimizacao NOT NULL,
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  justificativa_tecnica TEXT NOT NULL,
  impacto_estimado NUMERIC,
  impacto_unidade TEXT,
  dados_analise JSONB DEFAULT '{}',
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'EM_ANALISE', 'APROVADA', 'REJEITADA', 'IMPLEMENTADA')),
  aprovado_por UUID,
  aprovado_em TIMESTAMP WITH TIME ZONE,
  implementado_em TIMESTAMP WITH TIME ZONE,
  observacoes_implementacao TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.sugestoes_otimizacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for sugestoes_otimizacao" ON public.sugestoes_otimizacao
  FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- MÓDULO 5: GOVERNANÇA TÉCNICA TOTAL
-- ====================================================================

CREATE TABLE public.trilha_auditoria_tecnica (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  entidade_codigo TEXT,
  acao TEXT NOT NULL,
  usuario_id UUID,
  usuario_nome TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT now(),
  dados_anteriores JSONB,
  dados_novos JSONB,
  diff_resumo TEXT,
  ip_origem TEXT,
  motivo TEXT,
  hash_integridade TEXT
);

ALTER TABLE public.trilha_auditoria_tecnica ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for trilha_auditoria_tecnica" ON public.trilha_auditoria_tecnica
  FOR ALL USING (true) WITH CHECK (true);

-- Índice para busca rápida por entidade
CREATE INDEX idx_trilha_auditoria_entidade ON public.trilha_auditoria_tecnica(entidade_tipo, entidade_id);
CREATE INDEX idx_trilha_auditoria_timestamp ON public.trilha_auditoria_tecnica(timestamp DESC);

-- Versionamento de parâmetros industriais
CREATE TABLE public.versoes_parametros_industriais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_parametro TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  dados JSONB NOT NULL,
  motivo_alteracao TEXT,
  alterado_por UUID,
  alterado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ativo BOOLEAN DEFAULT true
);

ALTER TABLE public.versoes_parametros_industriais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for versoes_parametros_industriais" ON public.versoes_parametros_industriais
  FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- MÓDULO 6: ALERTAS EXECUTIVOS & DECISÃO
-- ====================================================================

CREATE TYPE public.tipo_alerta_executivo AS ENUM (
  'MARGEM_BAIXA',
  'FORNECEDOR_RISCO',
  'PROCESSO_FORA_PADRAO',
  'RISCO_REGULATORIO',
  'ESTOQUE_CRITICO',
  'CUSTO_ELEVADO',
  'QUALIDADE_COMPROMETIDA',
  'VENCIMENTO_PROXIMO',
  'PRODUCAO_ATRASADA',
  'ANOMALIA_DETECTADA'
);

CREATE TYPE public.nivel_alerta AS ENUM (
  'CRITICO',
  'ALTO',
  'MEDIO',
  'BAIXO'
);

CREATE TABLE public.alertas_executivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_alerta tipo_alerta_executivo NOT NULL,
  nivel nivel_alerta NOT NULL DEFAULT 'MEDIO',
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  entidade_tipo TEXT,
  entidade_id UUID,
  entidade_codigo TEXT,
  valor_referencia NUMERIC,
  valor_atual NUMERIC,
  impacto_financeiro NUMERIC,
  acao_sugerida TEXT,
  dados_contexto JSONB DEFAULT '{}',
  status TEXT DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'VISUALIZADO', 'EM_TRATAMENTO', 'RESOLVIDO', 'IGNORADO')),
  visualizado_por UUID,
  visualizado_em TIMESTAMP WITH TIME ZONE,
  resolvido_por UUID,
  resolvido_em TIMESTAMP WITH TIME ZONE,
  resolucao_observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.alertas_executivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for alertas_executivos" ON public.alertas_executivos
  FOR ALL USING (true) WITH CHECK (true);

-- Índices para alertas ativos
CREATE INDEX idx_alertas_executivos_status ON public.alertas_executivos(status) WHERE status = 'ATIVO';
CREATE INDEX idx_alertas_executivos_nivel ON public.alertas_executivos(nivel, created_at DESC);

-- ====================================================================
-- INDICADORES KPI EXECUTIVOS (Snapshot diário)
-- ====================================================================

CREATE TABLE public.kpis_executivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_referencia DATE NOT NULL,
  
  -- Produção
  ops_finalizadas INTEGER DEFAULT 0,
  ops_bloqueadas INTEGER DEFAULT 0,
  rendimento_medio_percent NUMERIC(5,2) DEFAULT 0,
  custo_medio_unitario NUMERIC DEFAULT 0,
  
  -- Qualidade
  taxa_aprovacao_qc NUMERIC(5,2) DEFAULT 0,
  total_anomalias INTEGER DEFAULT 0,
  anomalias_criticas INTEGER DEFAULT 0,
  
  -- Fornecedores
  fornecedores_risco INTEGER DEFAULT 0,
  nao_conformidades INTEGER DEFAULT 0,
  
  -- Financeiro
  margem_media_percent NUMERIC(5,2) DEFAULT 0,
  custo_total_producao NUMERIC DEFAULT 0,
  
  -- Compliance
  validacoes_bloqueio INTEGER DEFAULT 0,
  alertas_regulatorios INTEGER DEFAULT 0,
  
  dados_detalhados JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(data_referencia)
);

ALTER TABLE public.kpis_executivos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for kpis_executivos" ON public.kpis_executivos
  FOR ALL USING (true) WITH CHECK (true);

-- ====================================================================
-- TRIGGERS PARA ATUALIZAÇÃO AUTOMÁTICA
-- ====================================================================

CREATE OR REPLACE FUNCTION update_ranking_fornecedores_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_ranking_fornecedores_updated
  BEFORE UPDATE ON public.ranking_fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION update_ranking_fornecedores_timestamp();
