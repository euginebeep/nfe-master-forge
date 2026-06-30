-- Fix: a tabela public.ambiental_sensores foi criada pela primeira vez em
-- 20260529133604_...sql SEM a coluna updated_at. A migration seguinte
-- (20260529142943_...sql) tentou recriar a tabela com CREATE TABLE IF NOT EXISTS
-- já incluindo updated_at, mas como a tabela já existia, esse CREATE TABLE foi
-- ignorado pelo Postgres -- só a coluna nunca foi adicionada de fato.
-- O trigger update_ambiental_sensores_updated_at (criado no mesmo arquivo)
-- ficou orfão, tentando setar NEW.updated_at numa coluna inexistente,
-- causando o erro: record "new" has no field "updated_at" em todo UPDATE.

ALTER TABLE public.ambiental_sensores
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Garantir que registros existentes tenham um valor (evita NULL silencioso)
UPDATE public.ambiental_sensores
  SET updated_at = COALESCE(updated_at, created_at, now())
  WHERE updated_at IS NULL;
