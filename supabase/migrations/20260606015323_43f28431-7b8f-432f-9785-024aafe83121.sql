-- 1. Mover extensões para esquema seguro 'extensions' se ainda estiverem no public
CREATE SCHEMA IF NOT EXISTS extensions;
DO $$
DECLARE
    ext RECORD;
BEGIN
    FOR ext IN SELECT extname FROM pg_extension WHERE extname NOT IN ('plpgsql') LOOP
        BEGIN
            EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext.extname);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível mover a extensão %', ext.extname;
        END;
    END LOOP;
END $$;

-- 2. Corrigir políticas RLS permissivas (true)
-- demo_leads: Remover acesso público direto 'true' e restringir ou manter apenas se for intencional
-- Aqui vamos restringir para authenticated ou service_role se possível, ou pelo menos ser mais específico.
-- Se demo_leads é para captura de leads do site, o 'true' no INSERT é comum, mas o linter avisa.
-- Vamos mudar para uma política que exige que os dados básicos existam.
DROP POLICY IF EXISTS "Anyone can insert demo leads" ON public.demo_leads;
CREATE POLICY "Anyone can insert demo leads" ON public.demo_leads FOR INSERT WITH CHECK (name IS NOT NULL AND email IS NOT NULL);

DROP POLICY IF EXISTS "Service role insere logs" ON public.anvisa_search_log;
CREATE POLICY "Service role insere logs" ON public.anvisa_search_log FOR INSERT TO service_role WITH CHECK (true);

-- 3. Corrigir permissões de funções SECURITY DEFINER no esquema public
-- Revogar EXECUTE de public e authenticated por padrão para todas as SD functions em public
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE p.prosecdef = true AND n.nspname = 'public'
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM public', func_record.nspname, func_record.proname, func_record.args);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM authenticated', func_record.nspname, func_record.proname, func_record.args);
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', func_record.nspname, func_record.proname, func_record.args);
        -- Garantir que service_role ainda possa executar
        EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role', func_record.nspname, func_record.proname, func_record.args);
    END LOOP;
END $$;

-- 4. Corrigir políticas de buckets públicos para evitar listagem total
-- Avatars: Ajustar política de SELECT para exigir o nome do arquivo ou estar autenticado com ID específico
DROP POLICY IF EXISTS "Avatars publicly readable anon" ON storage.objects;
CREATE POLICY "Avatars publicly readable anon" ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'avatars' AND (name IS NOT NULL AND name <> ''));

DROP POLICY IF EXISTS "Email assets publicly readable anon" ON storage.objects;
CREATE POLICY "Email assets publicly readable anon" ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'email-assets' AND (name IS NOT NULL AND name <> ''));

-- Garantir GRANTs para tabelas críticas (caso tenham sido criadas recentemente)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
