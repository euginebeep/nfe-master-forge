ALTER TABLE public.qc_desvios 
  ADD COLUMN IF NOT EXISTS contencao_anexos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS impl_anexos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verif_anexos jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS encerramento_anexos jsonb DEFAULT '[]'::jsonb;