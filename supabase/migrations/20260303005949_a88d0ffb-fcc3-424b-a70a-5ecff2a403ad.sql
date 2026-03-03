-- Drop the global unique constraint on documento (breaks multi-tenant)
ALTER TABLE public.entidades DROP CONSTRAINT IF EXISTS entidades_documento_key;

-- The per-tenant unique constraint uq_entidades_documento_company already exists, so no need to create it again
