-- 1. Remover privilégios de execução anônima (anon) em funções críticas SECURITY DEFINER
-- Estas funções agora só podem ser chamadas por usuários autenticados (via RLS) ou service_role
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM anon;

-- 2. Garantir que o search_path é seguro e não inclui extensões vulneráveis por padrão
ALTER DATABASE postgres SET search_path TO public, security;

-- 3. Reforçar políticas de storage para evitar enumeração de arquivos (listagem)
-- Bucket: avatars
DROP POLICY IF EXISTS "Avatars publicly readable anon" ON storage.objects;
CREATE POLICY "Avatars publicly readable anon" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'avatars' 
  AND (auth.uid() IS NOT NULL OR (name IS NOT NULL AND name <> ''))
);

-- Bucket: email-assets
DROP POLICY IF EXISTS "Email assets publicly readable anon" ON storage.objects;
CREATE POLICY "Email assets publicly readable anon" ON storage.objects 
FOR SELECT USING (
  bucket_id = 'email-assets' 
  AND (auth.uid() IS NOT NULL OR (name IS NOT NULL AND name <> ''))
);

-- 4. Garantir que funções de trigger e auxiliares internas não são executáveis publicamente
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_notify_alerta_executivo() FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_notify_anomalia() FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_low_stock() FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.notify_expiring_lots() FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_gerar_qr_hash_op() FROM public, authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.trigger_registrar_movimentacao_entrada_lote() FROM public, authenticated, anon;
