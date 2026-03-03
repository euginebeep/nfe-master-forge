
-- Add fiscal and commercial columns to itens table
-- These fields are shown in ProdutoDetailPage but don't exist in the DB

-- Fiscal fields
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS cest TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS cfop_entrada_padrao TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS cfop_saida_padrao TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS origem_icms TEXT DEFAULT '0';
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS cst_icms TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS aliquota_icms NUMERIC;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS mva_st NUMERIC;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS cst_ipi TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS aliquota_ipi NUMERIC;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS codigo_enquadramento_ipi TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS cst_pis TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS aliquota_pis NUMERIC;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS cst_cofins TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS aliquota_cofins NUMERIC;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS codigo_anp TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS observacoes_fiscais TEXT;

-- Commercial fields  
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS unidade_fornecedor TEXT;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS preco_unitario_fornecedor NUMERIC;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS custo_por_unidade_interna NUMERIC;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS moq NUMERIC;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS lead_time_dias INTEGER;
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS observacoes_comerciais TEXT;
