
-- ============ CRM: oportunidades / interacoes / vendedores externos / tabela precos / pedidos vendedor ============

-- VENDEDORES EXTERNOS
CREATE TABLE IF NOT EXISTS public.vendedores_externos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cpf text,
  telefone text,
  email text,
  territorio text,
  comissao_percent numeric NOT NULL DEFAULT 7.5,
  meta_mensal numeric NOT NULL DEFAULT 0,
  desconto_maximo_percent numeric NOT NULL DEFAULT 10,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedores_externos TO authenticated;
GRANT ALL ON public.vendedores_externos TO service_role;
ALTER TABLE public.vendedores_externos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendedores_externos_tenant_all" ON public.vendedores_externos
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());
CREATE TRIGGER trg_vendedores_externos_updated_at BEFORE UPDATE ON public.vendedores_externos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- VENDEDOR TABELA PRECOS
CREATE TABLE IF NOT EXISTS public.vendedor_tabela_precos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.vendedores_externos(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  preco_minimo numeric NOT NULL DEFAULT 0,
  preco_sugerido numeric NOT NULL DEFAULT 0,
  quantidade_minima integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendedor_tabela_precos TO authenticated;
GRANT ALL ON public.vendedor_tabela_precos TO service_role;
ALTER TABLE public.vendedor_tabela_precos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendedor_tabela_precos_tenant_all" ON public.vendedor_tabela_precos
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());
CREATE TRIGGER trg_vendedor_tabela_precos_updated_at BEFORE UPDATE ON public.vendedor_tabela_precos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- OPORTUNIDADES
CREATE TABLE IF NOT EXISTS public.oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  entidade_id uuid REFERENCES public.entidades(id) ON DELETE SET NULL,
  empresa text NOT NULL,
  contato_nome text,
  telefone text,
  email text,
  cidade text,
  estado text,
  origem text,
  vendedor_id uuid REFERENCES public.vendedores_externos(id) ON DELETE SET NULL,
  produtos_interesse text,
  valor_estimado numeric DEFAULT 0,
  score integer NOT NULL DEFAULT 50,
  status text NOT NULL DEFAULT 'LEAD' CHECK (status IN ('LEAD','CONTATO','PROPOSTA','NEGOCIACAO','FECHADO','PERDIDO')),
  observacoes text,
  arquivado boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.oportunidades TO authenticated;
GRANT ALL ON public.oportunidades TO service_role;
ALTER TABLE public.oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "oportunidades_tenant_all" ON public.oportunidades
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());
CREATE INDEX IF NOT EXISTS idx_oportunidades_company_status ON public.oportunidades(company_id, status);
CREATE TRIGGER trg_oportunidades_updated_at BEFORE UPDATE ON public.oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CRM INTERACOES
CREATE TABLE IF NOT EXISTS public.crm_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  oportunidade_id uuid NOT NULL REFERENCES public.oportunidades(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('LIGACAO','EMAIL','REUNIAO','WHATSAPP','VISITA','OUTRO')),
  descricao text,
  criado_por text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_interacoes TO authenticated;
GRANT ALL ON public.crm_interacoes TO service_role;
ALTER TABLE public.crm_interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "crm_interacoes_tenant_all" ON public.crm_interacoes
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());
CREATE INDEX IF NOT EXISTS idx_crm_interacoes_oportunidade ON public.crm_interacoes(oportunidade_id, created_at DESC);

-- PEDIDOS VENDEDOR
CREATE TABLE IF NOT EXISTS public.pedidos_vendedor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  numero text,
  vendedor_id uuid REFERENCES public.vendedores_externos(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.oportunidades(id) ON DELETE SET NULL,
  cliente_id uuid REFERENCES public.entidades(id) ON DELETE SET NULL,
  cliente_nome text,
  valor_total numeric NOT NULL DEFAULT 0,
  comissao_percent numeric NOT NULL DEFAULT 0,
  valor_comissao numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'NOVO' CHECK (status IN ('NOVO','EM_PRODUCAO','FATURADO','ENTREGUE','CANCELADO')),
  comissao_paga boolean NOT NULL DEFAULT false,
  data_pagamento_comissao timestamptz,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos_vendedor TO authenticated;
GRANT ALL ON public.pedidos_vendedor TO service_role;
ALTER TABLE public.pedidos_vendedor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pedidos_vendedor_tenant_all" ON public.pedidos_vendedor
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());
CREATE INDEX IF NOT EXISTS idx_pedidos_vendedor_company ON public.pedidos_vendedor(company_id, vendedor_id, status);
CREATE TRIGGER trg_pedidos_vendedor_updated_at BEFORE UPDATE ON public.pedidos_vendedor
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
