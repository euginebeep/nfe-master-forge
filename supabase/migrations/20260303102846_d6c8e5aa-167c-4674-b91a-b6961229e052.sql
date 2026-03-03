
-- Add missing columns to estoque_lotes for full NF-e traceability
ALTER TABLE public.estoque_lotes 
  ADD COLUMN IF NOT EXISTS codigo_agregacao text,
  ADD COLUMN IF NOT EXISTS tipo_potencia text DEFAULT 'NENHUMA',
  ADD COLUMN IF NOT EXISTS potencia_valor numeric,
  ADD COLUMN IF NOT EXISTS potencia_unidade text,
  ADD COLUMN IF NOT EXISTS potencia_observacoes text,
  ADD COLUMN IF NOT EXISTS unidade_interna text;

-- Add comment for documentation
COMMENT ON COLUMN public.estoque_lotes.codigo_agregacao IS 'cAgreg do rastro XML - código de agregação do lote';
COMMENT ON COLUMN public.estoque_lotes.tipo_potencia IS 'Tipo de potência do COA: NENHUMA, PERCENTUAL, UI_POR_GRAMA, MG_POR_GRAMA';
COMMENT ON COLUMN public.estoque_lotes.potencia_valor IS 'Valor numérico da potência (ex: 400000 para 400.000 UI/g)';
COMMENT ON COLUMN public.estoque_lotes.potencia_unidade IS 'Unidade da potência (ex: UI/g, mg/g, %)';
COMMENT ON COLUMN public.estoque_lotes.unidade_interna IS 'Unidade interna do lote após conversão';
