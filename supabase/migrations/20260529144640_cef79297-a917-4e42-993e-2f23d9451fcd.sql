ALTER TABLE public.contas_pagar
  ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conciliado_em timestamptz;

ALTER TABLE public.contas_receber
  ADD COLUMN IF NOT EXISTS conciliado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS conciliado_em timestamptz;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_conciliacao
  ON public.contas_pagar (company_id, conciliado, data_vencimento);

CREATE INDEX IF NOT EXISTS idx_contas_receber_conciliacao
  ON public.contas_receber (company_id, conciliado, data_vencimento);