CREATE TABLE public.sensor_readings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE,
  room_name text NOT NULL,
  device_id text NOT NULL,
  temperature numeric(4,1),
  humidity integer,
  temp_min numeric(4,1),
  temp_max numeric(4,1),
  hum_min integer,
  hum_max integer,
  responsible text,
  recorded_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sensor_readings TO authenticated;
GRANT ALL ON public.sensor_readings TO service_role;

ALTER TABLE public.sensor_readings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.sensor_readings
  FOR ALL
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

CREATE INDEX idx_sensor_readings_company_room ON public.sensor_readings(company_id, room_name, recorded_at DESC);