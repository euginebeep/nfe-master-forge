
ALTER TABLE public.pedidos_vendedor
  ADD COLUMN IF NOT EXISTS transportadora_id uuid REFERENCES public.entidades(id),
  ADD COLUMN IF NOT EXISTS codigo_rastreio text,
  ADD COLUMN IF NOT EXISTS volumes integer,
  ADD COLUMN IF NOT EXISTS data_despacho timestamptz,
  ADD COLUMN IF NOT EXISTS data_entrega_confirmada timestamptz,
  ADD COLUMN IF NOT EXISTS nfe_numero text,
  ADD COLUMN IF NOT EXISTS nfe_chave text;

CREATE TABLE IF NOT EXISTS public.expedicao_romaneio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  pedido_id uuid NOT NULL REFERENCES public.pedidos_vendedor(id) ON DELETE CASCADE,
  item_id uuid,
  produto_nome text,
  quantidade numeric,
  numero_lote text,
  data_validade date,
  conferido boolean NOT NULL DEFAULT false,
  conferido_em timestamptz,
  conferido_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expedicao_romaneio TO authenticated;
GRANT ALL ON public.expedicao_romaneio TO service_role;

ALTER TABLE public.expedicao_romaneio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant select expedicao_romaneio"
  ON public.expedicao_romaneio FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant insert expedicao_romaneio"
  ON public.expedicao_romaneio FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "tenant update expedicao_romaneio"
  ON public.expedicao_romaneio FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "tenant delete expedicao_romaneio"
  ON public.expedicao_romaneio FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_exp_romaneio_pedido ON public.expedicao_romaneio(pedido_id);
CREATE INDEX IF NOT EXISTS idx_exp_romaneio_company ON public.expedicao_romaneio(company_id);
