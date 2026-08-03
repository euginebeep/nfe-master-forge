-- Camada de validade do laudo, separada do parecer tecnico (status_geral).
-- status_geral  = o que o checker achou da formula
-- status_validacao = se o documento vale como laudo tecnico
ALTER TABLE public.anvisa_laudos
  ADD COLUMN IF NOT EXISTS status_validacao text NOT NULL DEFAULT 'PRELIMINAR',
  ADD COLUMN IF NOT EXISTS invalidado_em    timestamptz,
  ADD COLUMN IF NOT EXISTS invalidado_por   text,
  ADD COLUMN IF NOT EXISTS invalidado_motivo text,
  ADD COLUMN IF NOT EXISTS emitido_em       timestamptz;

ALTER TABLE public.anvisa_laudos
  DROP CONSTRAINT IF EXISTS chk_laudo_status_validacao;
ALTER TABLE public.anvisa_laudos
  ADD CONSTRAINT chk_laudo_status_validacao
  CHECK (status_validacao IN ('PRELIMINAR','VALIDADO_RT','INVALIDADO'));

COMMENT ON COLUMN public.anvisa_laudos.status_validacao IS
  'PRELIMINAR = parecer do checker, sem valor probatorio. VALIDADO_RT = RT nominada '
  'confirmou e assinou. INVALIDADO = documento retirado de circulacao. '
  'NUNCA tratar PRELIMINAR como laudo tecnico.';
COMMENT ON COLUMN public.anvisa_laudos.status_geral IS
  'Parecer do checker sobre a formula. NAO indica validade do documento — ver status_validacao.';