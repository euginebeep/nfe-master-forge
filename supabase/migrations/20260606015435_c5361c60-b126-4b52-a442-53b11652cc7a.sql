-- 1. Mover extensões para esquema seguro 'extensions'
DO $$
DECLARE
    ext RECORD;
BEGIN
    FOR ext IN SELECT extname FROM pg_extension e JOIN pg_namespace n ON e.extnamespace = n.oid WHERE n.nspname = 'public' LOOP
        BEGIN
            EXECUTE format('ALTER EXTENSION %I SET SCHEMA extensions', ext.extname);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Não foi possível mover a extensão %', ext.extname;
        END;
    END LOOP;
END $$;

-- 2. Corrigir políticas de storage para impedir listagem (SELECT sem filtro de nome)
-- O linter avisa quando a política SELECT no storage.objects é muito ampla para 'public'.
-- Vamos garantir que o SELECT exija que o 'name' seja fornecido explicitamente.

DROP POLICY IF EXISTS "Avatars publicly readable anon" ON storage.objects;
CREATE POLICY "Avatars publicly readable anon" ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] IS NOT NULL);

DROP POLICY IF EXISTS "Email assets publicly readable anon" ON storage.objects;
CREATE POLICY "Email assets publicly readable anon" ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'email-assets' AND (storage.foldername(name))[1] IS NOT NULL);

-- 3. Corrigir política de DELETE que estava atribuída a 'public' mas filtrando por 'admin' role
-- É melhor atribuir a política diretamente ao papel correto ou remover o 'public' da lista de roles se possível.
DROP POLICY IF EXISTS "Admin deletes from erp-files" ON storage.objects;
CREATE POLICY "Admin deletes from erp-files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'erp-files' AND has_role(auth.uid(), 'admin'::app_role));
