-- ============================================================================
-- VERSIONAMENTO: alinhar premix_politica_constituinte + constituintes_candidatos_premix
-- Já aplicados em produção. Idempotente.
-- ============================================================================

-- Coluna observacoes (presente no DDL de produção; pode faltar em installs antigos)
ALTER TABLE public.premix_politica_constituinte
  ADD COLUMN IF NOT EXISTS observacoes text;

ALTER TABLE public.premix_politica_constituinte
  ALTER COLUMN exige_premix SET DEFAULT true;

-- Policy no padrão profiles (além de get_user_company_id, se já existir)
DROP POLICY IF EXISTS premix_politica_constituinte_tenant ON public.premix_politica_constituinte;
CREATE POLICY premix_politica_constituinte_tenant ON public.premix_politica_constituinte
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

CREATE OR REPLACE FUNCTION public.constituintes_candidatos_premix()
RETURNS TABLE (
  constituinte_id uuid,
  nome_tecnico text,
  categoria text,
  limite_max_num numeric,
  limite_unidade text,
  exige_premix boolean,
  proporcao_sugerida text,
  fator_diluicao_sugerido numeric,
  solubilidade_sugerida text,
  origem text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.nome_tecnico,
    c.categoria,
    c.limite_max_num,
    c.limite_unidade,
    COALESCE(
      p.exige_premix,
      (c.limite_unidade = 'mcg' OR (c.limite_unidade = 'mg' AND c.limite_max_num < 5))
    ),
    COALESCE(
      '1:' || p.fator_diluicao::text,
      CASE
        WHEN c.limite_unidade = 'mcg' AND c.limite_max_num < 1000 THEN '1:1000'
        WHEN c.limite_unidade = 'mcg' THEN '1:100'
        WHEN c.limite_unidade = 'mg' AND c.limite_max_num < 1 THEN '1:1000'
        ELSE '1:100'
      END
    ),
    COALESCE(
      p.fator_diluicao,
      CASE
        WHEN c.limite_unidade = 'mcg' AND c.limite_max_num < 1000 THEN 1000
        WHEN c.limite_unidade = 'mcg' THEN 100
        WHEN c.limite_unidade = 'mg' AND c.limite_max_num < 1 THEN 1000
        ELSE 100
      END
    ),
    COALESCE(
      p.solubilidade,
      CASE
        WHEN lower(c.nome_tecnico) ~ '(colecalciferol|ergocalciferol|calcidiol|vitamina d|retinol|retinila|betacaroteno|caroteno|vitamina a|tocoferol|menaquinona|fitonadiona|fitomenadiona|vitamina k)'
          THEN 'LIPO'
        ELSE 'HIDRO'
      END
    ),
    CASE WHEN p.id IS NOT NULL THEN 'RT' ELSE 'AUTO' END
  FROM public.anvisa_constituintes c
  LEFT JOIN public.premix_politica_constituinte p
    ON p.constituinte_id = c.id
   AND p.company_id = public.get_user_company_id()
  WHERE c.ativo = true
    AND coalesce(c.is_proibido, false) = false
    AND (
      c.limite_unidade = 'mcg'
      OR (c.limite_unidade = 'mg' AND c.limite_max_num IS NOT NULL AND c.limite_max_num < 5)
      OR p.exige_premix = true
    )
  ORDER BY
    CASE c.limite_unidade WHEN 'mcg' THEN 1 ELSE 2 END,
    c.limite_max_num NULLS LAST,
    c.nome_tecnico;
$$;

GRANT EXECUTE ON FUNCTION public.constituintes_candidatos_premix()
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
