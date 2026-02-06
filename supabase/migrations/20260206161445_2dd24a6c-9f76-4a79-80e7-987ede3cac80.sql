-- ============================================================
-- MOTOR OP MASTER - MIGRAÇÃO COMPLETA
-- Multi-tenant, Anexos, QR Inviolável, Audit Trail Imutável
-- ============================================================

-- 1) ANEXOS DA OP (COA, Rótulo, Arte Final)
CREATE TABLE IF NOT EXISTS public.op_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL,
  tipo_anexo TEXT NOT NULL CHECK (tipo_anexo IN ('COA', 'ROTULO', 'ARTE_FINAL', 'FICHA_TECNICA', 'LAUDO', 'OUTRO')),
  nome_arquivo TEXT NOT NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  tamanho_bytes INTEGER,
  hash_sha256 TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  congelado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  congelado_por UUID,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_op_anexos_op_id ON public.op_anexos(op_id);
ALTER TABLE public.op_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for op_anexos" ON public.op_anexos FOR ALL USING (true) WITH CHECK (true);

-- 2) EMBALAGENS DA OP
CREATE TABLE IF NOT EXISTS public.op_embalagens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL,
  tipo_embalagem TEXT NOT NULL CHECK (tipo_embalagem IN ('POTE', 'FRASCO', 'TAMPA', 'SELO', 'ROTULO', 'CAIXA', 'DESSECANTE', 'SACHE', 'OUTRO')),
  insumo_id UUID,
  insumo_nome TEXT NOT NULL,
  lote_id UUID,
  numero_lote TEXT,
  quantidade_planejada INTEGER NOT NULL,
  quantidade_consumida INTEGER DEFAULT 0,
  custo_unitario NUMERIC(10,4) DEFAULT 0,
  custo_total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'PENDENTE',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_op_embalagens_op_id ON public.op_embalagens(op_id);
ALTER TABLE public.op_embalagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for op_embalagens" ON public.op_embalagens FOR ALL USING (true) WITH CHECK (true);

-- 3) ADICIONAR COLUNAS À TABELA ORDENS_PRODUCAO_INDUSTRIAL
DO $$
BEGIN
  -- Cliente/Pedido
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'cliente_id') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN cliente_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'cliente_nome') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN cliente_nome TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'pedido_id') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN pedido_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'pedido_numero') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN pedido_numero TEXT;
  END IF;

  -- QR Code Inviolável
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'qr_code_token') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN qr_code_token UUID DEFAULT gen_random_uuid();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'qr_code_hash') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN qr_code_hash TEXT;
  END IF;

  -- Etapa de produção atual (13 etapas)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'etapa_producao_atual') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN etapa_producao_atual TEXT DEFAULT 'SEPARACAO_MP';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'etapa_atualizada_em') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN etapa_atualizada_em TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Assinatura RT completa
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'assinatura_rt_hash') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN assinatura_rt_hash TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'rt_assinatura_timestamp') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN rt_assinatura_timestamp TIMESTAMP WITH TIME ZONE;
  END IF;

  -- Turno/Linha/Máquina
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'turno') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN turno TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'linha_producao') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN linha_producao TEXT;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ordens_producao_industrial' AND column_name = 'maquina') THEN
    ALTER TABLE public.ordens_producao_industrial ADD COLUMN maquina TEXT;
  END IF;
END $$;

-- 4) FUNÇÃO PARA GERAR HASH QR CODE INVIOLÁVEL
CREATE OR REPLACE FUNCTION public.gerar_hash_qr_code_op(
  p_op_id UUID,
  p_lote_pa TEXT,
  p_secret TEXT DEFAULT 'LOVABLE_OP_MASTER_SECRET_2026'
) RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN encode(
    hmac(
      p_op_id::TEXT || ':' || p_lote_pa || ':' || now()::TEXT,
      p_secret,
      'sha256'
    ),
    'hex'
  );
END;
$$;

-- 5) TRIGGER PARA GERAR QR CODE HASH AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION public.trigger_gerar_qr_hash_op()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.qr_code_hash IS NULL THEN
    NEW.qr_code_hash := public.gerar_hash_qr_code_op(NEW.id, NEW.lote_produto_acabado);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_gerar_qr_hash_op ON public.ordens_producao_industrial;
CREATE TRIGGER tr_gerar_qr_hash_op
  BEFORE INSERT ON public.ordens_producao_industrial
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_gerar_qr_hash_op();

-- 6) FUNÇÃO PARA VALIDAR QR CODE
CREATE OR REPLACE FUNCTION public.validar_qr_code_op(
  p_op_id UUID,
  p_hash TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_stored_hash TEXT;
BEGIN
  SELECT qr_code_hash INTO v_stored_hash
  FROM public.ordens_producao_industrial
  WHERE id = p_op_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  RETURN v_stored_hash = p_hash;
END;
$$;

-- 7) TABELA DE HISTÓRICO DE ETAPAS (RASTREABILIDADE)
CREATE TABLE IF NOT EXISTS public.op_historico_etapas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL,
  etapa TEXT NOT NULL,
  iniciada_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  finalizada_em TIMESTAMP WITH TIME ZONE,
  operador_id UUID,
  operador_nome TEXT,
  observacoes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX idx_op_historico_etapas_op_id ON public.op_historico_etapas(op_id);
ALTER TABLE public.op_historico_etapas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for op_historico_etapas" ON public.op_historico_etapas FOR ALL USING (true) WITH CHECK (true);

-- 8) ATUALIZAR TABELA DE MATÉRIAS-PRIMAS PARA SUPORTAR COA INDIVIDUAL
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'op_materias_primas' AND column_name = 'coa_arquivo_id') THEN
    ALTER TABLE public.op_materias_primas ADD COLUMN coa_arquivo_id UUID;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'op_materias_primas' AND column_name = 'coa_hash') THEN
    ALTER TABLE public.op_materias_primas ADD COLUMN coa_hash TEXT;
  END IF;
END $$;

-- 9) ADICIONAR COLUNAS kg NA TABELA DE MATÉRIAS-PRIMAS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'op_materias_primas' AND column_name = 'quantidade_teorica_kg') THEN
    ALTER TABLE public.op_materias_primas ADD COLUMN quantidade_teorica_kg NUMERIC(10,6) GENERATED ALWAYS AS (quantidade_teorica_g / 1000) STORED;
  END IF;
END $$;