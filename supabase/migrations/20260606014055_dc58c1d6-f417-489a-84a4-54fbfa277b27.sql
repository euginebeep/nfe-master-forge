-- 1. Criar esquema de segurança se não existir
CREATE SCHEMA IF NOT EXISTS security;

-- 2. Mover funções auxiliares de segurança para o esquema security
-- Nota: Algumas funções podem ser referenciadas por RLS, então mantemos no search_path
ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA security;
ALTER FUNCTION public.get_user_role(uuid) SET SCHEMA security;
ALTER FUNCTION public.get_user_company_id() SET SCHEMA security;
ALTER FUNCTION public.has_module_permission(uuid, text, text) SET SCHEMA security;
ALTER FUNCTION public.is_demo_company(uuid) SET SCHEMA security;
ALTER FUNCTION public.has_active_unlock(uuid) SET SCHEMA security;

-- 3. Revogar permissão de execução global de funções SECURITY DEFINER para usuários autenticados
-- Isso força que elas sejam chamadas apenas pelo sistema ou por funções autorizadas
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM public, authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- 4. Re-conceder execução seletiva para funções que realmente precisam ser chamadas pelo cliente
GRANT EXECUTE ON FUNCTION public.registrar_evento_auditoria(tipo_evento_auditoria, text, text, uuid, text, uuid, text, text, text, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ultimo_acesso(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.baixar_estoque_op_materias_primas(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.baixar_estoque_op_embalagens(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_smtp_password(text) TO authenticated;

-- 5. Corrigir políticas de armazenamento (Buckets Públicos)
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

-- 6. Ajustar search_path do banco para incluir segurança
ALTER DATABASE postgres SET search_path TO public, security, extensions;

-- 7. Garantir permissões no esquema security
GRANT USAGE ON SCHEMA security TO authenticated, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA security TO authenticated, anon;
