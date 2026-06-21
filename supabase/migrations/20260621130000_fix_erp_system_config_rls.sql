-- ============================================================
-- FIX: erp_system_config — RLS corrigida para usar saas_owner
-- via user_roles (padrão do sistema), não profiles.role
-- ============================================================

-- Remover a policy incorreta que usava profiles.role (roles inexistentes)
DROP POLICY IF EXISTS "super_admin_full_access" ON public.erp_system_config;

-- Nova policy: apenas saas_owner pode ler e escrever
-- (mesmo padrão usado em saas_ai_config e saas-admin Edge Function)
CREATE POLICY "saas_owner_full_access" ON public.erp_system_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'saas_owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'saas_owner'
    )
  );

-- Garantir que service_role (Edge Functions) pode ler sem restrição de RLS
GRANT SELECT, INSERT, UPDATE ON public.erp_system_config TO service_role;
