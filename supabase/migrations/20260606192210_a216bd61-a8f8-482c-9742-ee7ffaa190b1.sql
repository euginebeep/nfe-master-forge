CREATE TABLE IF NOT EXISTS public.anvisa_laudos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.company(id) NOT NULL,
  produto TEXT NOT NULL,
  cliente TEXT,
  status_geral TEXT,
  payload_entrada JSONB,
  resultado_ia JSONB,
  criado_em TIMESTAMPTZ DEFAULT now(),
  criado_por UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.anvisa_laudos TO authenticated;
GRANT ALL ON public.anvisa_laudos TO service_role;
ALTER TABLE public.anvisa_laudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "company_isolation" ON public.anvisa_laudos
  FOR ALL
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));