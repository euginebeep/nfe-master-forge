ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS numero_serie text;
COMMENT ON COLUMN public.equipamentos.numero_serie IS 'Número de série do equipamento para rastreabilidade e calibração';