
CREATE TABLE public.contratos_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'INDUSTRIALIZACAO',
  descricao TEXT,
  logo_url TEXT,
  texto_template TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contratos_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for contratos_templates" ON public.contratos_templates
  FOR ALL USING (true) WITH CHECK (true);
