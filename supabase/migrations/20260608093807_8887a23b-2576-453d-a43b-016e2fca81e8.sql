ALTER TABLE public.company ADD COLUMN IF NOT EXISTS tipo_empresa TEXT;
-- Sugestão de valores: 'farmacia', 'industria', 'distribuidora', 'outro'
