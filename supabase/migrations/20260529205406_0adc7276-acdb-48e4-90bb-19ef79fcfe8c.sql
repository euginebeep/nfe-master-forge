
-- 1. Add is_demo flags
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_company_is_demo ON public.company(is_demo) WHERE is_demo = true;

-- 2. Helper function used by edge-functions / triggers to check if a company is the demo tenant
CREATE OR REPLACE FUNCTION public.is_demo_company(_cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_demo FROM public.company WHERE id = _cid), false)
$$;

-- 3. Bootstrap the fixed Demo Company (idempotent via ON CONFLICT)
INSERT INTO public.company (
  id, razao_social, nome_fantasia, cnpj, ie,
  endereco_logradouro, endereco_nro, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep, endereco_pais,
  email_financeiro, email_fiscal, telefone, site,
  nfe_ambiente, regime_tributario, crt,
  is_demo
) VALUES (
  '00000000-0000-0000-0000-000000000001'::uuid,
  'Demo BrainX — Suplementos Modelo Ltda',
  'BrainX Demo',
  '00000000000100',
  'ISENTO',
  'Av. Paulista', '1000', 'Bela Vista', 'São Paulo', 'SP', '01310100', 'Brasil',
  'demo@brainxerp.com', 'demo@brainxerp.com', '(11) 4002-8922', 'https://www.brainxerp.com',
  'HOMOLOGACAO', 'SIMPLES_NACIONAL', '1',
  true
)
ON CONFLICT (id) DO UPDATE SET
  is_demo = true,
  razao_social = EXCLUDED.razao_social,
  nome_fantasia = EXCLUDED.nome_fantasia;
