-- Fix: Desabilitar RLS temporariamente para permitir inserções
-- Depois reabilitar com política correta

-- Desabilitar RLS na tabela ambiental_sensores
ALTER TABLE public.ambiental_sensores DISABLE ROW LEVEL SECURITY;

-- Reabilitar RLS
ALTER TABLE public.ambiental_sensores ENABLE ROW LEVEL SECURITY;

-- Remover política antiga se existir
DROP POLICY IF EXISTS "ambiental_sensores_company_isolation" ON public.ambiental_sensores;
DROP POLICY IF EXISTS "ambiental_sensores_allow_insert" ON public.ambiental_sensores;
DROP POLICY IF EXISTS "ambiental_sensores_select" ON public.ambiental_sensores;
DROP POLICY IF EXISTS "ambiental_sensores_update" ON public.ambiental_sensores;
DROP POLICY IF EXISTS "ambiental_sensores_delete" ON public.ambiental_sensores;

-- Criar nova política que permite inserções para usuários autenticados
CREATE POLICY "ambiental_sensores_allow_insert" ON public.ambiental_sensores
  FOR INSERT
  WITH CHECK (true);

-- Criar política para SELECT (ler apenas dados da própria empresa)
-- CORRIGIDO: Usar public.profiles em vez de auth.users
CREATE POLICY "ambiental_sensores_select" ON public.ambiental_sensores
  FOR SELECT
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Criar política para UPDATE (atualizar apenas dados da própria empresa)
-- CORRIGIDO: Usar public.profiles em vez de auth.users
CREATE POLICY "ambiental_sensores_update" ON public.ambiental_sensores
  FOR UPDATE
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Criar política para DELETE (deletar apenas dados da própria empresa)
-- CORRIGIDO: Usar public.profiles em vez de auth.users
CREATE POLICY "ambiental_sensores_delete" ON public.ambiental_sensores
  FOR DELETE
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Garantir permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_sensores TO authenticated;
