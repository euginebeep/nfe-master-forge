
-- Estoque Movimentações
CREATE TABLE IF NOT EXISTS estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL DEFAULT 'ENTRADA',
  item_id UUID NOT NULL REFERENCES itens(id),
  lote_id UUID REFERENCES estoque_lotes(id),
  quantidade DECIMAL NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'g',
  custo_unitario DECIMAL,
  motivo TEXT NOT NULL,
  documento_ref TEXT,
  documento_ref_id UUID,
  origem TEXT DEFAULT 'MANUAL',
  usuario_id UUID,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mov_item ON estoque_movimentacoes(item_id);
CREATE INDEX IF NOT EXISTS idx_mov_lote ON estoque_movimentacoes(lote_id);
CREATE INDEX IF NOT EXISTS idx_mov_data ON estoque_movimentacoes(created_at DESC);

ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage estoque_movimentacoes" ON estoque_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- QC Análises
CREATE TABLE IF NOT EXISTS qc_analises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id UUID NOT NULL REFERENCES estoque_lotes(id),
  tipo_analise TEXT NOT NULL DEFAULT 'FISICO_QUIMICO',
  parametro TEXT NOT NULL,
  especificacao TEXT NOT NULL,
  resultado TEXT,
  status TEXT DEFAULT 'PENDENTE',
  analista_id UUID,
  data_analise TIMESTAMPTZ,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE qc_analises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage qc_analises" ON qc_analises FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- QC Desvios
CREATE TABLE IF NOT EXISTS qc_desvios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'DESVIO',
  severidade TEXT NOT NULL DEFAULT 'MENOR',
  descricao TEXT NOT NULL,
  causa_raiz TEXT,
  acao_corretiva TEXT,
  acao_preventiva TEXT,
  responsavel_id UUID,
  status TEXT DEFAULT 'ABERTO',
  prazo DATE,
  lote_id UUID REFERENCES estoque_lotes(id),
  op_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE qc_desvios ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage qc_desvios" ON qc_desvios FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- QC Calibrações
CREATE TABLE IF NOT EXISTS qc_calibracoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento TEXT NOT NULL,
  codigo_equipamento TEXT NOT NULL,
  tipo_calibracao TEXT NOT NULL,
  data_calibracao DATE NOT NULL,
  proxima_calibracao DATE NOT NULL,
  certificado_url TEXT,
  status TEXT DEFAULT 'VIGENTE',
  responsavel TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE qc_calibracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage qc_calibracoes" ON qc_calibracoes FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Contas a Receber
CREATE TABLE IF NOT EXISTS contas_receber (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES entidades(id),
  pedido_venda_id UUID,
  numero_documento TEXT,
  descricao TEXT NOT NULL,
  valor DECIMAL NOT NULL,
  valor_pago DECIMAL DEFAULT 0,
  data_emissao DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status TEXT DEFAULT 'PENDENTE',
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage contas_receber" ON contas_receber FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Notas Fiscais de Saída
CREATE TABLE IF NOT EXISTS notas_saida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INTEGER,
  serie TEXT DEFAULT '1',
  chave_acesso TEXT,
  natureza_operacao TEXT DEFAULT 'VENDA',
  cliente_id UUID NOT NULL REFERENCES entidades(id),
  pedido_venda_id UUID,
  valor_total DECIMAL NOT NULL DEFAULT 0,
  valor_icms DECIMAL DEFAULT 0,
  valor_pis DECIMAL DEFAULT 0,
  valor_cofins DECIMAL DEFAULT 0,
  valor_ipi DECIMAL DEFAULT 0,
  status TEXT DEFAULT 'RASCUNHO',
  xml_autorizado TEXT,
  protocolo_autorizacao TEXT,
  data_emissao TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notas_saida ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage notas_saida" ON notas_saida FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Itens da Nota de Saída
CREATE TABLE IF NOT EXISTS notas_saida_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_saida_id UUID REFERENCES notas_saida(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES itens(id),
  lote_id UUID REFERENCES estoque_lotes(id),
  descricao TEXT NOT NULL,
  ncm TEXT,
  cfop TEXT,
  unidade TEXT,
  quantidade DECIMAL NOT NULL,
  valor_unitario DECIMAL NOT NULL,
  valor_total DECIMAL NOT NULL,
  icms_aliquota DECIMAL DEFAULT 0,
  icms_valor DECIMAL DEFAULT 0,
  pis_aliquota DECIMAL DEFAULT 0,
  pis_valor DECIMAL DEFAULT 0,
  cofins_aliquota DECIMAL DEFAULT 0,
  cofins_valor DECIMAL DEFAULT 0
);

ALTER TABLE notas_saida_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage notas_saida_itens" ON notas_saida_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Catálogo de Preços
CREATE TABLE IF NOT EXISTS catalogo_precos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES itens(id),
  preco_venda DECIMAL NOT NULL,
  preco_minimo DECIMAL,
  margem_contribuicao DECIMAL,
  vigencia_inicio DATE DEFAULT CURRENT_DATE,
  vigencia_fim DATE,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE catalogo_precos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage catalogo_precos" ON catalogo_precos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Rastreabilidade: Lote Produto Acabado → Matérias-Primas
CREATE TABLE IF NOT EXISTS rastreabilidade_lote_mp (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_produto_acabado_id UUID NOT NULL REFERENCES lotes_produto_acabado(id),
  op_id UUID NOT NULL,
  lote_mp_id UUID NOT NULL REFERENCES estoque_lotes(id),
  item_mp_id UUID NOT NULL REFERENCES itens(id),
  quantidade_utilizada DECIMAL NOT NULL,
  unidade TEXT NOT NULL DEFAULT 'g',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rastreabilidade_lote ON rastreabilidade_lote_mp(lote_produto_acabado_id);
CREATE INDEX IF NOT EXISTS idx_rastreabilidade_mp ON rastreabilidade_lote_mp(lote_mp_id);

ALTER TABLE rastreabilidade_lote_mp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users can manage rastreabilidade_lote_mp" ON rastreabilidade_lote_mp FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE estoque_movimentacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE qc_desvios;
