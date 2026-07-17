-- ============================================================================
-- VERSIONAMENTO: proximo_codigo_formula
-- Já aplicada em produção (cqkvekdrifmvedvpjmjr). Idempotente via CREATE OR REPLACE.
--
-- Substitui a geração client-side por count(*)+1, que colidia com gaps
-- (ex.: FRM-2026-0002/0003 existentes → count=2 → tentava 0003 de novo).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.proximo_codigo_formula(p_company_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid;
  v_ano text := to_char(now(), 'YYYY');
  v_prefixo text;
  v_max_seq int;
  v_proximo text;
BEGIN
  v_company := COALESCE(p_company_id, public.get_user_company_id());
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'Não foi possível determinar a empresa para gerar o código da fórmula';
  END IF;

  v_prefixo := 'FRM-' || v_ano || '-';

  SELECT COALESCE(MAX((regexp_replace(codigo_formula, '^FRM-\d{4}-', ''))::int), 0)
    INTO v_max_seq
  FROM public.formulas
  WHERE company_id = v_company
    AND codigo_formula ~ ('^FRM-' || v_ano || '-\d+$');

  v_proximo := v_prefixo || lpad((v_max_seq + 1)::text, 4, '0');

  WHILE EXISTS (
    SELECT 1
    FROM public.formulas
    WHERE company_id = v_company
      AND codigo_formula = v_proximo
  ) LOOP
    v_max_seq := v_max_seq + 1;
    v_proximo := v_prefixo || lpad((v_max_seq + 1)::text, 4, '0');
  END LOOP;

  RETURN v_proximo;
END;
$$;

GRANT EXECUTE ON FUNCTION public.proximo_codigo_formula(uuid) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
