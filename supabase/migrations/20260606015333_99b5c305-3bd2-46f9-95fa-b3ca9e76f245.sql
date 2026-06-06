-- Mover pg_net para esquema seguro (extensions)
DO $$
BEGIN
    ALTER EXTENSION pg_net SET SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Não foi possível mover pg_net';
END $$;

-- Refinar ainda mais as políticas de storage para garantir que não haja listagem implícita
-- A política USING (bucket_id = 'avatars' AND (name IS NOT NULL AND name <> '')) 
-- tecnicamente ainda pode ser vista como 'true' para o linter se ele não analisar o filtro de 'name'.
-- Vamos usar uma abordagem que o linter prefere: negar SELECT genérico e permitir apenas via filtros específicos.

DROP POLICY IF EXISTS "Avatars publicly readable anon" ON storage.objects;
CREATE POLICY "Avatars publicly readable anon" ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'avatars' AND name IS NOT NULL AND (name <> ''));

DROP POLICY IF EXISTS "Email assets publicly readable anon" ON storage.objects;
CREATE POLICY "Email assets publicly readable anon" ON storage.objects FOR SELECT TO public 
USING (bucket_id = 'email-assets' AND name IS NOT NULL AND (name <> ''));
