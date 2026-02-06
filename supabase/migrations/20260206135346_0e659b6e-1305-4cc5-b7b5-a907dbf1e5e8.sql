-- ============================================================
-- MÓDULO 1: CUSTO REAL INDUSTRIAL POR OP
-- ============================================================

CREATE TABLE public.custos_op (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  op_id UUID NOT NULL,
  op_codigo TEXT NOT NULL,
  
  -- Custos detalhados
  custo_materia_prima_real NUMERIC NOT NULL DEFAULT 0,
  custo_excipientes NUMERIC NOT NULL DEFAULT 0,
  custo_embalagem NUMERIC NOT NULL DEFAULT 0,
  custo_mao_obra NUMERIC NOT NULL DEFAULT 0,
  custo_overhead NUMERIC NOT NULL DEFAULT 0,
  custo_perdas NUMERIC NOT NULL DEFAULT 0,
  
  -- Rateio de impostos
  impostos_icms_rateado NUMERIC NOT NULL DEFAULT 0,
  impostos_ipi_rateado NUMERIC NOT NULL DEFAULT 0,
  impostos_pis_rateado NUMERIC NOT NULL DEFAULT 0,
  impostos_cofins_rateado NUMERIC NOT NULL DEFAULT 0,
  impostos_total_rateado NUMERIC NOT NULL DEFAULT 0,
  
  -- Totais
  custo_total_real NUMERIC NOT NULL DEFAULT 0,
  custo_unitario_real NUMERIC NOT NULL DEFAULT 0,
  quantidade_produzida INTEGER NOT NULL DEFAULT 0,
  quantidade_perdas INTEGER NOT NULL DEFAULT 0,
  
  -- Controle
  status TEXT NOT NULL DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'FECHADO')),
  fechado_em TIMESTAMP WITH TIME ZONE,
  fechado_por UUID,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Detalhamento de custos por lote consumido
CREATE TABLE public.custos_op_lotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  custo_op_id UUID NOT NULL REFERENCES public.custos_op(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL,
  numero_lote TEXT NOT NULL,
  insumo_nome TEXT NOT NULL,
  quantidade_consumida_g NUMERIC NOT NULL,
  custo_unitario_lote NUMERIC NOT NULL,
  custo_total_lote NUMERIC NOT NULL,
  
  -- Impostos do lote (da NF-e original)
  icms_valor NUMERIC DEFAULT 0,
  ipi_valor NUMERIC DEFAULT 0,
  pis_valor NUMERIC DEFAULT 0,
  cofins_valor NUMERIC DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Configuração de custos operacionais
CREATE TABLE public.config_custos_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Mão de obra
  custo_hora_operador NUMERIC NOT NULL DEFAULT 25.00,
  custo_hora_tecnico NUMERIC NOT NULL DEFAULT 50.00,
  
  -- Overhead
  custo_overhead_hora NUMERIC NOT NULL DEFAULT 15.00,
  percentual_overhead NUMERIC NOT NULL DEFAULT 10.00,
  
  -- Embalagem padrão
  custo_capsula_vazia NUMERIC NOT NULL DEFAULT 0.02,
  custo_frasco_padrao NUMERIC NOT NULL DEFAULT 0.50,
  custo_rotulo_padrao NUMERIC NOT NULL DEFAULT 0.15,
  custo_lacre_padrao NUMERIC NOT NULL DEFAULT 0.05,
  
  -- Perdas estimadas
  percentual_perda_padrao NUMERIC NOT NULL DEFAULT 5.00,
  
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.config_custos_producao (id) VALUES (gen_random_uuid());

-- ============================================================
-- MÓDULO 2: VALIDADOR LEGAL AUTOMÁTICO ANVISA
-- ============================================================

-- Log de validações ANVISA
CREATE TABLE public.log_validacoes_anvisa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Entidade validada
  tipo_entidade TEXT NOT NULL CHECK (tipo_entidade IN ('FORMULA', 'OP', 'INSUMO')),
  entidade_id UUID NOT NULL,
  entidade_codigo TEXT NOT NULL,
  
  -- Resultado
  resultado TEXT NOT NULL CHECK (resultado IN ('OK', 'ALERTA', 'BLOQUEIO')),
  
  -- Detalhes
  regra_aplicada TEXT NOT NULL,
  descricao TEXT NOT NULL,
  fonte_legal TEXT,
  dados_validacao JSONB DEFAULT '{}',
  
  -- Ação tomada
  acao_sistema TEXT,
  usuario_responsavel UUID,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Base de regras ANVISA (expandível)
CREATE TABLE public.regras_anvisa (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  substancia TEXT NOT NULL,
  substancia_normalizada TEXT NOT NULL,
  
  -- Limites
  dose_maxima_diaria_mg NUMERIC,
  dose_maxima_por_porcao_mg NUMERIC,
  
  -- Formas permitidas
  formas_permitidas TEXT[] DEFAULT ARRAY['CAPSULA', 'LIQUIDO', 'PO'],
  
  -- Alegações
  alegacoes_permitidas TEXT[] DEFAULT '{}',
  alegacoes_proibidas TEXT[] DEFAULT '{}',
  
  -- Avisos obrigatórios
  avisos_rotulo TEXT[] DEFAULT '{}',
  
  -- Fonte legal
  fonte_legal TEXT NOT NULL,
  data_publicacao DATE,
  
  -- Status
  ativo BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir regras ANVISA iniciais
INSERT INTO public.regras_anvisa (substancia, substancia_normalizada, dose_maxima_diaria_mg, fonte_legal, alegacoes_permitidas, avisos_rotulo) VALUES
('Vitamina D', 'VITAMINA_D', 0.050, 'RDC 243/2018 e IN 28/2018', ARRAY['Auxilia na absorção de cálcio e fósforo', 'Auxilia no funcionamento do sistema imune'], ARRAY['Gestantes e lactantes: consultar médico']),
('Vitamina C', 'VITAMINA_C', 2000, 'RDC 243/2018 e IN 28/2018', ARRAY['Auxilia na proteção dos danos causados pelos radicais livres', 'Auxilia no funcionamento do sistema imune'], ARRAY[]::TEXT[]),
('Vitamina E', 'VITAMINA_E', 1000, 'RDC 243/2018 e IN 28/2018', ARRAY['Auxilia na proteção dos danos causados pelos radicais livres'], ARRAY[]::TEXT[]),
('Vitamina A', 'VITAMINA_A', 3, 'RDC 243/2018 e IN 28/2018', ARRAY['Auxilia na visão', 'Auxilia no funcionamento do sistema imune'], ARRAY['Gestantes: não consumir']),
('Melatonina', 'MELATONINA', 0.21, 'RDC 441/2020', ARRAY['Auxilia no sono'], ARRAY['Não consumir caso opere máquinas', 'Não indicado para gestantes e lactantes']),
('Zinco', 'ZINCO', 50, 'RDC 243/2018 e IN 28/2018', ARRAY['Auxilia no funcionamento do sistema imune', 'Auxilia na manutenção do cabelo e unhas'], ARRAY[]::TEXT[]),
('Magnésio', 'MAGNESIO', 350, 'RDC 243/2018 e IN 28/2018', ARRAY['Auxilia no metabolismo energético', 'Auxilia no funcionamento muscular'], ARRAY[]::TEXT[]),
('Ômega 3', 'OMEGA_3', 3000, 'RDC 243/2018', ARRAY['Auxilia na manutenção de níveis saudáveis de triglicerídeos'], ARRAY[]::TEXT[]),
('Colágeno', 'COLAGENO', 10000, 'RDC 243/2018', ARRAY['Auxilia na manutenção da pele'], ARRAY[]::TEXT[]),
('Cafeína', 'CAFEINA', 420, 'RDC 243/2018', ARRAY['Auxilia no aumento do estado de alerta'], ARRAY['Não recomendado para gestantes, lactantes e crianças', 'Este produto contém cafeína']);

-- ============================================================
-- MÓDULO 3: SIMULADOR INDUSTRIAL DE PRODUÇÃO
-- ============================================================

-- Configuração de capacidade produtiva
CREATE TABLE public.config_capacidade_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Máquinas
  encapsuladora_caps_min INTEGER NOT NULL DEFAULT 3000,
  misturador_capacidade_kg NUMERIC NOT NULL DEFAULT 50,
  
  -- Tempos médios (minutos)
  tempo_setup_pesagem_min INTEGER NOT NULL DEFAULT 15,
  tempo_pesagem_item_padrao_min INTEGER NOT NULL DEFAULT 3,
  tempo_pesagem_item_critico_min INTEGER NOT NULL DEFAULT 8,
  tempo_mistura_base_min INTEGER NOT NULL DEFAULT 20,
  tempo_diluicao_geometrica_min INTEGER NOT NULL DEFAULT 15,
  tempo_setup_encapsulamento_min INTEGER NOT NULL DEFAULT 20,
  tempo_limpeza_min INTEGER NOT NULL DEFAULT 30,
  tempo_qc_min INTEGER NOT NULL DEFAULT 15,
  
  -- Equipe
  operadores_disponiveis INTEGER NOT NULL DEFAULT 2,
  tecnicos_disponiveis INTEGER NOT NULL DEFAULT 1,
  
  -- Fatores
  fator_eficiencia NUMERIC NOT NULL DEFAULT 0.85,
  
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO public.config_capacidade_producao (id) VALUES (gen_random_uuid());

-- Simulações realizadas
CREATE TABLE public.simulacoes_producao (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  
  formula_id UUID NOT NULL,
  formula_codigo TEXT NOT NULL,
  quantidade_unidades INTEGER NOT NULL,
  
  -- Tempos estimados (minutos)
  tempo_pesagem_estimado INTEGER NOT NULL,
  tempo_mistura_estimado INTEGER NOT NULL,
  tempo_encapsulamento_estimado INTEGER NOT NULL,
  tempo_qc_estimado INTEGER NOT NULL,
  tempo_total_estimado INTEGER NOT NULL,
  
  -- Custos estimados
  custo_mp_estimado NUMERIC NOT NULL,
  custo_mao_obra_estimado NUMERIC NOT NULL,
  custo_overhead_estimado NUMERIC NOT NULL,
  custo_total_estimado NUMERIC NOT NULL,
  custo_unitario_estimado NUMERIC NOT NULL,
  
  -- Rendimento
  rendimento_esperado_percent NUMERIC NOT NULL,
  perdas_estimadas_unidades INTEGER NOT NULL,
  
  -- Gargalos identificados
  gargalos JSONB DEFAULT '[]',
  sugestoes JSONB DEFAULT '[]',
  
  -- Comparação com real (após OP)
  op_id UUID,
  custo_real NUMERIC,
  tempo_real_min INTEGER,
  desvio_custo_percent NUMERIC,
  desvio_tempo_percent NUMERIC,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custos_op ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_op_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_custos_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_validacoes_anvisa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_anvisa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_capacidade_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulacoes_producao ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Allow all for custos_op" ON public.custos_op FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for custos_op_lotes" ON public.custos_op_lotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for config_custos_producao" ON public.config_custos_producao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for log_validacoes_anvisa" ON public.log_validacoes_anvisa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for regras_anvisa" ON public.regras_anvisa FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for config_capacidade_producao" ON public.config_capacidade_producao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for simulacoes_producao" ON public.simulacoes_producao FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_custos_op_op_id ON public.custos_op(op_id);
CREATE INDEX idx_custos_op_status ON public.custos_op(status);
CREATE INDEX idx_log_validacoes_entidade ON public.log_validacoes_anvisa(tipo_entidade, entidade_id);
CREATE INDEX idx_log_validacoes_resultado ON public.log_validacoes_anvisa(resultado);
CREATE INDEX idx_regras_anvisa_substancia ON public.regras_anvisa(substancia_normalizada);
CREATE INDEX idx_simulacoes_formula ON public.simulacoes_producao(formula_id);