-- Criar tabela sensores para monitoramento de temperatura e umidade
CREATE TABLE IF NOT EXISTS public.sensores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id VARCHAR(50) NOT NULL,
  nome_dispositivo VARCHAR(255),
  nome_sala VARCHAR(255),
  temperatura_minima DECIMAL(5,2),
  temperatura_maxima DECIMAL(5,2),
  umidade_minima DECIMAL(5,2),
  umidade_maxima DECIMAL(5,2),
  responsavel VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, device_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS idx_sensores_company_id ON public.sensores(company_id);
CREATE INDEX IF NOT EXISTS idx_sensores_device_id ON public.sensores(device_id);

-- Habilitar RLS
ALTER TABLE public.sensores ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
CREATE POLICY "sensores_company_isolation" ON public.sensores
  FOR ALL
  USING (company_id = auth.uid());

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensores TO anon;
