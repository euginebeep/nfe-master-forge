-- ============================================================================
-- BUG 2 — Tenant novo não consegue criar a 1ª fórmula
--   formulas.codigo_formula tem UNIQUE GLOBAL, mas gerarCodigoFormula numera por
--   empresa (RLS). Empresa nova gera "FRM-<ano>-0001", que já existe em OUTRA
--   empresa => erro 23505 (mascarado no front como "Erro desconhecido").
--
--   Correção: trocar a unicidade global por unicidade POR EMPRESA.
--   Após aplicar: NOTIFY pgrst, 'reload schema';
--
--   (1) Nome real da constraint unique (para conferência):
--       SELECT conname FROM pg_constraint
--        WHERE conrelid='formulas'::regclass AND contype='u';
--       => confirmado neste ambiente como: formulas_codigo_formula_key
--          (nome obtido do próprio erro 23505 do Postgres).
--       Se no seu banco o nome for diferente, ajuste o DROP CONSTRAINT abaixo.
-- ============================================================================

-- (2) Remove a UNIQUE global
ALTER TABLE public.formulas DROP CONSTRAINT IF EXISTS formulas_codigo_formula_key;

-- (3) Adiciona UNIQUE por empresa (idempotente)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.formulas'::regclass
      AND conname  = 'formulas_company_codigo_key'
  ) THEN
    ALTER TABLE public.formulas
      ADD CONSTRAINT formulas_company_codigo_key UNIQUE (company_id, codigo_formula);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
