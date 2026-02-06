-- ============================================================
-- FORMULADOR INDUSTRIAL - TABELAS NOVAS
-- ============================================================

-- Enum: Tipo de apresentação
CREATE TYPE public.tipo_apresentacao_formula AS ENUM ('CAPSULA', 'LIQUIDO', 'PO');

-- Enum: Status da fórmula
CREATE TYPE public.status_formula_industrial AS ENUM ('RASCUNHO', 'APROVADA', 'BLOQUEADA');

-- Enum: Tipo de excipiente
CREATE TYPE public.tipo_excipiente_formula AS ENUM ('AMIDO', 'CELULOSE', 'PRE_BLEND');

-- Enum: Unidade informada
CREATE TYPE public.unidade_informada_formula AS ENUM ('MG', 'MCG', 'UI');

-- ============================================================
-- TABELA: conversoes_unidades
-- ============================================================
CREATE TABLE public.conversoes_unidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  substancia TEXT NOT NULL,
  fator_ui_para_mg NUMERIC NOT NULL,
  fonte_tecnica TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.conversoes_unidades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for conversoes_unidades"
ON public.conversoes_unidades FOR ALL
USING (true)
WITH CHECK (true);

-- Seed de conversões conhecidas
INSERT INTO public.conversoes_unidades (substancia, fator_ui_para_mg, fonte_tecnica, ativo) VALUES
('Vitamina D3 (Colecalciferol)', 0.000025, 'USP: 1 UI = 0.025 mcg', true),
('Vitamina A (Retinol)', 0.0003, 'USP: 1 UI = 0.3 mcg', true),
('Vitamina E (Tocoferol)', 0.67, 'USP: 1 UI = 0.67 mg', true),
('Vitamina K1', 0.001, 'USP: 1 UI = 1 mcg', true);

-- ============================================================
-- TABELA: formulas
-- ============================================================
CREATE TABLE public.formulas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo_formula TEXT UNIQUE NOT NULL,
  nome_formula TEXT NOT NULL,
  produto_acabado_id UUID REFERENCES public.itens(id),
  
  -- Tipo de apresentação
  tipo_apresentacao tipo_apresentacao_formula NOT NULL DEFAULT 'CAPSULA',
  
  -- Campos para CÁPSULA
  peso_capsula_alvo_mg NUMERIC DEFAULT 490,
  peso_capsula_nominal_mg NUMERIC DEFAULT 500,
  tipo_capsula TEXT DEFAULT '00',
  excipiente_padrao tipo_excipiente_formula DEFAULT 'AMIDO',
  
  -- Campos para LÍQUIDO
  volume_frasco_ml NUMERIC,
  volume_por_dose_ml NUMERIC,
  gotas_por_ml NUMERIC DEFAULT 20,
  doses_por_frasco NUMERIC GENERATED ALWAYS AS (
    CASE WHEN volume_por_dose_ml > 0 THEN volume_frasco_ml / volume_por_dose_ml ELSE NULL END
  ) STORED,
  gotas_por_dose NUMERIC GENERATED ALWAYS AS (
    CASE WHEN gotas_por_ml > 0 AND volume_por_dose_ml > 0 THEN volume_por_dose_ml * gotas_por_ml ELSE NULL END
  ) STORED,
  
  -- Campos para PÓ
  peso_por_dose_g NUMERIC,
  doses_por_pote INTEGER,
  peso_total_pote_g NUMERIC GENERATED ALWAYS AS (
    CASE WHEN peso_por_dose_g > 0 AND doses_por_pote > 0 THEN peso_por_dose_g * doses_por_pote ELSE NULL END
  ) STORED,
  
  -- Metadados técnicos
  densidade_media NUMERIC,
  versao INTEGER DEFAULT 1,
  status status_formula_industrial DEFAULT 'RASCUNHO',
  observacoes_tecnicas TEXT,
  
  -- Auditoria
  criado_por UUID,
  aprovado_por UUID,
  criado_em TIMESTAMPTZ DEFAULT now(),
  aprovado_em TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.formulas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for formulas"
ON public.formulas FOR ALL
USING (true)
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_formulas_updated_at
BEFORE UPDATE ON public.formulas
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- TABELA: formula_itens
-- ============================================================
CREATE TABLE public.formula_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  produto_materia_prima_id UUID REFERENCES public.itens(id),
  
  -- Dados do insumo
  nome_insumo TEXT NOT NULL,
  quantidade_informada NUMERIC NOT NULL,
  unidade_informada unidade_informada_formula NOT NULL DEFAULT 'MG',
  quantidade_convertida_mg NUMERIC NOT NULL,
  
  -- Flags de controle
  ativo_critico BOOLEAN DEFAULT false,
  exige_premix BOOLEAN DEFAULT false,
  
  -- Ordem e percentual
  ordem_mistura INTEGER DEFAULT 0,
  percentual_na_capsula NUMERIC,
  
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.formula_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for formula_itens"
ON public.formula_itens FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- TABELA: tabelas_nutricionais
-- ============================================================
CREATE TABLE public.tabelas_nutricionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  porcao NUMERIC NOT NULL,
  porcao_unidade TEXT NOT NULL,
  tabela_json_padrao_anvisa JSONB NOT NULL DEFAULT '[]',
  data_geracao TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tabelas_nutricionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for tabelas_nutricionais"
ON public.tabelas_nutricionais FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- TABELA: alegacoes_anvisa
-- ============================================================
CREATE TABLE public.alegacoes_anvisa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  texto_alegacao TEXT NOT NULL,
  fonte_anvisa TEXT,
  permitido BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.alegacoes_anvisa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for alegacoes_anvisa"
ON public.alegacoes_anvisa FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- TABELA: ordens_producao_geradas
-- ============================================================
CREATE TABLE public.ordens_producao_geradas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  op_codigo TEXT NOT NULL,
  tipo_documento TEXT DEFAULT 'OP',
  data_geracao TIMESTAMPTZ DEFAULT now(),
  dados_op JSONB NOT NULL DEFAULT '{}'
);

ALTER TABLE public.ordens_producao_geradas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for ordens_producao_geradas"
ON public.ordens_producao_geradas FOR ALL
USING (true)
WITH CHECK (true);

-- ============================================================
-- TABELA: formula_versoes (histórico imutável)
-- ============================================================
CREATE TABLE public.formula_versoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formula_id UUID NOT NULL REFERENCES public.formulas(id) ON DELETE CASCADE,
  versao INTEGER NOT NULL,
  snapshot_json JSONB NOT NULL,
  alterado_por UUID,
  alterado_em TIMESTAMPTZ DEFAULT now(),
  motivo_alteracao TEXT
);

ALTER TABLE public.formula_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for formula_versoes"
ON public.formula_versoes FOR ALL
USING (true)
WITH CHECK (true);