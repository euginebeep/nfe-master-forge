
-- FIXES PÓS-MIGRAÇÃO: remover políticas permissivas restantes + corrigir view security definer

-- 0) View must be security invoker (fix linter: Security Definer View)
ALTER VIEW public.vw_anvisa_constituintes_completo SET (security_invoker = true);

-- 1) company insert policy must not be WITH CHECK (true)
CREATE OR REPLACE FUNCTION public.can_create_company()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
     AND (SELECT company_id FROM public.profiles WHERE id = auth.uid()) IS NULL
$$;

DROP POLICY IF EXISTS "tenant_insert_company" ON public.company;
CREATE POLICY "tenant_insert_company"
  ON public.company FOR INSERT TO authenticated
  WITH CHECK (public.can_create_company());

-- 2) conversoes_unidades: remove Allow-all and restrict write to admin only
DROP POLICY IF EXISTS "Allow all for conversoes_unidades" ON public.conversoes_unidades;

-- Read for authenticated users (no tenant data here; reference dataset)
DROP POLICY IF EXISTS "conversoes_unidades_read" ON public.conversoes_unidades;
CREATE POLICY "conversoes_unidades_read"
  ON public.conversoes_unidades FOR SELECT TO authenticated
  USING (true);

-- Admin-only write
DROP POLICY IF EXISTS "conversoes_unidades_admin_write" ON public.conversoes_unidades;
CREATE POLICY "conversoes_unidades_admin_write"
  ON public.conversoes_unidades FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) Remove leftover permissive policies that bypass tenant isolation
DROP POLICY IF EXISTS "Auth users can manage notas_saida_itens" ON public.notas_saida_itens;
DROP POLICY IF EXISTS "Auth users can manage rastreabilidade_lote_mp" ON public.rastreabilidade_lote_mp;

-- 4) Remove anonymous public read on internal lot tracking tables
DROP POLICY IF EXISTS "Public read for lote_materias_primas" ON public.lote_materias_primas;
DROP POLICY IF EXISTS "Public read for lotes_produto_acabado" ON public.lotes_produto_acabado;

-- 5) Notifications: remove duplicate/overbroad policies; keep strict per-user
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;

DROP POLICY IF EXISTS "notif_sel" ON public.notifications;
DROP POLICY IF EXISTS "notif_upd" ON public.notifications;
DROP POLICY IF EXISTS "notif_del" ON public.notifications;
DROP POLICY IF EXISTS "notif_ins" ON public.notifications;

CREATE POLICY "notif_select_own"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_update_own"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "notif_delete_own"
  ON public.notifications FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "notif_insert_own"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
