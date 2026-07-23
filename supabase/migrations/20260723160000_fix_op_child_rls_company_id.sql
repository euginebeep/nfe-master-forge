-- ============================================================
-- RLS direto em tabelas filhas op_* (evitar recursão em join embutido)
-- Padrão: company_id na filha + backfill + policy direta + trigger
-- Mesmo padrão de 20260623040000_fix_entidade_papeis_rls.sql
-- Banco de produção ainda NÃO tinha isto nas op_* (23/07/2026).
-- ============================================================

-- norm_txt: usada no casamento de itens da NF-e (pode já existir em prod)
CREATE OR REPLACE FUNCTION public.norm_txt(p text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    lower(
      regexp_replace(
        translate(
          coalesce(p, ''),
          'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ',
          'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn'
        ),
        '[^a-z0-9]+',
        '',
        'g'
      )
    ),
    ''
  );
$$;

GRANT EXECUTE ON FUNCTION public.norm_txt(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_op_child_company_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.ordens_producao_industrial
    WHERE id = NEW.op_id;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'op_materias_primas',
    'op_pesagens_criticas',
    'op_checklist',
    'op_controle_qualidade',
    'op_controle_perdas',
    'op_embalagens',
    'op_historico_etapas'
  ];
  pol text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.company(id)',
      t
    );

    EXECUTE format(
      'UPDATE public.%I c
       SET company_id = op.company_id
       FROM public.ordens_producao_industrial op
       WHERE c.op_id = op.id
         AND c.company_id IS NULL',
      t
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS idx_%s_company_id ON public.%I (company_id)',
      t, t
    );

    -- Drop policies conhecidas (legado + tenant)
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY t_%s ON public.%I
         FOR ALL TO authenticated
         USING (company_id = public.get_user_company_id())
         WITH CHECK (company_id = public.get_user_company_id())',
      t, t
    );

    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_company_id ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER trg_%s_company_id
         BEFORE INSERT OR UPDATE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.set_op_child_company_id()',
      t, t
    );
  END LOOP;
END $$;
