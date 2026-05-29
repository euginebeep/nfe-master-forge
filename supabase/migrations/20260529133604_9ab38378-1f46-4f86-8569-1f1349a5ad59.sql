-- Configuração eWeLink por empresa
CREATE TABLE public.ambiental_config (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE NOT NULL UNIQUE,
  ewelink_app_id text,
  ewelink_app_secret text,
  ewelink_region text DEFAULT 'eu' CHECK (ewelink_region IN ('eu','us','as')),
  ewelink_access_token text,
  ewelink_refresh_token text,
  token_expires_at timestamptz,
  ativo boolean DEFAULT false,
  sync_interval_seconds integer DEFAULT 60,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_config TO authenticated;
GRANT ALL ON public.ambiental_config TO service_role;

ALTER TABLE public.ambiental_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_ambiental_config"
  ON public.ambiental_config
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );

-- Mapeamento dispositivo → sala por empresa
CREATE TABLE public.ambiental_sensores (
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
  UNIQUE(company_id, device_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ambiental_sensores TO authenticated;
GRANT ALL ON public.ambiental_sensores TO service_role;

ALTER TABLE public.ambiental_sensores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_ambiental_sensores"
  ON public.ambiental_sensores
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
  );
