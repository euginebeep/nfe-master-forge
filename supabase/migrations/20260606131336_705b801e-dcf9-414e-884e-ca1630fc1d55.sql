ALTER TABLE public.ordens_producao_industrial 
  ADD COLUMN IF NOT EXISTS temperatura_inicio NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS umidade_inicio INTEGER,
  ADD COLUMN IF NOT EXISTS sala_producao TEXT,
  ADD COLUMN IF NOT EXISTS rendimento_percentual NUMERIC(5,2);

COMMENT ON COLUMN public.ordens_producao_industrial.temperatura_inicio IS 'Temperatura no início da produção (RDC 658/2022)';
COMMENT ON COLUMN public.ordens_producao_industrial.umidade_inicio IS 'Umidade no início da produção (RDC 658/2022)';
COMMENT ON COLUMN public.ordens_producao_industrial.sala_producao IS 'Sala de produção vinculada ao início da OP';
COMMENT ON COLUMN public.ordens_producao_industrial.rendimento_percentual IS 'Rendimento real final da OP';