-- =====================================================
-- FIX: Corrigir bloqueio de assinatura para o dono do SaaS
-- 
-- Problema: O usuário fabiobr9999@gmail.com está sendo bloqueado
-- pela tela "Período de teste expirado" mesmo sendo o dono do SaaS.
--
-- Solução 1: Garantir que está na saas_super_devs (já feito na migration anterior)
-- Solução 2: Garantir role saas_owner (já feito na migration anterior)
-- Solução 3: Liberar TODAS as empresas vinculadas ao usuário master por 2 anos
-- =====================================================

-- Liberar todas as empresas onde o usuário master é admin por 2 anos
-- Isso cobre o caso do login como tenant (VitalNow)
UPDATE public.company
SET acesso_liberado_ate = NOW() + INTERVAL '2 years'
WHERE id IN (
  SELECT DISTINCT p.company_id
  FROM public.profiles p
  INNER JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.id = (SELECT id FROM auth.users WHERE email = 'fabiobr9999@gmail.com')
    AND ur.role IN ('admin', 'saas_owner')
    AND p.company_id IS NOT NULL
);

-- Também liberar qualquer empresa onde o usuário é o único admin
-- (cobre o caso de empresas criadas pelo master como tenant)
UPDATE public.company
SET acesso_liberado_ate = NOW() + INTERVAL '2 years'
WHERE id IN (
  SELECT DISTINCT p.company_id
  FROM public.profiles p
  WHERE p.id = (SELECT id FROM auth.users WHERE email = 'fabiobr9999@gmail.com')
    AND p.company_id IS NOT NULL
)
AND (acesso_liberado_ate IS NULL OR acesso_liberado_ate < NOW());

-- Garantir que o role saas_owner está presente (idempotente)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'saas_owner'::app_role
FROM auth.users
WHERE email = 'fabiobr9999@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Garantir que está na saas_super_devs (idempotente)
INSERT INTO public.saas_super_devs (user_id, notes)
SELECT id, 'Fundador — acesso master irrestrito'
FROM auth.users
WHERE email = 'fabiobr9999@gmail.com'
ON CONFLICT (user_id) DO UPDATE SET notes = 'Fundador — acesso master irrestrito';
