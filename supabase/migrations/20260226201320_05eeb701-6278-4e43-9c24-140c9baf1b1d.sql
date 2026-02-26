-- Ajuste de bootstrap para criação da primeira empresa sem bloquear usuários válidos sem role admin
CREATE OR REPLACE FUNCTION public.can_create_company()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (
      -- Se ainda não existe nenhuma empresa no sistema, permite bootstrap inicial
      (SELECT COUNT(*) FROM public.company) = 0
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.company_id IS NULL
    );
$$;