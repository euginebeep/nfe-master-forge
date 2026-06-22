-- ============================================================
-- MIGRATION CONSOLIDADA — Execução idempotente de todas as
-- migrations pendentes (pode ser re-executada sem erros)
-- ============================================================

-- ============================================================
-- 1. erp_system_config (configurações globais de IA — nível SaaS)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.erp_system_config (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chave       TEXT NOT NULL UNIQUE,
  valor       TEXT,
  descricao   TEXT,
  categoria   TEXT NOT NULL DEFAULT 'ia',
  ativo       BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_erp_system_config_chave ON public.erp_system_config(chave);

ALTER TABLE public.erp_system_config ENABLE ROW LEVEL SECURITY;

-- Remover policies antigas (idempotente)
DROP POLICY IF EXISTS "super_admin_full_access"  ON public.erp_system_config;
DROP POLICY IF EXISTS "saas_owner_full_access"   ON public.erp_system_config;

-- Policy correta: apenas saas_owner via user_roles
CREATE POLICY "saas_owner_full_access" ON public.erp_system_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'saas_owner'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'saas_owner'
    )
  );

GRANT SELECT, INSERT, UPDATE ON public.erp_system_config TO service_role;

-- Inserir valores padrão (sem sobrescrever existentes)
INSERT INTO public.erp_system_config (chave, descricao, categoria, valor) VALUES
  ('gemini_api_key',    'Chave da API Google Gemini — módulo BrainX ANVISA e assistente de IA', 'ia',         NULL),
  ('firecrawl_api_key', 'Chave da API Firecrawl — sincronização automática ANVISA',             'integracao', NULL)
ON CONFLICT (chave) DO NOTHING;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_erp_system_config_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_erp_system_config_updated_at ON public.erp_system_config;
CREATE TRIGGER trg_erp_system_config_updated_at
  BEFORE UPDATE ON public.erp_system_config
  FOR EACH ROW EXECUTE FUNCTION public.set_erp_system_config_updated_at();

-- ============================================================
-- 2. ANVISA Laudo — logos e snapshot RT
-- ============================================================
ALTER TABLE public.anvisa_laudos
  ADD COLUMN IF NOT EXISTS logo_empresa_url   TEXT,
  ADD COLUMN IF NOT EXISTS logo_rt_url        TEXT,
  ADD COLUMN IF NOT EXISTS rt_nome            TEXT,
  ADD COLUMN IF NOT EXISTS rt_crf             TEXT,
  ADD COLUMN IF NOT EXISTS rt_estado          TEXT,
  ADD COLUMN IF NOT EXISTS rt_snapshot_at     TIMESTAMPTZ;

-- Bucket para logos dos laudos
INSERT INTO storage.buckets (id, name, public)
VALUES ('anvisa-laudo-logos', 'anvisa-laudo-logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Authenticated can upload laudo logos"  ON storage.objects;
DROP POLICY IF EXISTS "Public can view laudo logos"           ON storage.objects;

CREATE POLICY "Authenticated can upload laudo logos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'anvisa-laudo-logos');

CREATE POLICY "Public can view laudo logos"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'anvisa-laudo-logos');

-- ============================================================
-- 3. Monitoramento Ambiental — coluna sala e colunas OAuth
-- ============================================================
ALTER TABLE public.ambiental_sensores
  ADD COLUMN IF NOT EXISTS sala TEXT;

-- Sincronizar sala com room_name para registros existentes
UPDATE public.ambiental_sensores
  SET sala = room_name
  WHERE sala IS NULL AND room_name IS NOT NULL;

ALTER TABLE public.ambiental_sensores
  ALTER COLUMN sala SET DEFAULT '';

ALTER TABLE public.ambiental_config
  ADD COLUMN IF NOT EXISTS ewelink_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS ewelink_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ultima_sync           TIMESTAMPTZ;

ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS device_id TEXT;

CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_id
  ON public.sensor_readings (company_id, device_id, recorded_at DESC);
