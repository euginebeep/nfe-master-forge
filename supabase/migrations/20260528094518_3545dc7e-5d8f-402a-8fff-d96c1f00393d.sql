CREATE TABLE public.anvisa_search_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID,
  user_id UUID,
  termo TEXT NOT NULL,
  origem TEXT NOT NULL DEFAULT 'powerbi_anvisa',
  encontrou_match BOOLEAN NOT NULL DEFAULT false,
  total_resultados INTEGER NOT NULL DEFAULT 0,
  usou_ia BOOLEAN NOT NULL DEFAULT false,
  duracao_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.anvisa_search_log TO authenticated;
GRANT ALL ON public.anvisa_search_log TO service_role;

ALTER TABLE public.anvisa_search_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins veem todos os logs"
ON public.anvisa_search_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role insere logs"
ON public.anvisa_search_log FOR INSERT
TO service_role
WITH CHECK (true);

CREATE INDEX idx_anvisa_search_log_created ON public.anvisa_search_log(created_at DESC);
CREATE INDEX idx_anvisa_search_log_company ON public.anvisa_search_log(company_id, created_at DESC);