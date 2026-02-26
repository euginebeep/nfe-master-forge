
-- ============================================================
-- FIX: Multi-tenant isolation for profiles, user_roles, user_permissions
-- ============================================================

-- 1. PROFILES: Replace permissive "view all" with tenant-scoped policies
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Users can see profiles in their own company (or their own profile if no company yet)
CREATE POLICY "tenant_select_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR (company_id IS NOT NULL AND company_id = get_user_company_id())
  );

-- Users can only insert their own profile (trigger handles this)
CREATE POLICY "tenant_insert_profiles" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

-- Users can update their own profile
CREATE POLICY "tenant_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- Admins can update profiles within their company (for managing users)
CREATE POLICY "tenant_admin_update_profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') 
    AND company_id IS NOT NULL 
    AND company_id = get_user_company_id()
  );

-- 2. USER_ROLES: Scope admin management to same company
DROP POLICY IF EXISTS "Admins can manage all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;

-- Users can view their own role
CREATE POLICY "tenant_select_own_role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view roles of users in their company
CREATE POLICY "tenant_admin_select_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_roles.user_id 
        AND p.company_id IS NOT NULL
        AND p.company_id = get_user_company_id()
    )
  );

-- Admins can manage roles of users in their company
CREATE POLICY "tenant_admin_manage_roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_roles.user_id 
        AND p.company_id IS NOT NULL
        AND p.company_id = get_user_company_id()
    )
  );

-- 3. USER_PERMISSIONS: Scope to same company
DROP POLICY IF EXISTS "Admins can manage permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Users can view own permissions" ON public.user_permissions;
-- Also try common policy names
DROP POLICY IF EXISTS "admin_manage_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "user_view_own_permissions" ON public.user_permissions;

-- Users can view their own permissions
CREATE POLICY "tenant_select_own_permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admins can view permissions of users in their company
CREATE POLICY "tenant_admin_select_permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_permissions.user_id 
        AND p.company_id IS NOT NULL
        AND p.company_id = get_user_company_id()
    )
  );

-- Admins can manage permissions of users in their company
CREATE POLICY "tenant_admin_manage_permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    AND EXISTS (
      SELECT 1 FROM profiles p 
      WHERE p.id = user_permissions.user_id 
        AND p.company_id IS NOT NULL
        AND p.company_id = get_user_company_id()
    )
  );
