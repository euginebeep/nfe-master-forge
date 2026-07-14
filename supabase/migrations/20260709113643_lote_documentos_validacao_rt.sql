ALTER TABLE public.lote_documentos
  ADD COLUMN IF NOT EXISTS validado_por uuid,
  ADD COLUMN IF NOT EXISTS validado_em timestamptz;

COMMENT ON COLUMN public.lote_documentos.validado_por IS 'ID do usuario (RT) que validou o COA';
COMMENT ON COLUMN public.lote_documentos.validado_em IS 'Data/hora da validacao do COA pela RT';
