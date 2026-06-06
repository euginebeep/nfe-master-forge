ALTER TABLE public.contas_receber 
  ADD COLUMN IF NOT EXISTS nota_saida_id UUID REFERENCES public.notas_saida(id),
  ADD COLUMN IF NOT EXISTS valor_original NUMERIC,
  ADD COLUMN IF NOT EXISTS valor_restante NUMERIC,
  ADD COLUMN IF NOT EXISTS origem TEXT;

COMMENT ON COLUMN public.contas_receber.nota_saida_id IS 'ID da nota de saída que gerou esta conta';
COMMENT ON COLUMN public.contas_receber.valor_original IS 'Valor original da conta (antes de pagamentos parciais)';
COMMENT ON COLUMN public.contas_receber.valor_restante IS 'Valor que ainda resta ser pago';
COMMENT ON COLUMN public.contas_receber.origem IS 'Origem da conta (ex: NF-E)';