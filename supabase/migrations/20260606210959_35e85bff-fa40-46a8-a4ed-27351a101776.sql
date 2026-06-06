-- Drop existing constraints if they exist to prevent errors during migration
ALTER TABLE public.anvisa_search_log DROP CONSTRAINT IF EXISTS anvisa_search_log_user_id_fkey;
ALTER TABLE public.anvisa_search_log DROP CONSTRAINT IF EXISTS anvisa_search_log_company_id_fkey;

-- We keep the columns but remove strict FKs for high-frequency logs to ensure reliability
-- and because some searches might happen before profile full sync

ALTER TABLE public.anvisa_laudos DROP CONSTRAINT IF EXISTS anvisa_laudos_company_id_fkey;
ALTER TABLE public.anvisa_laudos DROP CONSTRAINT IF EXISTS anvisa_laudos_criado_por_fkey;

-- Ensure RLS is enabled and correct
ALTER TABLE public.anvisa_laudos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anvisa_search_log ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT ALL ON public.anvisa_laudos TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anvisa_laudos TO authenticated;

GRANT ALL ON public.anvisa_search_log TO service_role;
GRANT INSERT ON public.anvisa_search_log TO authenticated;
GRANT INSERT ON public.anvisa_search_log TO anon;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_anvisa_laudos_company_id ON public.anvisa_laudos(company_id);
CREATE INDEX IF NOT EXISTS idx_anvisa_search_log_timestamp ON public.anvisa_search_log(created_at DESC);
