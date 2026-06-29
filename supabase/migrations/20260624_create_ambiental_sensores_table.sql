-- Criar tabela ambiental_sensores para armazenar configurações de sensores IoT
CREATE TABLE IF NOT EXISTS public.ambiental_sensores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  device_id VARCHAR(50) NOT NULL,
  device_name VARCHAR(255),
  sala VARCHAR(255) NOT NULL,
  room_name VARCHAR(255),
  temp_min DECIMAL(5,2) NOT NULL DEFAULT 18,
  temp_max DECIMAL(5,2) NOT NULL DEFAULT 25,
  hum_min DECIMAL(5,2) NOT NULL DEFAULT 40,
  hum_max DECIMAL(5,2) NOT NULL DEFAULT 60,
  responsible VARCHAR(255),
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, device_id)
);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_ambiental_sensores_company_id ON public.ambiental_sensores(company_id);
CREATE INDEX IF NOT EXISTS idx_ambiental_sensores_device_id ON public.ambiental_sensores(device_id);
CREATE INDEX IF NOT EXISTS idx_ambiental_sensores_sala ON public.ambiental_sensores(sala);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.ambiental_sensores ENABLE ROW LEVEL SECURITY;

-- Política de isolamento por tenant
CREATE POLICY "ambiental_sensores_company_isolation" ON public.ambiental_sensores
  FOR ALL
  USING (company_id = (SELECT company_id FROM auth.users WHERE id = auth.uid()));

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_sensores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_sensores TO anon;
