ALTER TABLE public.orcamentos 
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS vendedor_nome TEXT;