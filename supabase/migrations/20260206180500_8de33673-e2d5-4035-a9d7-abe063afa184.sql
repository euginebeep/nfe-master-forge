-- Adicionar campos de cliente extras na tabela orcamentos
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS cliente_endereco TEXT,
ADD COLUMN IF NOT EXISTS cliente_telefone TEXT,
ADD COLUMN IF NOT EXISTS cliente_email TEXT,
ADD COLUMN IF NOT EXISTS cliente_whatsapp TEXT;

-- Adicionar campos de embalagem na tabela orcamento_itens
ALTER TABLE public.orcamento_itens
ADD COLUMN IF NOT EXISTS rotulo TEXT,
ADD COLUMN IF NOT EXISTS tampa_cor TEXT,
ADD COLUMN IF NOT EXISTS capsula_cor TEXT,
ADD COLUMN IF NOT EXISTS pote_cor TEXT,
ADD COLUMN IF NOT EXISTS incluir_silica BOOLEAN NOT NULL DEFAULT true;

-- Adicionar campos de embalagem na tabela pedido_itens
ALTER TABLE public.pedido_itens
ADD COLUMN IF NOT EXISTS rotulo TEXT,
ADD COLUMN IF NOT EXISTS tampa_cor TEXT,
ADD COLUMN IF NOT EXISTS capsula_cor TEXT,
ADD COLUMN IF NOT EXISTS pote_cor TEXT,
ADD COLUMN IF NOT EXISTS incluir_silica BOOLEAN NOT NULL DEFAULT true;