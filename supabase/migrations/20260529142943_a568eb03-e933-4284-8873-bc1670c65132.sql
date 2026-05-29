
-- TABELA 1: ambiental_config
CREATE TABLE IF NOT EXISTS public.ambiental_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE NOT NULL,
  ewelink_app_id text,
  ewelink_app_secret text,
  ewelink_region text DEFAULT 'eu',
  ewelink_access_token text,
  ewelink_refresh_token text,
  token_expires_at timestamptz,
  ativo boolean DEFAULT false,
  sync_interval_seconds integer DEFAULT 60,
  ultima_sync timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ambiental_config_company_unique UNIQUE (company_id),
  CONSTRAINT ambiental_config_region_check CHECK (ewelink_region IN ('eu','us','as'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_config TO authenticated;
GRANT ALL ON public.ambiental_config TO service_role;

ALTER TABLE public.ambiental_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_ambiental_config" ON public.ambiental_config;
CREATE POLICY "tenant_isolation_ambiental_config"
  ON public.ambiental_config
  FOR ALL
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- TABELA 2: ambiental_sensores
CREATE TABLE IF NOT EXISTS public.ambiental_sensores (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE NOT NULL,
  device_id text NOT NULL,
  device_name text,
  room_name text NOT NULL,
  temp_min numeric(4,1) NOT NULL DEFAULT 18,
  temp_max numeric(4,1) NOT NULL DEFAULT 25,
  hum_min integer NOT NULL DEFAULT 40,
  hum_max integer NOT NULL DEFAULT 60,
  responsible text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ambiental_sensores_device_unique UNIQUE (company_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_sensores TO authenticated;
GRANT ALL ON public.ambiental_sensores TO service_role;

ALTER TABLE public.ambiental_sensores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_ambiental_sensores" ON public.ambiental_sensores;
CREATE POLICY "tenant_isolation_ambiental_sensores"
  ON public.ambiental_sensores
  FOR ALL
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- TABELA 3: sensor_readings
CREATE TABLE IF NOT EXISTS public.sensor_readings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE NOT NULL,
  room_name text NOT NULL,
  device_id text NOT NULL,
  temperature numeric(4,1) NOT NULL,
  humidity integer NOT NULL,
  temp_min numeric(4,1) NOT NULL DEFAULT 18,
  temp_max numeric(4,1) NOT NULL DEFAULT 25,
  hum_min integer NOT NULL DEFAULT 40,
  hum_max integer NOT NULL DEFAULT 60,
  responsible text,
  recorded_at timestamptz DEFAULT now() NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensor_readings TO authenticated;
GRANT ALL ON public.sensor_readings TO service_role;

ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_sensor_readings" ON public.sensor_readings;
CREATE POLICY "tenant_isolation_sensor_readings"
  ON public.sensor_readings
  FOR ALL
  TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_sensor_readings_lookup
  ON public.sensor_readings (company_id, room_name, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_sensor_readings_recent
  ON public.sensor_readings (company_id, recorded_at DESC);

-- Triggers updated_at (usa função existente public.update_updated_at_column)
DROP TRIGGER IF EXISTS update_ambiental_config_updated_at ON public.ambiental_config;
CREATE TRIGGER update_ambiental_config_updated_at
  BEFORE UPDATE ON public.ambiental_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_ambiental_sensores_updated_at ON public.ambiental_sensores;
CREATE TRIGGER update_ambiental_sensores_updated_at
  BEFORE UPDATE ON public.ambiental_sensores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
