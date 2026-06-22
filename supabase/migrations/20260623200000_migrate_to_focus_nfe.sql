-- ============================================================
-- Migração: Nuvem Fiscal → Focus NFe
-- Data: 2026-06-23
-- Descrição: Adiciona colunas focus_nfe_id na tabela notas_saida,
--            atualiza funções de validação e mantém retrocompatibilidade
-- ============================================================

-- 1. Adicionar coluna focus_nfe_id na tabela notas_saida
ALTER TABLE public.notas_saida
  ADD COLUMN IF NOT EXISTS focus_nfe_id TEXT;

-- 2. Migrar dados existentes: copiar nuvem_fiscal_id para focus_nfe_id
UPDATE public.notas_saida
  SET focus_nfe_id = nuvem_fiscal_id
  WHERE nuvem_fiscal_id IS NOT NULL
    AND focus_nfe_id IS NULL;

-- 3. Criar índice para busca rápida por focus_nfe_id
CREATE INDEX IF NOT EXISTS idx_notas_saida_focus_nfe_id
  ON public.notas_saida (focus_nfe_id)
  WHERE focus_nfe_id IS NOT NULL;

-- 4. Criar função de validação de acesso por focus_nfe_id
--    (equivalente à validar_acesso_nota_saida que usava nuvem_fiscal_id)
CREATE OR REPLACE FUNCTION public.validar_acesso_nota_saida_focus(p_focus_nfe_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.notas_saida n
    JOIN public.profiles p ON p.company_id = n.company_id
    WHERE (n.focus_nfe_id = p_focus_nfe_id OR n.nuvem_fiscal_id = p_focus_nfe_id)
      AND p.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.validar_acesso_nota_saida_focus(TEXT) TO authenticated;

-- 5. Manter a função antiga para retrocompatibilidade (notas antigas com nuvem_fiscal_id)
--    A função validar_acesso_nota_saida já existe e continua funcionando

-- 6. Adicionar coluna focus_nfe_id na tabela companies para rastrear cadastro na Focus NFe
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS focus_nfe_empresa_id TEXT,
  ADD COLUMN IF NOT EXISTS focus_nfe_status TEXT DEFAULT 'nao_cadastrado';

-- 7. Migrar dados de nuvem_fiscal_id para focus_nfe_empresa_id nas companies
UPDATE public.companies
  SET focus_nfe_empresa_id = nuvem_fiscal_id,
      focus_nfe_status = CASE
        WHEN nuvem_fiscal_status = 'ativo' THEN 'ativo'
        WHEN nuvem_fiscal_status IS NOT NULL THEN nuvem_fiscal_status
        ELSE 'nao_cadastrado'
      END
  WHERE nuvem_fiscal_id IS NOT NULL
    AND focus_nfe_empresa_id IS NULL;

-- 8. Comentários de documentação
COMMENT ON COLUMN public.notas_saida.focus_nfe_id IS
  'ID de referência (ref) da nota na Focus NFe. Substitui nuvem_fiscal_id.';

COMMENT ON COLUMN public.notas_saida.nuvem_fiscal_id IS
  'DEPRECATED: ID da nota na Nuvem Fiscal. Mantido para retrocompatibilidade. Use focus_nfe_id.';

COMMENT ON COLUMN public.companies.focus_nfe_empresa_id IS
  'CNPJ/CPF da empresa cadastrada na Focus NFe. Substitui nuvem_fiscal_id nas companies.';

COMMENT ON COLUMN public.companies.focus_nfe_status IS
  'Status do cadastro da empresa na Focus NFe: nao_cadastrado, ativo, erro.';
