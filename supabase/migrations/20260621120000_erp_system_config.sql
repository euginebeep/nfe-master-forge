-- ============================================================
-- erp_system_config: Configurações globais do ERP (nível sistema)
-- Gerenciadas pelo Super Admin — valem para TODOS os tenants
-- ============================================================

CREATE TABLE IF NOT EXISTS public.erp_system_config (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave       TEXT NOT NULL UNIQUE,          -- ex: 'gemini_api_key', 'firecrawl_api_key'
  valor       TEXT,                          -- valor da configuração (criptografado no app)
  descricao   TEXT,                          -- descrição legível para o admin
  categoria   TEXT NOT NULL DEFAULT 'ia',    -- 'ia' | 'integracao' | 'sistema'
  ativo       BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id)
);

-- Índice para busca por chave
CREATE INDEX IF NOT EXISTS idx_erp_system_config_chave ON public.erp_system_config(chave);

-- RLS: somente super_admin pode ler e escrever
ALTER TABLE public.erp_system_config ENABLE ROW LEVEL SECURITY;

-- Super admin pode tudo
CREATE POLICY "super_admin_full_access" ON public.erp_system_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin', 'admin_master')
    )
  );

-- Edge Functions (service role) podem ler — para buscar as chaves em runtime
-- (service role bypassa RLS automaticamente)

-- Inserir valores padrão (vazios — admin deve preencher pelo painel)
INSERT INTO public.erp_system_config (chave, descricao, categoria, valor) VALUES
  ('gemini_api_key',    'Chave da API Google Gemini — módulo BrainX ANVISA e assistente de IA', 'ia',          NULL),
  ('firecrawl_api_key', 'Chave da API Firecrawl — sincronização automática ANVISA',              'integracao',  NULL)
ON CONFLICT (chave) DO NOTHING;

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.set_erp_system_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_erp_system_config_updated_at
  BEFORE UPDATE ON public.erp_system_config
  FOR EACH ROW EXECUTE FUNCTION public.set_erp_system_config_updated_at();
