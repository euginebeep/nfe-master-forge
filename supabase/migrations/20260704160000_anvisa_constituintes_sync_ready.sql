-- Prepara anvisa_constituintes p/ o sync do Power BI oficial (upsert por chave normalizada)
-- + camada de homologação da RT (preservada entre syncs). APLICADA via MCP em 2026-07-04.
ALTER TABLE public.anvisa_constituintes
  ADD COLUMN IF NOT EXISTS chave_norm text,
  ADD COLUMN IF NOT EXISTS homologado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS homologado_por text,
  ADD COLUMN IF NOT EXISTS homologado_em timestamptz,
  ADD COLUMN IF NOT EXISTS sincronizado_em timestamptz;

-- chave única (NÃO parcial) para o ON CONFLICT do upsert
DROP INDEX IF EXISTS public.anvisa_constituintes_chave_norm_uidx;
CREATE UNIQUE INDEX anvisa_constituintes_chave_norm_uidx
  ON public.anvisa_constituintes (chave_norm);

ALTER TABLE public.anvisa_constituintes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anvisa_constituintes_select ON public.anvisa_constituintes;
CREATE POLICY anvisa_constituintes_select ON public.anvisa_constituintes
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS anvisa_constituintes_write ON public.anvisa_constituintes;
CREATE POLICY anvisa_constituintes_write ON public.anvisa_constituintes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
