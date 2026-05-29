
-- Add pedido_minimo to vendedores_externos
ALTER TABLE public.vendedores_externos
  ADD COLUMN IF NOT EXISTS pedido_minimo numeric NOT NULL DEFAULT 0;

-- pedido_vendedor_itens
CREATE TABLE IF NOT EXISTS public.pedido_vendedor_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_vendedor(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.itens(id),
  item_nome text NOT NULL,
  quantidade numeric NOT NULL DEFAULT 0,
  preco_unitario numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  qtd_do_estoque numeric NOT NULL DEFAULT 0,
  qtd_para_producao numeric NOT NULL DEFAULT 0,
  op_id uuid REFERENCES public.ordens_producao_industrial(id) ON DELETE SET NULL,
  status_item text NOT NULL DEFAULT 'PENDENTE',
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_vendedor_itens TO authenticated;
GRANT ALL ON public.pedido_vendedor_itens TO service_role;

ALTER TABLE public.pedido_vendedor_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select pedido_vendedor_itens"
  ON public.pedido_vendedor_itens FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant insert pedido_vendedor_itens"
  ON public.pedido_vendedor_itens FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "tenant update pedido_vendedor_itens"
  ON public.pedido_vendedor_itens FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "tenant delete pedido_vendedor_itens"
  ON public.pedido_vendedor_itens FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_pvi_pedido ON public.pedido_vendedor_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_pvi_company ON public.pedido_vendedor_itens(company_id);

CREATE TRIGGER trg_pvi_updated_at
  BEFORE UPDATE ON public.pedido_vendedor_itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
