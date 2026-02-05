-- Add new columns to entidades table
ALTER TABLE public.entidades 
ADD COLUMN IF NOT EXISTS codigo_interno TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS contribuinte_icms TEXT DEFAULT 'NAO_INFORMADO',
ADD COLUMN IF NOT EXISTS site TEXT;

-- Create sequence for codigo_interno
CREATE SEQUENCE IF NOT EXISTS entidades_codigo_seq START 1;

-- Function to generate codigo_interno
CREATE OR REPLACE FUNCTION public.generate_entidade_codigo()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.codigo_interno IS NULL OR NEW.codigo_interno = '' THEN
    NEW.codigo_interno := 'ENT-' || LPAD(nextval('entidades_codigo_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for codigo_interno
DROP TRIGGER IF EXISTS trg_generate_entidade_codigo ON public.entidades;
CREATE TRIGGER trg_generate_entidade_codigo
BEFORE INSERT ON public.entidades
FOR EACH ROW
EXECUTE FUNCTION public.generate_entidade_codigo();

-- Create entidade_fiscal_config table
CREATE TABLE IF NOT EXISTS public.entidade_fiscal_config (
  entidade_id UUID PRIMARY KEY REFERENCES public.entidades(id) ON DELETE CASCADE,
  natureza_operacao_padrao TEXT,
  cfop_padrao_entrada TEXT,
  cfop_padrao_saida TEXT,
  cst_icms_padrao TEXT,
  cst_pis_padrao TEXT,
  cst_cofins_padrao TEXT,
  observacao_fiscal_padrao TEXT,
  bloquear_sem_cpf_cnpj_valido BOOLEAN DEFAULT true,
  bloquear_sem_ie_quando_exigido BOOLEAN DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.entidade_fiscal_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for entidade_fiscal_config" ON public.entidade_fiscal_config FOR ALL USING (true) WITH CHECK (true);

-- Create entidade_financeiro_config table
CREATE TABLE IF NOT EXISTS public.entidade_financeiro_config (
  entidade_id UUID PRIMARY KEY REFERENCES public.entidades(id) ON DELETE CASCADE,
  condicao_pagamento_padrao TEXT,
  forma_pagamento_padrao TEXT DEFAULT 'PIX',
  limite_credito NUMERIC(14,2) DEFAULT 0,
  bloquear_inadimplencia BOOLEAN DEFAULT false,
  dias_tolerancia INTEGER DEFAULT 0,
  categoria_financeira_padrao TEXT,
  centro_custo_padrao TEXT,
  email_nfe TEXT,
  email_boleto TEXT,
  importar_duplicatas_xml_gera_contas_pagar BOOLEAN DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.entidade_financeiro_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for entidade_financeiro_config" ON public.entidade_financeiro_config FOR ALL USING (true) WITH CHECK (true);

-- Create entidade_comercial_crm table
CREATE TABLE IF NOT EXISTS public.entidade_comercial_crm (
  entidade_id UUID PRIMARY KEY REFERENCES public.entidades(id) ON DELETE CASCADE,
  origem_lead TEXT DEFAULT 'ORGANICO',
  responsavel_usuario_id UUID,
  etapa_funil TEXT DEFAULT 'LEAD',
  score INTEGER DEFAULT 0,
  tabela_preco_padrao TEXT,
  canal_preferido TEXT DEFAULT 'WHATSAPP',
  desconto_maximo_percent NUMERIC(5,2) DEFAULT 0,
  comissao_padrao_percent NUMERIC(5,2) DEFAULT 0,
  observacoes_comerciais TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.entidade_comercial_crm ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for entidade_comercial_crm" ON public.entidade_comercial_crm FOR ALL USING (true) WITH CHECK (true);

-- Create entidade_logistica_config table
CREATE TABLE IF NOT EXISTS public.entidade_logistica_config (
  entidade_id UUID PRIMARY KEY REFERENCES public.entidades(id) ON DELETE CASCADE,
  frete_padrao TEXT DEFAULT 'CIF',
  janela_recebimento TEXT,
  observacoes_entrega TEXT,
  transportadora_preferencial_entidade_id UUID REFERENCES public.entidades(id),
  prazo_medio_entrega_dias INTEGER,
  pedido_minimo NUMERIC(14,3),
  lead_time_dias INTEGER,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.entidade_logistica_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for entidade_logistica_config" ON public.entidade_logistica_config FOR ALL USING (true) WITH CHECK (true);

-- Create entidade_documentos table
CREATE TABLE IF NOT EXISTS public.entidade_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  tipo TEXT DEFAULT 'OUTRO',
  nome_arquivo TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes INTEGER,
  storage_key TEXT NOT NULL,
  hash_arquivo TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.entidade_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for entidade_documentos" ON public.entidade_documentos FOR ALL USING (true) WITH CHECK (true);

-- Add new columns to entidade_contatos
ALTER TABLE public.entidade_contatos
ADD COLUMN IF NOT EXISTS departamento TEXT DEFAULT 'OUTRO',
ADD COLUMN IF NOT EXISTS preferencia_contato TEXT DEFAULT 'INDIFERENTE';

-- Add new columns to entidade_enderecos
ALTER TABLE public.entidade_enderecos
ADD COLUMN IF NOT EXISTS referencia TEXT,
ADD COLUMN IF NOT EXISTS contato_local_nome TEXT,
ADD COLUMN IF NOT EXISTS contato_local_fone TEXT,
ADD COLUMN IF NOT EXISTS principal BOOLEAN DEFAULT false;

-- Add new columns to entidade_papeis for expanded roles
-- The existing table already supports: FORNECEDOR, CLIENTE, TRANSPORTADORA, AFILIADO, VENDEDOR, OUTRO
-- We just need to ensure TERCEIRIZADO and REPRESENTANTE are also valid (they're stored as text)

-- Create trigger for updated_at on new tables
CREATE TRIGGER update_entidade_fiscal_config_updated_at
BEFORE UPDATE ON public.entidade_fiscal_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entidade_financeiro_config_updated_at
BEFORE UPDATE ON public.entidade_financeiro_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entidade_comercial_crm_updated_at
BEFORE UPDATE ON public.entidade_comercial_crm
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entidade_logistica_config_updated_at
BEFORE UPDATE ON public.entidade_logistica_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();