-- ============================================================================
-- Política de pré-mix por constituinte (decisão da RT).
-- Sugestão automática fica no app (src/lib/premix-politica.ts).
-- Se existe linha aqui → prevalece sobre a sugestão.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.premix_politica_constituinte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT public.get_user_company_id(),
  constituinte_id uuid NOT NULL REFERENCES public.anvisa_constituintes(id) ON DELETE CASCADE,
  exige_premix boolean NOT NULL,
  solubilidade text CHECK (solubilidade IS NULL OR solubilidade IN ('LIPO', 'HIDRO', 'INDEFINIDA')),
  fator_diluicao numeric,
  veiculo text,
  precisa_antioxidante boolean NOT NULL DEFAULT false,
  precisa_protecao_luz boolean NOT NULL DEFAULT false,
  ajustado_por text,
  ajustado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, constituinte_id)
);

CREATE INDEX IF NOT EXISTS idx_premix_politica_company
  ON public.premix_politica_constituinte (company_id);

CREATE INDEX IF NOT EXISTS idx_premix_politica_constituinte
  ON public.premix_politica_constituinte (constituinte_id);

ALTER TABLE public.premix_politica_constituinte ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS premix_politica_constituinte_all ON public.premix_politica_constituinte;
CREATE POLICY premix_politica_constituinte_all ON public.premix_politica_constituinte
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

NOTIFY pgrst, 'reload schema';
