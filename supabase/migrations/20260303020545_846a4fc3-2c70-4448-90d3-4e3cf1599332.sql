
-- Tabela contas_pagar para gestão de duplicatas e contas geradas por NF-e
CREATE TABLE public.contas_pagar (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL DEFAULT public.get_user_company_id() REFERENCES public.company(id),
  nota_entrada_id UUID REFERENCES public.notas_entrada(id) ON DELETE SET NULL,
  duplicata_id TEXT,
  fornecedor_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  
  descricao TEXT NOT NULL,
  numero_parcela INTEGER NOT NULL DEFAULT 1,
  total_parcelas INTEGER NOT NULL DEFAULT 1,
  
  valor NUMERIC(15,2) NOT NULL,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  valor_pago NUMERIC(15,2),
  
  forma_pagamento TEXT,
  conta_bancaria TEXT,
  categoria TEXT,
  centro_custo TEXT,
  
  status TEXT NOT NULL DEFAULT 'ABERTO',
  observacoes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.contas_pagar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation contas_pagar SELECT"
  ON public.contas_pagar FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Tenant isolation contas_pagar INSERT"
  ON public.contas_pagar FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "Tenant isolation contas_pagar UPDATE"
  ON public.contas_pagar FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "Tenant isolation contas_pagar DELETE"
  ON public.contas_pagar FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id());

-- Trigger updated_at
CREATE TRIGGER update_contas_pagar_updated_at
  BEFORE UPDATE ON public.contas_pagar
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices
CREATE INDEX idx_contas_pagar_company ON public.contas_pagar(company_id);
CREATE INDEX idx_contas_pagar_fornecedor ON public.contas_pagar(fornecedor_id);
CREATE INDEX idx_contas_pagar_status ON public.contas_pagar(status);
CREATE INDEX idx_contas_pagar_vencimento ON public.contas_pagar(data_vencimento);
