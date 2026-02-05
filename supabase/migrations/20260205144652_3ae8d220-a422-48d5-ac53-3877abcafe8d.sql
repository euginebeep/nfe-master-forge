-- =============================================
-- LEGACY ERP - MODULE 01: BASE CADASTROS
-- =============================================

-- 1. ARQUIVOS (files storage reference)
CREATE TABLE public.arquivos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_original TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  tamanho BIGINT NOT NULL DEFAULT 0,
  storage_key TEXT NOT NULL,
  checksum_sha256 TEXT,
  sensivel BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. COMPANY (empresa/tenant)
CREATE TABLE public.company (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj TEXT UNIQUE NOT NULL,
  ie TEXT,
  im TEXT,
  cnae TEXT,
  crt TEXT,
  regime_tributario TEXT,
  -- Endereço fiscal
  endereco_logradouro TEXT,
  endereco_nro TEXT,
  endereco_compl TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_uf TEXT,
  endereco_cep TEXT,
  endereco_pais TEXT DEFAULT 'Brasil',
  endereco_cmun TEXT,
  endereco_cpais TEXT DEFAULT '1058',
  -- Contatos
  email_financeiro TEXT,
  email_fiscal TEXT,
  telefone TEXT,
  site TEXT,
  -- Arquivos
  logo_file_id UUID REFERENCES public.arquivos(id),
  certificado_a1_file_id UUID REFERENCES public.arquivos(id),
  certificado_senha_encrypted TEXT,
  -- NF-e Config
  nfe_ambiente TEXT DEFAULT 'HOMOLOGACAO' CHECK (nfe_ambiente IN ('HOMOLOGACAO', 'PRODUCAO')),
  nfe_serie_padrao INTEGER DEFAULT 1,
  nfe_numero_inicial INTEGER DEFAULT 1,
  csc_idtoken TEXT,
  csc_token TEXT,
  regime_apuracao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. ENTIDADES (unified: fornecedor/cliente/transportadora/etc)
CREATE TABLE public.entidades (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_pessoa TEXT NOT NULL DEFAULT 'PJ' CHECK (tipo_pessoa IN ('PJ', 'PF')),
  documento TEXT UNIQUE NOT NULL,
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  ie TEXT,
  im TEXT,
  cnae TEXT,
  crt TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'BLOQUEADO', 'HOMOLOGACAO')),
  classificacao TEXT DEFAULT 'REGULAR' CHECK (classificacao IN ('VIP', 'REGULAR', 'PROBLEMA')),
  score_risco INTEGER DEFAULT 0 CHECK (score_risco >= 0 AND score_risco <= 100),
  limite_credito NUMERIC(15,2) DEFAULT 0,
  prazo_pagamento_padrao_dias INTEGER DEFAULT 30,
  condicao_frete_padrao TEXT DEFAULT 'CIF' CHECK (condicao_frete_padrao IN ('CIF', 'FOB', 'NA')),
  tags JSONB DEFAULT '[]'::jsonb,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. ENTIDADE_PAPEIS (roles for entities)
CREATE TABLE public.entidade_papeis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  papel TEXT NOT NULL CHECK (papel IN ('FORNECEDOR', 'CLIENTE', 'TRANSPORTADORA', 'AFILIADO', 'VENDEDOR', 'OUTRO')),
  dados_especificos JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entidade_id, papel)
);

-- 5. ENTIDADE_CONTATOS
CREATE TABLE public.entidade_contatos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cargo TEXT DEFAULT 'OUTRO' CHECK (cargo IN ('COMPRADOR', 'VENDEDOR', 'FINANCEIRO', 'LOGISTICA', 'QUALIDADE', 'FISCAL', 'OUTRO')),
  whatsapp TEXT,
  telefone TEXT,
  email TEXT,
  preferencial BOOLEAN DEFAULT false,
  aceita_whatsapp BOOLEAN DEFAULT true,
  origem TEXT DEFAULT 'MANUAL' CHECK (origem IN ('MANUAL', 'XML', 'LEAD_ADS', 'IMPORT')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. ENTIDADE_ENDERECOS
CREATE TABLE public.entidade_enderecos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL DEFAULT 'FISCAL' CHECK (tipo IN ('FISCAL', 'ENTREGA', 'COBRANCA')),
  logradouro TEXT,
  nro TEXT,
  compl TEXT,
  bairro TEXT,
  cidade TEXT,
  uf TEXT,
  cep TEXT,
  pais TEXT DEFAULT 'Brasil',
  cmun TEXT,
  cpais TEXT DEFAULT '1058',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. ITENS (master product/material catalog)
CREATE TABLE public.itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku_interno TEXT UNIQUE,
  descricao_interna TEXT NOT NULL,
  descricao_comercial TEXT,
  tipo_item TEXT NOT NULL DEFAULT 'MP' CHECK (tipo_item IN ('MP', 'EMBALAGEM', 'ROTULO', 'TAMPA', 'POTE', 'SILICA', 'CAPSULA_VAZIA', 'PA', 'OUTRO')),
  categoria_operacional TEXT,
  ncm TEXT,
  ean TEXT,
  unidade_interna TEXT NOT NULL DEFAULT 'g',
  controla_lote BOOLEAN NOT NULL DEFAULT true,
  controla_validade BOOLEAN NOT NULL DEFAULT true,
  criticidade TEXT DEFAULT 'NORMAL' CHECK (criticidade IN ('NORMAL', 'ATENCAO', 'CRITICO', 'ULTRA')),
  higroscopico BOOLEAN DEFAULT false,
  armazenamento TEXT DEFAULT 'AMBIENTE' CHECK (armazenamento IN ('AMBIENTE', 'REFRIGERADO', 'PROTEGIDO_LUZ', 'OUTRO')),
  densidade_aparente NUMERIC(10,4),
  unidade_declaracao TEXT,
  unidade_pesagem TEXT,
  fator_conversao NUMERIC(15,6),
  potencia_compra NUMERIC(15,6),
  potencia_rotulo NUMERIC(15,6),
  exige_premix BOOLEAN DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. ITEM_FORNECEDORES (supplier link per item)
CREATE TABLE public.item_fornecedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  fornecedor_id UUID NOT NULL REFERENCES public.entidades(id) ON DELETE CASCADE,
  codigo_fornecedor TEXT,
  descricao_fornecedor TEXT,
  unidade_compra_padrao TEXT DEFAULT 'kg',
  fator_para_unidade_interna NUMERIC(15,6) DEFAULT 1,
  lead_time_dias INTEGER DEFAULT 7,
  moq NUMERIC(15,2) DEFAULT 1,
  fornecedor_preferencial BOOLEAN DEFAULT false,
  preco_referencia NUMERIC(15,4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, fornecedor_id)
);

-- 9. ITEM_ALIAS
CREATE TABLE public.item_alias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES public.entidades(id) ON DELETE SET NULL,
  tipo TEXT DEFAULT 'ALIAS_FORNECEDOR' CHECK (tipo IN ('ALIAS_FORNECEDOR', 'ALIAS_INTERNO', 'ALIAS_MARKETPLACE')),
  texto TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. NOTAS_ENTRADA (NF-e received)
CREATE TABLE public.notas_entrada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave_nfe TEXT UNIQUE NOT NULL,
  fornecedor_id UUID REFERENCES public.entidades(id),
  company_id UUID REFERENCES public.company(id),
  xml_raw TEXT,
  numero TEXT,
  serie TEXT,
  modelo TEXT,
  dh_emissao TIMESTAMPTZ,
  total_produtos NUMERIC(15,2),
  total_nota NUMERIC(15,2),
  status TEXT NOT NULL DEFAULT 'IMPORTADA' CHECK (status IN ('IMPORTADA', 'CONFIRMADA', 'CANCELADA')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. NOTAS_ENTRADA_ITENS
CREATE TABLE public.notas_entrada_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_entrada_id UUID NOT NULL REFERENCES public.notas_entrada(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.itens(id),
  codigo_fornecedor TEXT,
  descricao TEXT,
  ncm TEXT,
  cfop TEXT,
  ean TEXT,
  ucom TEXT,
  qcom NUMERIC(15,4),
  vuncom NUMERIC(15,6),
  vprod NUMERIC(15,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 12. ESTOQUE_LOTES
CREATE TABLE public.estoque_lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.itens(id) ON DELETE CASCADE,
  fornecedor_id UUID REFERENCES public.entidades(id),
  nota_entrada_item_id UUID REFERENCES public.notas_entrada_itens(id),
  numero_lote TEXT NOT NULL,
  data_fab DATE,
  data_val DATE,
  quantidade_original NUMERIC(15,4) NOT NULL,
  unidade_original TEXT NOT NULL,
  quantidade_interna NUMERIC(15,4) NOT NULL,
  custo_unitario_original NUMERIC(15,6),
  custo_unitario_interno NUMERIC(15,6),
  status TEXT NOT NULL DEFAULT 'QUARENTENA' CHECK (status IN ('QUARENTENA', 'DISPONIVEL', 'BLOQUEADO', 'VENCIDO')),
  observacoes_qc TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. LOTE_DOCUMENTOS (COA/laudos attached to lots)
CREATE TABLE public.lote_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES public.estoque_lotes(id) ON DELETE CASCADE,
  tipo_documento TEXT NOT NULL DEFAULT 'COA' CHECK (tipo_documento IN ('COA', 'FISPQ', 'CERTIFICADO', 'OUTRO')),
  arquivo_id UUID REFERENCES public.arquivos(id),
  hash_arquivo TEXT,
  versao INTEGER DEFAULT 1,
  data_emissao DATE,
  status_validacao TEXT DEFAULT 'PENDENTE' CHECK (status_validacao IN ('PENDENTE', 'VALIDADO', 'REJEITADO')),
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 14. AUDIT_LOG
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade TEXT NOT NULL,
  entidade_id UUID,
  acao TEXT NOT NULL,
  payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- TRIGGERS FOR updated_at
-- =============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_company_updated_at
  BEFORE UPDATE ON public.company
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_entidades_updated_at
  BEFORE UPDATE ON public.entidades
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_itens_updated_at
  BEFORE UPDATE ON public.itens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- AUTO-GENERATE SKU FOR ITEMS
-- =============================================
CREATE OR REPLACE FUNCTION public.generate_sku()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku_interno IS NULL OR NEW.sku_interno = '' THEN
    NEW.sku_interno := UPPER(LEFT(NEW.tipo_item, 2)) || '-' || 
                       TO_CHAR(now(), 'YYMM') || '-' ||
                       LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER generate_item_sku
  BEFORE INSERT ON public.itens
  FOR EACH ROW EXECUTE FUNCTION public.generate_sku();

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_entidades_documento ON public.entidades(documento);
CREATE INDEX idx_entidades_status ON public.entidades(status);
CREATE INDEX idx_itens_sku ON public.itens(sku_interno);
CREATE INDEX idx_itens_ean ON public.itens(ean);
CREATE INDEX idx_itens_ncm ON public.itens(ncm);
CREATE INDEX idx_itens_tipo ON public.itens(tipo_item);
CREATE INDEX idx_estoque_lotes_item ON public.estoque_lotes(item_id);
CREATE INDEX idx_estoque_lotes_status ON public.estoque_lotes(status);
CREATE INDEX idx_notas_entrada_chave ON public.notas_entrada(chave_nfe);
CREATE INDEX idx_item_fornecedores_codigo ON public.item_fornecedores(codigo_fornecedor);

-- =============================================
-- RLS POLICIES (Admin default - no auth yet)
-- =============================================
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidades ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_alias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_entrada_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estoque_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- For Module 01 (no RBAC yet), allow all operations (admin default)
CREATE POLICY "Allow all for arquivos" ON public.arquivos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for company" ON public.company FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for entidades" ON public.entidades FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for entidade_papeis" ON public.entidade_papeis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for entidade_contatos" ON public.entidade_contatos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for entidade_enderecos" ON public.entidade_enderecos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for itens" ON public.itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for item_fornecedores" ON public.item_fornecedores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for item_alias" ON public.item_alias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for notas_entrada" ON public.notas_entrada FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for notas_entrada_itens" ON public.notas_entrada_itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for estoque_lotes" ON public.estoque_lotes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for lote_documentos" ON public.lote_documentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for audit_log" ON public.audit_log FOR ALL USING (true) WITH CHECK (true);

-- =============================================
-- STORAGE BUCKET FOR FILES
-- =============================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'erp-files',
  'erp-files',
  false,
  52428800,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'application/x-pkcs12']
);

CREATE POLICY "Allow all uploads to erp-files" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'erp-files');

CREATE POLICY "Allow all reads from erp-files" ON storage.objects
  FOR SELECT USING (bucket_id = 'erp-files');

CREATE POLICY "Allow all updates to erp-files" ON storage.objects
  FOR UPDATE USING (bucket_id = 'erp-files');

CREATE POLICY "Allow all deletes from erp-files" ON storage.objects
  FOR DELETE USING (bucket_id = 'erp-files');