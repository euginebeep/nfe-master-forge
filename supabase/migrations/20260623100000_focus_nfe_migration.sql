-- Migration: Migrar colunas da Nuvem Fiscal para Focus NFe na tabela company

-- 1. Adicionar novas colunas para Focus NFe
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS focus_nfe_empresa_id TEXT,
  ADD COLUMN IF NOT EXISTS focus_nfe_status TEXT;

-- 2. Atualizar função de validação de acesso
CREATE OR REPLACE FUNCTION public.validar_acesso_nota_saida_focus(p_focus_nfe_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.notas_saida n
    JOIN public.profiles p ON p.company_id = n.company_id
    WHERE n.focus_nfe_id = p_focus_nfe_id
      AND p.id = auth.uid()
  );
$$;

-- 3. Adicionar coluna focus_nfe_id na tabela notas_saida (caso exista nuvem_fiscal_id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notas_saida') THEN
    ALTER TABLE public.notas_saida ADD COLUMN IF NOT EXISTS focus_nfe_id TEXT;
  END IF;
END
$$;
