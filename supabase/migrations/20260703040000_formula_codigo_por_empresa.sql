-- ============================================================================
-- Correção: tenant novo não consegue criar a 1ª fórmula (onboarding travado)
--   Causa: formulas.codigo_formula tem UNIQUE GLOBAL. O front gera
--   gerarCodigoFormula(count_por_empresa + 1) => "FRM-<ano>-0001", que já existe
--   em OUTRA empresa => erro 23505 (mascarado como "Erro desconhecido").
--
--   Este arquivo:
--     1) Remove a UNIQUE global e cria UNIQUE (company_id, codigo_formula),
--        de modo que cada tenant tenha seu próprio "FRM-<ano>-0001".
--     2) (Defesa) Trigger que numera por empresa/ano NO SERVIDOR quando o
--        codigo_formula vier NULL/vazio — elimina a corrida do count() do front.
--        Fica DORMENTE enquanto o front continuar enviando o código.
--   Após aplicar: NOTIFY pgrst, 'reload schema';
--
--   OBS.: confirme o nome real da constraint antes, se necessário:
--     SELECT conname FROM pg_constraint
--      WHERE conrelid='public.formulas'::regclass AND contype='u';
-- ============================================================================

-- 1. Trocar UNIQUE global por UNIQUE por empresa --------------------------------
DO $$
DECLARE
  r record;
BEGIN
  -- Remove qualquer UNIQUE que seja SOMENTE em (codigo_formula)
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    WHERE c.conrelid = 'public.formulas'::regclass
      AND c.contype = 'u'
      AND (SELECT array_agg(a.attname ORDER BY a.attname)
             FROM unnest(c.conkey) k
             JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k
          ) = ARRAY['codigo_formula']
  LOOP
    EXECUTE format('ALTER TABLE public.formulas DROP CONSTRAINT %I', r.conname);
  END LOOP;

  -- Remove índice único global equivalente, se existir como índice solto
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname='public' AND tablename='formulas'
      AND indexname='formulas_codigo_formula_key'
  ) THEN
    EXECUTE 'DROP INDEX IF EXISTS public.formulas_codigo_formula_key';
  END IF;
END $$;

-- Cria a UNIQUE por empresa (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.formulas'::regclass
      AND conname='formulas_company_codigo_key'
  ) THEN
    ALTER TABLE public.formulas
      ADD CONSTRAINT formulas_company_codigo_key UNIQUE (company_id, codigo_formula);
  END IF;
END $$;

-- 2. Trigger de numeração por empresa/ano (defesa; só age se codigo vier vazio) --
CREATE OR REPLACE FUNCTION public.set_codigo_formula()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  v_ano text := to_char(now(), 'YYYY');
  v_seq int;
BEGIN
  IF NEW.codigo_formula IS NULL OR btrim(NEW.codigo_formula) = '' THEN
    -- Próximo sequencial da empresa no ano corrente (bloqueia a empresa p/ evitar corrida)
    SELECT COALESCE(MAX((regexp_replace(codigo_formula, '^FRM-\d{4}-', ''))::int), 0) + 1
      INTO v_seq
      FROM public.formulas
     WHERE company_id = NEW.company_id
       AND codigo_formula LIKE 'FRM-' || v_ano || '-%';

    NEW.codigo_formula := 'FRM-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_set_codigo_formula ON public.formulas;
CREATE TRIGGER trg_set_codigo_formula
  BEFORE INSERT ON public.formulas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_codigo_formula();

NOTIFY pgrst, 'reload schema';
