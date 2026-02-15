
-- Add nome_rotulo column for label display
ALTER TABLE public.anvisa_constituintes ADD COLUMN IF NOT EXISTS nome_rotulo text;

-- Update search vector trigger to include nome_popular, sinonimos arrays
CREATE OR REPLACE FUNCTION public.anvisa_search_vector_update()
RETURNS TRIGGER AS $$
DECLARE
  popular_text text := '';
  sinonimos_text text := '';
BEGIN
  -- Convert arrays to searchable text
  IF NEW.nome_popular IS NOT NULL THEN
    popular_text := array_to_string(NEW.nome_popular, ' ');
  END IF;
  IF NEW.sinonimos IS NOT NULL THEN
    sinonimos_text := array_to_string(NEW.sinonimos, ' ');
  END IF;

  NEW.search_vector :=
    setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.nome_tecnico, ''))), 'A') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.nome_generico, ''))), 'A') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.nome_rotulo, ''))), 'A') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(popular_text, ''))), 'B') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(sinonimos_text, ''))), 'B') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.categoria, ''))), 'C') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.subcategoria, ''))), 'C') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.fonte_de, ''))), 'D') ||
    setweight(to_tsvector('portuguese', unaccent(coalesce(NEW.cas_number, ''))), 'D');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Rebuild search vectors for existing data
UPDATE public.anvisa_constituintes SET updated_at = now();
