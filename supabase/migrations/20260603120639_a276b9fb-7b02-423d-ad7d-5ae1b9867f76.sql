ALTER TABLE public.lotes_produto_acabado
  ADD COLUMN IF NOT EXISTS white_label_cliente_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS marca_cliente TEXT,
  ADD COLUMN IF NOT EXISTS rotulo_cliente_url TEXT,
  ADD COLUMN IF NOT EXISTS white_label_atribuido_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_lotes_pa_white_label_cliente
  ON public.lotes_produto_acabado(white_label_cliente_id)
  WHERE white_label_cliente_id IS NOT NULL;