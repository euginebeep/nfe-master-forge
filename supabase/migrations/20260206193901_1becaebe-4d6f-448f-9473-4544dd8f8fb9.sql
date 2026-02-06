-- ============================================================
-- MIGRAÇÃO: ATIVOS ULTRA CRÍTICOS E CONVERSÃO UI
-- ============================================================

-- 1. Adicionar campos de classificação de risco na tabela itens
ALTER TABLE public.itens 
ADD COLUMN IF NOT EXISTS classificacao_risco TEXT DEFAULT 'NORMAL' CHECK (classificacao_risco IN ('NORMAL', 'ATENCAO', 'CRITICO', 'ULTRA_CRITICO')),
ADD COLUMN IF NOT EXISTS bloquear_entrada_mg_manual BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS metodo_distribuicao TEXT DEFAULT NULL CHECK (metodo_distribuicao IS NULL OR metodo_distribuicao IN ('PESAGEM_DIRETA', 'DISTRIBUICAO_GEOMETRICA', 'DISTRIBUICAO_GEOMETRICA_POR_PREMIX')),
ADD COLUMN IF NOT EXISTS texto_alerta_padrao TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS conversao_ui_mcg NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS controle_especial BOOLEAN DEFAULT FALSE;

-- 2. Adicionar campos na tabela de conversões
ALTER TABLE public.conversoes_unidades
ADD COLUMN IF NOT EXISTS conversao_ui_mcg NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS potencia_faixa_min NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS potencia_faixa_max NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS classificacao_risco TEXT DEFAULT 'NORMAL' CHECK (classificacao_risco IN ('NORMAL', 'ATENCAO', 'CRITICO', 'ULTRA_CRITICO'));

-- 3. Criar constraint unique para substância ANTES do insert
ALTER TABLE public.conversoes_unidades 
ADD CONSTRAINT conversoes_unidades_substancia_key UNIQUE (substancia);

-- 4. Adicionar coluna de controle especial nos itens da fórmula
ALTER TABLE public.formula_itens
ADD COLUMN IF NOT EXISTS classificacao_risco TEXT DEFAULT 'NORMAL',
ADD COLUMN IF NOT EXISTS metodo_distribuicao TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS alerta_exibido BOOLEAN DEFAULT FALSE;