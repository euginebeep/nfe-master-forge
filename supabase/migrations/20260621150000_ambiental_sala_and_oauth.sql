-- Migration: adiciona coluna 'sala' à ambiental_sensores (alias de room_name para o frontend)
-- e garante que ambiental_config tem todas as colunas OAuth necessárias

-- 1. Adicionar coluna 'sala' como alias gerado de room_name (ou coluna independente)
ALTER TABLE public.ambiental_sensores
  ADD COLUMN IF NOT EXISTS sala text;

-- Sincronizar sala com room_name para registros existentes
UPDATE public.ambiental_sensores
  SET sala = room_name
  WHERE sala IS NULL AND room_name IS NOT NULL;

-- Tornar sala NOT NULL com default igual ao device_name
ALTER TABLE public.ambiental_sensores
  ALTER COLUMN sala SET DEFAULT '';

-- 2. Garantir que ambiental_config tem todas as colunas OAuth (já existem, mas garantir)
ALTER TABLE public.ambiental_config
  ADD COLUMN IF NOT EXISTS ewelink_access_token text,
  ADD COLUMN IF NOT EXISTS ewelink_refresh_token text,
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS ultima_sync timestamptz;

-- 3. Garantir que sensor_readings tem device_id (para rastrear por dispositivo)
ALTER TABLE public.sensor_readings
  ADD COLUMN IF NOT EXISTS device_id text;

-- Índice para busca por device_id
CREATE INDEX IF NOT EXISTS idx_sensor_readings_device_id
  ON public.sensor_readings (company_id, device_id, recorded_at DESC);
