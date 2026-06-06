-- 1. Revoke public execution of SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public.can_create_company() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.custo_op_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.entidade_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.formula_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_company_id() FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_active_unlock(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_demo_company(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.item_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lote_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nota_entrada_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.nota_saida_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.op_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.orcamento_belongs_to_tenant(uuid) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pedido_belongs_to_tenant(uuid) FROM public, anon, authenticated;

-- Grant execution back to authenticated/service_role as they are used in RLS
GRANT EXECUTE ON FUNCTION public.can_create_company() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.custo_op_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.entidade_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.formula_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_unlock(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_module_permission(uuid, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_demo_company(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.item_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.lote_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nota_entrada_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.nota_saida_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.op_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orcamento_belongs_to_tenant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pedido_belongs_to_tenant(uuid) TO authenticated, service_role;

-- 2. Move extensions to 'extensions' schema
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the extensions (that support it)
ALTER EXTENSION unaccent SET SCHEMA extensions;
ALTER EXTENSION pg_trgm SET SCHEMA extensions;

-- 3. Ensure extensions is in the search_path
ALTER DATABASE postgres SET search_path TO public, extensions;
