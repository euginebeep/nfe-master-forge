-- Add origem column to estoque_lotes to track seed vs real inventory
-- This prevents demo/seed lots from appearing in production OPs

ALTER TABLE public.estoque_lotes 
  ADD COLUMN IF NOT EXISTS origem TEXT 
    DEFAULT 'NF-E' 
    CHECK (origem IN ('SEED', 'NF-E', 'MANUAL'));

-- Create index for filtering seed lots
CREATE INDEX IF NOT EXISTS idx_estoque_lotes_origem 
  ON public.estoque_lotes(company_id, origem);

-- Comment for clarity
COMMENT ON COLUMN public.estoque_lotes.origem IS 
  'Origem do lote: SEED (demo), NF-E (importação), MANUAL (lançamento do usuário). Lotes SEED devem ser ignorados em FEFO e preparação de OP.';
