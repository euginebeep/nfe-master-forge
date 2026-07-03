-- Adiciona status AGUARDANDO_COMPRA ao CHECK constraint da OP industrial
ALTER TABLE public.ordens_producao_industrial
  DROP CONSTRAINT IF EXISTS ordens_producao_industrial_status_check;

ALTER TABLE public.ordens_producao_industrial
  ADD CONSTRAINT ordens_producao_industrial_status_check
  CHECK (status IN (
    'PLANEJADA',
    'AGUARDANDO_MATERIAIS',
    'AGUARDANDO_COMPRA',
    'EM_PRODUCAO',
    'FINALIZADA',
    'BLOQUEADA',
    'CANCELADA'
  ));
