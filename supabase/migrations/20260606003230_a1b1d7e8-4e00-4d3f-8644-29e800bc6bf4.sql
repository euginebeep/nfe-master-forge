-- 1. Revoke public execute on all public schema functions by default
-- We use a simpler approach to avoid argument matching issues
DO $$ 
DECLARE 
  r RECORD;
BEGIN
  FOR r IN 
    SELECT n.nspname as schema, p.proname as name, pg_get_function_identity_arguments(p.oid) as args
    FROM pg_proc p 
    JOIN pg_namespace n ON n.oid = p.pronamespace 
    WHERE n.nspname = 'public'
  LOOP
    EXECUTE 'REVOKE ALL ON FUNCTION ' || quote_ident(r.schema) || '.' || quote_ident(r.name) || '(' || r.args || ') FROM PUBLIC';
  END LOOP;
END $$;

-- 2. Grant execute back to roles for essential functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;

-- 3. Fix storage bucket listing (Security Best Practice)
DROP POLICY IF EXISTS "erp_files_read_tenant" ON storage.objects;
CREATE POLICY "erp_files_read_tenant" ON storage.objects 
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'erp-files' AND 
    (
      EXISTS (SELECT 1 FROM public.arquivos a WHERE a.storage_key = storage.objects.name AND a.company_id = public.get_user_company_id())
      OR owner = auth.uid()
    )
  );

-- 4. Final check on SECURITY DEFINER functions - ensure they are in search_path=public
ALTER FUNCTION public.get_user_role(uuid) SET search_path = public;
ALTER FUNCTION public.has_role(uuid, public.app_role) SET search_path = public;
ALTER FUNCTION public.get_user_company_id() SET search_path = public;
