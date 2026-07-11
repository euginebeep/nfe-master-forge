-- Pedidos de compra: colunas para envio ao fornecedor e documento com frete/prazo

CREATE TABLE IF NOT EXISTS public.pedidos_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  numero_interno TEXT NOT NULL,
  fornecedor_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  frete NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'EMITIDO',
  emitido_em TIMESTAMPTZ DEFAULT now(),
  pedido_enviado_em TIMESTAMPTZ,
  observacao TEXT,
  prazo_entrega TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.pedidos_compra_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos_compra(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.itens(id) ON DELETE SET NULL,
  item_nome TEXT NOT NULL,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  unidade TEXT,
  unidade_compra TEXT,
  num_pacotes NUMERIC,
  qtd_por_pacote NUMERIC,
  preco_unitario NUMERIC,
  subtotal NUMERIC,
  valor_subtotal NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pedidos_compra
  ADD COLUMN IF NOT EXISTS frete NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pedido_enviado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS observacao TEXT,
  ADD COLUMN IF NOT EXISTS prazo_entrega TEXT;

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_company_emitido
  ON public.pedidos_compra(company_id, emitido_em DESC);

CREATE INDEX IF NOT EXISTS idx_pedidos_compra_itens_pedido
  ON public.pedidos_compra_itens(pedido_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_compra_itens TO authenticated;
GRANT ALL ON public.pedidos_compra TO service_role;
GRANT ALL ON public.pedidos_compra_itens TO service_role;

CREATE OR REPLACE FUNCTION public.pedido_compra_belongs_to_tenant(_pid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.pedidos_compra
    WHERE id = _pid
      AND company_id = public.get_user_company_id()
  );
$$;

ALTER TABLE public.pedidos_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_compra_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t_pedidos_compra" ON public.pedidos_compra;
CREATE POLICY "t_pedidos_compra" ON public.pedidos_compra
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "t_pedidos_compra_itens" ON public.pedidos_compra_itens;
CREATE POLICY "t_pedidos_compra_itens" ON public.pedidos_compra_itens
  FOR ALL TO authenticated
  USING (public.pedido_compra_belongs_to_tenant(pedido_id))
  WITH CHECK (public.pedido_compra_belongs_to_tenant(pedido_id));

COMMENT ON COLUMN public.pedidos_compra.pedido_enviado_em IS
  'Data/hora em que o pedido foi enviado ao fornecedor (WhatsApp ou e-mail).';
