-- PRINCIPIO: regra da ANVISA e lei global. Nenhum tenant, nem admin de tenant,
-- pode escrever nela. Escrita apenas pela sincronizacao (service_role).
-- Ver doutrina/01-principios.md do brainx-anvisa-mcp.

DROP POLICY IF EXISTS anvisa_constituintes_write_admin ON public.anvisa_constituintes;

-- Garante que a escrita por service_role continua existindo
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename='anvisa_constituintes' AND policyname='anvisa_constituintes_write'
  ) THEN
    CREATE POLICY anvisa_constituintes_write ON public.anvisa_constituintes
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

COMMENT ON TABLE public.anvisa_constituintes IS
  'CAMADA GLOBAL — regra da ANVISA. Leitura para authenticated, escrita SOMENTE '
  'service_role (sincronizacao). Nao criar policy de escrita para authenticated: '
  'admin de tenant editando limite legal contamina os laudos de todos os tenants.';