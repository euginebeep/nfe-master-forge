-- ============================================================
-- ENUM: Tipo de Conselho Profissional
-- ============================================================
CREATE TYPE public.tipo_conselho_profissional AS ENUM ('CRN', 'CRQ', 'CRF');

-- ============================================================
-- ENUM: Tipo de Evento de Auditoria
-- ============================================================
CREATE TYPE public.tipo_evento_auditoria AS ENUM (
  'FORMULA_CRIADA',
  'FORMULA_APROVADA',
  'FORMULA_ALTERADA',
  'OP_CRIADA',
  'OP_INICIADA',
  'OP_ALTERADA',
  'OP_FINALIZADA',
  'OP_BLOQUEADA',
  'RT_ASSINATURA',
  'LOTE_LIBERADO',
  'LOTE_BLOQUEADO',
  'QC_APROVADO',
  'QC_REPROVADO',
  'PESAGEM_REGISTRADA',
  'CHECKLIST_VERIFICADO'
);

-- ============================================================
-- TABELA: Responsáveis Técnicos
-- ============================================================
CREATE TABLE public.responsaveis_tecnicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo TEXT NOT NULL,
  cpf TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  telefone TEXT,
  status TEXT NOT NULL DEFAULT 'ATIVO' CHECK (status IN ('ATIVO', 'INATIVO')),
  tipo_conselho tipo_conselho_profissional NOT NULL,
  numero_registro TEXT NOT NULL,
  uf_conselho TEXT NOT NULL CHECK (char_length(uf_conselho) = 2),
  validade_registro DATE NOT NULL,
  documento_comprobatorio_id UUID REFERENCES public.arquivos(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID,
  CONSTRAINT cpf_formato CHECK (char_length(cpf) = 11 OR char_length(cpf) = 14)
);

CREATE TRIGGER update_responsaveis_tecnicos_updated_at
  BEFORE UPDATE ON public.responsaveis_tecnicos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.responsaveis_tecnicos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for responsaveis_tecnicos"
  ON public.responsaveis_tecnicos FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: Assinaturas Digitais de RT em OPs
-- ============================================================
CREATE TABLE public.op_assinaturas_rt (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL,
  responsavel_tecnico_id UUID NOT NULL REFERENCES public.responsaveis_tecnicos(id),
  rt_nome TEXT NOT NULL,
  rt_cpf TEXT NOT NULL,
  rt_tipo_conselho tipo_conselho_profissional NOT NULL,
  rt_numero_registro TEXT NOT NULL,
  rt_uf_conselho TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  hash_op TEXT NOT NULL,
  assinatura_timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  declaracao_aceita BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.op_assinaturas_rt ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for op_assinaturas_rt"
  ON public.op_assinaturas_rt FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- TABELA: Lotes de Produto Acabado
-- ============================================================
CREATE TABLE public.lotes_produto_acabado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  op_id UUID NOT NULL,
  numero_lote TEXT NOT NULL UNIQUE,
  codigo_auditoria TEXT NOT NULL UNIQUE,
  qr_code_hash TEXT NOT NULL UNIQUE,
  produto_id UUID REFERENCES public.itens(id),
  produto_nome TEXT NOT NULL,
  produto_codigo TEXT,
  data_fabricacao DATE NOT NULL,
  data_validade DATE NOT NULL,
  quantidade_produzida INTEGER NOT NULL,
  quantidade_aprovada INTEGER,
  quantidade_rejeitada INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'QUARENTENA' CHECK (status IN ('QUARENTENA', 'APROVADO', 'BLOQUEADO', 'LIBERADO')),
  motivo_bloqueio TEXT,
  responsavel_tecnico_id UUID REFERENCES public.responsaveis_tecnicos(id),
  rt_nome TEXT NOT NULL,
  rt_tipo_conselho tipo_conselho_profissional NOT NULL,
  rt_numero_registro TEXT NOT NULL,
  rt_uf_conselho TEXT NOT NULL,
  assinatura_liberacao_id UUID REFERENCES public.op_assinaturas_rt(id),
  liberado_em TIMESTAMPTZ,
  liberado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_lotes_produto_acabado_updated_at
  BEFORE UPDATE ON public.lotes_produto_acabado
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.lotes_produto_acabado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for lotes_produto_acabado"
  ON public.lotes_produto_acabado FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read for lotes_produto_acabado"
  ON public.lotes_produto_acabado FOR SELECT TO anon USING (true);

-- ============================================================
-- TABELA: Matérias-primas do Lote
-- ============================================================
CREATE TABLE public.lote_materias_primas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_produto_acabado_id UUID NOT NULL REFERENCES public.lotes_produto_acabado(id),
  insumo_id UUID REFERENCES public.itens(id),
  insumo_nome TEXT NOT NULL,
  insumo_lote TEXT NOT NULL,
  fornecedor_id UUID REFERENCES public.entidades(id),
  fornecedor_nome TEXT NOT NULL,
  quantidade_utilizada_g NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lote_materias_primas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for lote_materias_primas"
  ON public.lote_materias_primas FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Public read for lote_materias_primas"
  ON public.lote_materias_primas FOR SELECT TO anon USING (true);

-- ============================================================
-- TABELA: Trilha de Auditoria Imutável (APPEND-ONLY)
-- ============================================================
CREATE TABLE public.audit_trail_imutavel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_evento tipo_evento_auditoria NOT NULL,
  descricao TEXT NOT NULL,
  entidade_tipo TEXT NOT NULL,
  entidade_id UUID NOT NULL,
  entidade_codigo TEXT,
  usuario_id UUID,
  usuario_nome TEXT,
  ip_address TEXT,
  user_agent TEXT,
  dados_evento JSONB NOT NULL DEFAULT '{}',
  dados_anteriores JSONB,
  dados_novos JSONB,
  hash_anterior TEXT,
  hash_atual TEXT NOT NULL,
  sequencia BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_trail_entidade ON public.audit_trail_imutavel(entidade_tipo, entidade_id);
CREATE INDEX idx_audit_trail_tipo ON public.audit_trail_imutavel(tipo_evento);
CREATE INDEX idx_audit_trail_data ON public.audit_trail_imutavel(created_at DESC);
CREATE INDEX idx_audit_trail_sequencia ON public.audit_trail_imutavel(sequencia);

ALTER TABLE public.audit_trail_imutavel ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Insert only for audit_trail_imutavel"
  ON public.audit_trail_imutavel FOR INSERT WITH CHECK (true);

CREATE POLICY "Read only for audit_trail_imutavel"
  ON public.audit_trail_imutavel FOR SELECT USING (true);

CREATE SEQUENCE public.audit_trail_sequencia START 1;

-- ============================================================
-- FUNÇÃO: Gerar hash SHA-256 para auditoria
-- ============================================================
CREATE OR REPLACE FUNCTION public.gerar_hash_auditoria(dados JSONB)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN encode(digest(dados::TEXT, 'sha256'), 'hex');
END;
$$;

-- ============================================================
-- FUNÇÃO: Registrar evento na trilha de auditoria
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_evento_auditoria(
  p_tipo_evento tipo_evento_auditoria,
  p_descricao TEXT,
  p_entidade_tipo TEXT,
  p_entidade_id UUID,
  p_entidade_codigo TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_usuario_nome TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_dados_evento JSONB DEFAULT '{}',
  p_dados_anteriores JSONB DEFAULT NULL,
  p_dados_novos JSONB DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hash_anterior TEXT;
  v_sequencia BIGINT;
  v_hash_atual TEXT;
  v_novo_id UUID;
  v_dados_completos JSONB;
BEGIN
  SELECT hash_atual, sequencia INTO v_hash_anterior, v_sequencia
  FROM public.audit_trail_imutavel ORDER BY sequencia DESC LIMIT 1;
  
  v_sequencia := COALESCE(v_sequencia, 0) + 1;
  
  v_dados_completos := jsonb_build_object(
    'tipo_evento', p_tipo_evento, 'descricao', p_descricao,
    'entidade_tipo', p_entidade_tipo, 'entidade_id', p_entidade_id,
    'entidade_codigo', p_entidade_codigo, 'usuario_id', p_usuario_id,
    'dados_evento', p_dados_evento, 'hash_anterior', v_hash_anterior,
    'sequencia', v_sequencia, 'timestamp', now()
  );
  
  v_hash_atual := public.gerar_hash_auditoria(v_dados_completos);
  
  INSERT INTO public.audit_trail_imutavel (
    tipo_evento, descricao, entidade_tipo, entidade_id, entidade_codigo,
    usuario_id, usuario_nome, ip_address, user_agent, dados_evento,
    dados_anteriores, dados_novos, hash_anterior, hash_atual, sequencia
  ) VALUES (
    p_tipo_evento, p_descricao, p_entidade_tipo, p_entidade_id, p_entidade_codigo,
    p_usuario_id, p_usuario_nome, p_ip_address, p_user_agent, p_dados_evento,
    p_dados_anteriores, p_dados_novos, v_hash_anterior, v_hash_atual, v_sequencia
  ) RETURNING id INTO v_novo_id;
  
  RETURN v_novo_id;
END;
$$;

-- ============================================================
-- FUNÇÃO: Validar compatibilidade RT x Produto
-- ============================================================
CREATE OR REPLACE FUNCTION public.validar_compatibilidade_rt(
  p_tipo_conselho tipo_conselho_profissional,
  p_tipo_produto TEXT
) RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  CASE p_tipo_produto
    WHEN 'CAPSULA' THEN RETURN p_tipo_conselho IN ('CRF', 'CRQ');
    WHEN 'CRITICO' THEN RETURN p_tipo_conselho IN ('CRQ', 'CRF');
    ELSE RETURN p_tipo_conselho IN ('CRN', 'CRQ', 'CRF');
  END CASE;
END;
$$;

-- ============================================================
-- FUNÇÃO: Verificar se RT está válido para produção
-- ============================================================
CREATE OR REPLACE FUNCTION public.rt_valido_para_producao(p_rt_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE AS $$
DECLARE v_status TEXT; v_validade DATE;
BEGIN
  SELECT status, validade_registro INTO v_status, v_validade
  FROM public.responsaveis_tecnicos WHERE id = p_rt_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  RETURN v_status = 'ATIVO' AND v_validade >= CURRENT_DATE;
END;
$$;

-- ============================================================
-- ADICIONAR CAMPOS RT À TABELA ordens_producao_industrial
-- ============================================================
ALTER TABLE public.ordens_producao_industrial 
ADD COLUMN IF NOT EXISTS responsavel_tecnico_id UUID REFERENCES public.responsaveis_tecnicos(id),
ADD COLUMN IF NOT EXISTS rt_nome TEXT,
ADD COLUMN IF NOT EXISTS rt_tipo_conselho tipo_conselho_profissional,
ADD COLUMN IF NOT EXISTS rt_numero_registro TEXT,
ADD COLUMN IF NOT EXISTS rt_uf_conselho TEXT,
ADD COLUMN IF NOT EXISTS rt_vinculado_em TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS assinatura_rt_id UUID REFERENCES public.op_assinaturas_rt(id),
ADD COLUMN IF NOT EXISTS qr_code_lote TEXT;