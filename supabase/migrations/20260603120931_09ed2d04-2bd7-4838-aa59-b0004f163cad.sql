ALTER TABLE public.lotes_produto_acabado
  ADD COLUMN IF NOT EXISTS white_label BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS white_label_cliente_id UUID REFERENCES public.entidades(id),
  ADD COLUMN IF NOT EXISTS marca_cliente TEXT,
  ADD COLUMN IF NOT EXISTS rotulo_cliente_url TEXT;