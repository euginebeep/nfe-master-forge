-- 1. Mover funções críticas de volta para o esquema public para compatibilidade com o frontend e RLS
ALTER FUNCTION security.has_role(uuid, app_role) SET SCHEMA public;
ALTER FUNCTION security.get_user_role(uuid) SET SCHEMA public;
ALTER FUNCTION security.get_user_company_id() SET SCHEMA public;

-- 2. Garantir permissões de execução para usuários autenticados e anônimos (necessário para RLS e UI)
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated, anon;

-- 3. Certificar que o search_path prioriza o esquema public
ALTER DATABASE postgres SET search_path TO public, security, extensions;
