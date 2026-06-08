-- Adiciona colunas para regime de trabalho e contrato de prestação de serviço
ALTER TABLE public.responsaveis_tecnicos 
ADD COLUMN IF NOT EXISTS regime_trabalho TEXT CHECK (regime_trabalho IN ('CLT', 'PJ')) DEFAULT 'CLT';

ALTER TABLE public.responsaveis_tecnicos 
ADD COLUMN IF NOT EXISTS contrato_prestacao_servico_id UUID REFERENCES public.arquivos(id);

-- Comentários para documentação
COMMENT ON COLUMN public.responsaveis_tecnicos.regime_trabalho IS 'Regime de contratação do responsável técnico: CLT ou PJ';
COMMENT ON COLUMN public.responsaveis_tecnicos.contrato_prestacao_servico_id IS 'ID do arquivo do contrato de prestação de serviço para regime PJ';

-- Garante que o service_role e usuários autenticados tenham acesso às novas colunas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.responsaveis_tecnicos TO authenticated;
GRANT ALL ON public.responsaveis_tecnicos TO service_role;
