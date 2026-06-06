ALTER TABLE formulas 
ADD COLUMN IF NOT EXISTS peso_enchimento_mg numeric DEFAULT 500,
ADD COLUMN IF NOT EXISTS densidade_aparente_kg_l numeric DEFAULT 0.65;

GRANT ALL ON public.formulas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.formulas TO authenticated;