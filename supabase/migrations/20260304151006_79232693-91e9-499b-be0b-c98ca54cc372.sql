ALTER TABLE public.qc_desvios
  ADD COLUMN IF NOT EXISTS fonte_desvio text DEFAULT 'PRODUCAO',
  ADD COLUMN IF NOT EXISTS produto_id uuid,
  ADD COLUMN IF NOT EXISTS insumo_id uuid,
  ADD COLUMN IF NOT EXISTS lote_fornecedor text,
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid,
  ADD COLUMN IF NOT EXISTS cliente_id uuid,
  ADD COLUMN IF NOT EXISTS pedido_venda_id uuid;