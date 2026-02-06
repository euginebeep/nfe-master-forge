-- ============================================================
-- ORDENS DE PRODUÇÃO INDUSTRIAL - ESTRUTURA COMPLETA ANVISA
-- ============================================================

-- Tabela principal de Ordens de Produção
CREATE TABLE public.ordens_producao_industrial (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  
  -- BLOCO 1: Identificação
  produto_id UUID REFERENCES public.itens(id),
  produto_nome TEXT NOT NULL,
  formula_id UUID REFERENCES public.formulas(id),
  formula_codigo TEXT,
  formula_versao INTEGER DEFAULT 1,
  
  -- Quantidades
  quantidade_frascos INTEGER NOT NULL,
  capsulas_por_frasco INTEGER NOT NULL,
  total_capsulas INTEGER NOT NULL,
  acrescimo_percentual NUMERIC(5,2) DEFAULT 5.00,
  total_capsulas_com_acrescimo INTEGER NOT NULL,
  
  -- Lote e datas
  lote_produto_acabado TEXT NOT NULL,
  data_fabricacao DATE NOT NULL,
  data_validade DATE NOT NULL,
  
  -- Configuração técnica
  tipo_apresentacao TEXT NOT NULL DEFAULT 'CAPSULA',
  peso_capsula_mg NUMERIC(10,4) DEFAULT 500,
  tipo_capsula TEXT DEFAULT '00',
  excipiente_base TEXT DEFAULT 'AMIDO',
  
  -- Status e workflow
  status TEXT NOT NULL DEFAULT 'PLANEJADA' CHECK (status IN ('PLANEJADA', 'AGUARDANDO_MATERIAIS', 'EM_PRODUCAO', 'FINALIZADA', 'BLOQUEADA', 'CANCELADA')),
  
  -- Equipe
  responsavel_producao_id UUID REFERENCES public.profiles(id),
  responsavel_producao_nome TEXT,
  operadores JSONB DEFAULT '[]'::jsonb,
  
  -- Datas de workflow
  data_inicio_producao TIMESTAMP WITH TIME ZONE,
  data_fim_producao TIMESTAMP WITH TIME ZONE,
  
  -- Observações
  observacoes TEXT,
  motivo_bloqueio TEXT,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES public.profiles(id),
  finalizado_por UUID REFERENCES public.profiles(id)
);

-- BLOCO 2: Matérias-primas da OP
CREATE TABLE public.op_materias_primas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL REFERENCES public.ordens_producao_industrial(id) ON DELETE CASCADE,
  
  -- Insumo
  insumo_id UUID REFERENCES public.itens(id),
  insumo_nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'ATIVO' CHECK (categoria IN ('ATIVO', 'EXCIPIENTE_BASE', 'EXCIPIENTE_TECNOLOGICO')),
  
  -- Lote selecionado
  lote_id UUID REFERENCES public.estoque_lotes(id),
  numero_lote TEXT,
  fornecedor_id UUID REFERENCES public.entidades(id),
  fornecedor_nome TEXT,
  
  -- Quantidades
  quantidade_teorica_mg NUMERIC(12,4) NOT NULL,
  quantidade_teorica_g NUMERIC(12,4) NOT NULL,
  quantidade_real_g NUMERIC(12,4),
  unidade TEXT DEFAULT 'g',
  
  -- Pesagem
  pesagem_critica BOOLEAN DEFAULT false,
  motivo_critico TEXT,
  tolerancia_percentual NUMERIC(5,2) DEFAULT 10.00,
  quantidade_minima_g NUMERIC(12,4),
  quantidade_maxima_g NUMERIC(12,4),
  dentro_tolerancia BOOLEAN,
  
  -- Ordem de mistura
  ordem_mistura INTEGER NOT NULL,
  
  -- Conferência
  pesado_por UUID REFERENCES public.profiles(id),
  pesado_em TIMESTAMP WITH TIME ZONE,
  conferido_por UUID REFERENCES public.profiles(id),
  conferido_em TIMESTAMP WITH TIME ZONE,
  
  -- Observações
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- BLOCO 5: Pesagens críticas (registro separado para auditoria)
CREATE TABLE public.op_pesagens_criticas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL REFERENCES public.ordens_producao_industrial(id) ON DELETE CASCADE,
  materia_prima_id UUID NOT NULL REFERENCES public.op_materias_primas(id) ON DELETE CASCADE,
  
  -- Dados do ativo
  insumo_nome TEXT NOT NULL,
  quantidade_teorica_mg NUMERIC(12,4) NOT NULL,
  quantidade_pesada_mg NUMERIC(12,4),
  
  -- Conferência dupla obrigatória
  operador_pesagem_id UUID REFERENCES public.profiles(id),
  operador_pesagem_nome TEXT,
  assinatura_operador TEXT,
  data_pesagem TIMESTAMP WITH TIME ZONE,
  
  conferente_id UUID REFERENCES public.profiles(id),
  conferente_nome TEXT,
  assinatura_conferente TEXT,
  data_conferencia TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'PESADO', 'CONFERIDO', 'REPROVADO')),
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- BLOCO 6: Checklist operacional
CREATE TABLE public.op_checklist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL REFERENCES public.ordens_producao_industrial(id) ON DELETE CASCADE,
  
  -- Itens do checklist
  item TEXT NOT NULL,
  categoria TEXT NOT NULL CHECK (categoria IN ('PRE_PRODUCAO', 'DURANTE_PRODUCAO', 'POS_PRODUCAO', 'QC')),
  ordem INTEGER NOT NULL,
  obrigatorio BOOLEAN DEFAULT true,
  
  -- Verificação
  verificado BOOLEAN DEFAULT false,
  verificado_por UUID REFERENCES public.profiles(id),
  verificado_em TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Controle de Qualidade da OP
CREATE TABLE public.op_controle_qualidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL REFERENCES public.ordens_producao_industrial(id) ON DELETE CASCADE,
  
  -- Testes de aparência
  aparencia_po TEXT,
  aparencia_conforme BOOLEAN,
  
  -- Testes de fluidez
  fluidez TEXT,
  fluidez_conforme BOOLEAN,
  
  -- Testes de homogeneidade
  homogeneidade TEXT,
  homogeneidade_conforme BOOLEAN,
  
  -- Peso médio das cápsulas
  peso_medio_capsulas_mg NUMERIC(10,4),
  peso_minimo_capsulas_mg NUMERIC(10,4),
  peso_maximo_capsulas_mg NUMERIC(10,4),
  desvio_padrao_peso NUMERIC(10,4),
  peso_conforme BOOLEAN,
  
  -- Resultado
  status TEXT DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'APROVADO', 'REPROVADO')),
  motivo_reprovacao TEXT,
  observacoes TEXT,
  
  -- Auditoria
  avaliado_por UUID REFERENCES public.profiles(id),
  avaliado_em TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Controle de perdas
CREATE TABLE public.op_controle_perdas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL REFERENCES public.ordens_producao_industrial(id) ON DELETE CASCADE,
  
  -- Planejamento
  quantidade_planejada INTEGER NOT NULL,
  acrescimo_percentual NUMERIC(5,2) NOT NULL,
  quantidade_com_acrescimo INTEGER NOT NULL,
  
  -- Realizado
  quantidade_produzida INTEGER DEFAULT 0,
  quantidade_aprovada INTEGER DEFAULT 0,
  quantidade_rejeitada INTEGER DEFAULT 0,
  
  -- Cálculos
  perda_total INTEGER DEFAULT 0,
  perda_percentual NUMERIC(5,2) DEFAULT 0,
  rendimento_percentual NUMERIC(5,2) DEFAULT 0,
  
  -- Justificativas
  justificativa_perdas TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Sequence para código da OP
CREATE SEQUENCE IF NOT EXISTS op_industrial_seq START WITH 1;

-- Enable RLS
ALTER TABLE public.ordens_producao_industrial ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_materias_primas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_pesagens_criticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_controle_qualidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_controle_perdas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow all for ordens_producao_industrial" ON public.ordens_producao_industrial FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for op_materias_primas" ON public.op_materias_primas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for op_pesagens_criticas" ON public.op_pesagens_criticas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for op_checklist" ON public.op_checklist FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for op_controle_qualidade" ON public.op_controle_qualidade FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for op_controle_perdas" ON public.op_controle_perdas FOR ALL USING (true) WITH CHECK (true);

-- Trigger para updated_at
CREATE TRIGGER update_ordens_producao_industrial_updated_at
  BEFORE UPDATE ON public.ordens_producao_industrial
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_op_controle_perdas_updated_at
  BEFORE UPDATE ON public.op_controle_perdas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_op_industrial_status ON public.ordens_producao_industrial(status);
CREATE INDEX idx_op_industrial_formula ON public.ordens_producao_industrial(formula_id);
CREATE INDEX idx_op_industrial_produto ON public.ordens_producao_industrial(produto_id);
CREATE INDEX idx_op_industrial_data_fab ON public.ordens_producao_industrial(data_fabricacao);
CREATE INDEX idx_op_materias_primas_op ON public.op_materias_primas(op_id);
CREATE INDEX idx_op_pesagens_criticas_op ON public.op_pesagens_criticas(op_id);
CREATE INDEX idx_op_checklist_op ON public.op_checklist(op_id);