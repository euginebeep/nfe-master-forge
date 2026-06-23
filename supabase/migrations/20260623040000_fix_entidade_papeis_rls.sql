-- ============================================================
-- Migração: Corrigir RLS recursivo em entidade_papeis e entidade_contatos
-- Data: 2026-06-23
-- Problema: O RLS de entidade_papeis usava entidade_belongs_to_tenant()
--           que faz subquery em entidades, causando recursão quando o
--           Supabase executa o join entidades → entidade_papeis.
--           Resultado: entidade_papeis retornava array vazio no join,
--           fazendo o filtro por papel eliminar todos os registros.
-- Solução: Adicionar company_id diretamente nas tabelas filhas e
--          usar RLS direto por company_id sem subquery recursiva.
-- ============================================================

-- 1. Adicionar company_id em entidade_papeis
ALTER TABLE public.entidade_papeis
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 2. Popular company_id em entidade_papeis a partir da tabela entidades
UPDATE public.entidade_papeis ep
SET company_id = e.company_id
FROM public.entidades e
WHERE ep.entidade_id = e.id
  AND ep.company_id IS NULL;

-- 3. Adicionar company_id em entidade_contatos
ALTER TABLE public.entidade_contatos
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- 4. Popular company_id em entidade_contatos a partir da tabela entidades
UPDATE public.entidade_contatos ec
SET company_id = e.company_id
FROM public.entidades e
WHERE ec.entidade_id = e.id
  AND ec.company_id IS NULL;

-- 5. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_entidade_papeis_company_id
  ON public.entidade_papeis (company_id);

CREATE INDEX IF NOT EXISTS idx_entidade_contatos_company_id
  ON public.entidade_contatos (company_id);

-- 6. Substituir a policy recursiva de entidade_papeis por RLS direto
DROP POLICY IF EXISTS "t_entidade_papeis" ON public.entidade_papeis;
CREATE POLICY "t_entidade_papeis" ON public.entidade_papeis
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 7. Substituir a policy recursiva de entidade_contatos por RLS direto
DROP POLICY IF EXISTS "t_entidade_contatos" ON public.entidade_contatos;
CREATE POLICY "t_entidade_contatos" ON public.entidade_contatos
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 8. Criar função trigger para propagar company_id automaticamente
CREATE OR REPLACE FUNCTION public.set_entidade_child_company_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.company_id IS NULL THEN
    SELECT company_id INTO NEW.company_id
    FROM public.entidades
    WHERE id = NEW.entidade_id;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. Trigger em entidade_papeis
DROP TRIGGER IF EXISTS trg_entidade_papeis_company_id ON public.entidade_papeis;
CREATE TRIGGER trg_entidade_papeis_company_id
  BEFORE INSERT OR UPDATE ON public.entidade_papeis
  FOR EACH ROW EXECUTE FUNCTION public.set_entidade_child_company_id();

-- 10. Trigger em entidade_contatos
DROP TRIGGER IF EXISTS trg_entidade_contatos_company_id ON public.entidade_contatos;
CREATE TRIGGER trg_entidade_contatos_company_id
  BEFORE INSERT OR UPDATE ON public.entidade_contatos
  FOR EACH ROW EXECUTE FUNCTION public.set_entidade_child_company_id();
