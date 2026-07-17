-- ============================================================================
-- VERSIONAMENTO: coa_densidade_processados
-- Controle anti-reprocessamento de densidade via COA. Já em produção.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.coa_densidade_processados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  item_id uuid NOT NULL,
  nota_entrada_id uuid,
  laudo_id uuid,
  densidade_encontrada boolean NOT NULL DEFAULT false,
  processado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT coa_dens_proc_uk UNIQUE (item_id, nota_entrada_id)
);

ALTER TABLE public.coa_densidade_processados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS coa_dens_proc_tenant ON public.coa_densidade_processados;
CREATE POLICY coa_dens_proc_tenant ON public.coa_densidade_processados
  FOR ALL TO authenticated
  USING (
    company_id IN (
      SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
  )
  WITH CHECK (
    company_id IN (
      SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
