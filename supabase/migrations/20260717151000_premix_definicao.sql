-- ============================================================================
-- VERSIONAMENTO: premix_definicao
-- Já aplicada em produção (cqkvekdrifmvedvpjmjr). Idempotente.
-- Define o vínculo item-premix ↔ ativo puro / constituinte ANVISA.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.premix_definicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.get_user_company_id(),
  item_premix_id uuid NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  item_ativo_puro_id uuid REFERENCES public.itens(id),
  constituinte_anvisa_id uuid REFERENCES public.anvisa_constituintes(id),
  unidade_potencia text NOT NULL DEFAULT 'UI',
  diluente_padrao text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT premix_definicao_uk UNIQUE (company_id, item_premix_id)
);

ALTER TABLE public.premix_definicao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS premix_definicao_tenant ON public.premix_definicao;
CREATE POLICY premix_definicao_tenant ON public.premix_definicao
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

CREATE INDEX IF NOT EXISTS idx_premix_definicao_item
  ON public.premix_definicao (item_premix_id);

CREATE INDEX IF NOT EXISTS idx_premix_definicao_constituinte
  ON public.premix_definicao (constituinte_anvisa_id);

NOTIFY pgrst, 'reload schema';
