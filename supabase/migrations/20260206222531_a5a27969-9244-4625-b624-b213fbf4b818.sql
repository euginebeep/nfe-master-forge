-- Adicionar campos de embalagem e especificações na OP
ALTER TABLE public.ordens_producao_industrial
ADD COLUMN IF NOT EXISTS cor_capsula TEXT,
ADD COLUMN IF NOT EXISTS cor_tampa TEXT,
ADD COLUMN IF NOT EXISTS tipo_pote TEXT,
ADD COLUMN IF NOT EXISTS tipo_tampa TEXT,
ADD COLUMN IF NOT EXISTS incluir_silica BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS quantidade_silica_sache TEXT DEFAULT '1g',
ADD COLUMN IF NOT EXISTS descricao_rotulo TEXT,
ADD COLUMN IF NOT EXISTS especificacoes_embalagem JSONB;