GRANT EXECUTE ON FUNCTION public.get_user_company_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ultimo_acesso(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_create_company() TO authenticated;