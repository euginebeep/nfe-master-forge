-- ============================================================
-- MÓDULO DE VENDAS: ORÇAMENTOS E PEDIDOS
-- ============================================================

-- Tabela de Orçamentos
CREATE TABLE public.orcamentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  
  -- Cliente
  cliente_id UUID REFERENCES public.entidades(id),
  cliente_nome TEXT NOT NULL,
  cliente_documento TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  
  -- Valores
  valor_total NUMERIC NOT NULL DEFAULT 0,
  desconto_percentual NUMERIC DEFAULT 0,
  desconto_valor NUMERIC DEFAULT 0,
  valor_final NUMERIC NOT NULL DEFAULT 0,
  
  -- Datas
  data_orcamento DATE NOT NULL DEFAULT CURRENT_DATE,
  validade_dias INTEGER DEFAULT 30,
  data_validade DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'ENVIADO', 'APROVADO', 'RECUSADO', 'CONVERTIDO', 'EXPIRADO')),
  
  -- Observações
  observacoes TEXT,
  condicao_pagamento TEXT,
  prazo_entrega_dias INTEGER,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  aprovado_por UUID,
  aprovado_em TIMESTAMPTZ
);

-- Itens do Orçamento
CREATE TABLE public.orcamento_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  orcamento_id UUID NOT NULL REFERENCES public.orcamentos(id) ON DELETE CASCADE,
  
  -- Produto
  produto_id UUID REFERENCES public.itens(id),
  produto_codigo TEXT,
  produto_nome TEXT NOT NULL,
  produto_descricao TEXT,
  
  -- Quantidades
  quantidade INTEGER NOT NULL DEFAULT 1,
  unidade TEXT DEFAULT 'UN',
  
  -- Preços
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  desconto_percentual NUMERIC DEFAULT 0,
  preco_final NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  
  -- Configuração de produção (para OP)
  unidades_por_frasco INTEGER DEFAULT 60,
  peso_unidade_mg NUMERIC DEFAULT 500,
  formula_id UUID REFERENCES public.formulas(id),
  
  -- Ordem
  ordem INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tabela de Pedidos de Venda
CREATE TABLE public.pedidos_venda (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL,
  
  -- Origem
  orcamento_id UUID REFERENCES public.orcamentos(id),
  
  -- Cliente
  cliente_id UUID REFERENCES public.entidades(id),
  cliente_nome TEXT NOT NULL,
  cliente_documento TEXT,
  cliente_email TEXT,
  cliente_telefone TEXT,
  
  -- Endereço de entrega
  endereco_entrega_id UUID REFERENCES public.entidade_enderecos(id),
  endereco_entrega_texto TEXT,
  
  -- Valores
  valor_produtos NUMERIC NOT NULL DEFAULT 0,
  valor_frete NUMERIC DEFAULT 0,
  desconto_percentual NUMERIC DEFAULT 0,
  desconto_valor NUMERIC DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  
  -- Datas
  data_pedido DATE NOT NULL DEFAULT CURRENT_DATE,
  data_entrega_prevista DATE,
  data_entrega_realizada DATE,
  
  -- Status do Pedido
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PENDENTE', 'CONFIRMADO', 'EM_PRODUCAO', 'PRODUZIDO', 'FATURADO', 'ENVIADO', 'ENTREGUE', 'CANCELADO')),
  
  -- Pagamento
  condicao_pagamento TEXT,
  forma_pagamento TEXT,
  
  -- Frete
  frete_tipo TEXT DEFAULT 'CIF',
  transportadora_id UUID REFERENCES public.entidades(id),
  
  -- Observações
  observacoes TEXT,
  observacoes_internas TEXT,
  
  -- Vínculo com OP (quando produzido)
  op_id UUID,
  
  -- Auditoria
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  confirmado_por UUID,
  confirmado_em TIMESTAMPTZ,
  faturado_em TIMESTAMPTZ,
  enviado_em TIMESTAMPTZ
);

-- Itens do Pedido
CREATE TABLE public.pedido_itens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pedido_id UUID NOT NULL REFERENCES public.pedidos_venda(id) ON DELETE CASCADE,
  
  -- Origem
  orcamento_item_id UUID REFERENCES public.orcamento_itens(id),
  
  -- Produto
  produto_id UUID REFERENCES public.itens(id),
  produto_codigo TEXT,
  produto_nome TEXT NOT NULL,
  produto_descricao TEXT,
  
  -- Quantidades
  quantidade INTEGER NOT NULL DEFAULT 1,
  quantidade_produzida INTEGER DEFAULT 0,
  quantidade_faturada INTEGER DEFAULT 0,
  quantidade_entregue INTEGER DEFAULT 0,
  unidade TEXT DEFAULT 'UN',
  
  -- Preços
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  desconto_percentual NUMERIC DEFAULT 0,
  preco_final NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  
  -- Configuração para OP
  unidades_por_frasco INTEGER DEFAULT 60,
  peso_unidade_mg NUMERIC DEFAULT 500,
  formula_id UUID REFERENCES public.formulas(id),
  
  -- Lote do produto acabado (após produção)
  lote_produto_acabado_id UUID REFERENCES public.lotes_produto_acabado(id),
  
  -- Status do item
  status TEXT DEFAULT 'PENDENTE',
  
  -- Ordem
  ordem INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_orcamentos_cliente ON public.orcamentos(cliente_id);
CREATE INDEX idx_orcamentos_status ON public.orcamentos(status);
CREATE INDEX idx_orcamentos_codigo ON public.orcamentos(codigo);
CREATE INDEX idx_pedidos_venda_cliente ON public.pedidos_venda(cliente_id);
CREATE INDEX idx_pedidos_venda_status ON public.pedidos_venda(status);
CREATE INDEX idx_pedidos_venda_codigo ON public.pedidos_venda(codigo);
CREATE INDEX idx_pedidos_venda_orcamento ON public.pedidos_venda(orcamento_id);

-- RLS
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for orcamentos" ON public.orcamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for orcamento_itens" ON public.orcamento_itens FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pedidos_venda" ON public.pedidos_venda FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for pedido_itens" ON public.pedido_itens FOR ALL USING (true) WITH CHECK (true);

-- Função para gerar código de orçamento
CREATE OR REPLACE FUNCTION public.gerar_codigo_orcamento()
RETURNS TEXT AS $$
DECLARE
  ano INTEGER;
  seq INTEGER;
BEGIN
  ano := EXTRACT(YEAR FROM CURRENT_DATE);
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 5 FOR 4) AS INTEGER)), 0) + 1
  INTO seq
  FROM public.orcamentos
  WHERE codigo LIKE 'ORC-' || ano || '-%';
  
  RETURN 'ORC-' || ano || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Função para gerar código de pedido
CREATE OR REPLACE FUNCTION public.gerar_codigo_pedido()
RETURNS TEXT AS $$
DECLARE
  ano INTEGER;
  seq INTEGER;
BEGIN
  ano := EXTRACT(YEAR FROM CURRENT_DATE);
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 5 FOR 4) AS INTEGER)), 0) + 1
  INTO seq
  FROM public.pedidos_venda
  WHERE codigo LIKE 'PED-' || ano || '-%';
  
  RETURN 'PED-' || ano || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;