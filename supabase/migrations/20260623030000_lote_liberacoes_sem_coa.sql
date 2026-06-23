-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: lote_liberacoes_sem_coa
-- Registra toda liberação de lote feita sem COA validado, com justificativa
-- obrigatória do operador. Faz parte da rastreabilidade GMP/BPF.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lote_liberacoes_sem_coa (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  lote_id         UUID NOT NULL REFERENCES estoque_lotes(id) ON DELETE CASCADE,

  -- Identificação do operador
  usuario_id      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  usuario_nome    TEXT NOT NULL,
  usuario_email   TEXT,

  -- Justificativa obrigatória (mínimo 30 caracteres)
  justificativa   TEXT NOT NULL CHECK (char_length(justificativa) >= 30),

  -- Contexto do lote no momento da liberação
  status_anterior TEXT NOT NULL DEFAULT 'QUARENTENA',
  coa_presente    BOOLEAN NOT NULL DEFAULT FALSE,   -- havia COA mas sem validação?
  numero_lote     TEXT,
  insumo_nome     TEXT,

  -- Metadados de auditoria
  ip_address      TEXT,
  user_agent      TEXT,
  hash_sha256     TEXT,   -- Preenchido automaticamente pelo trigger abaixo

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lote_lib_sem_coa_lote     ON lote_liberacoes_sem_coa(lote_id);
CREATE INDEX IF NOT EXISTS idx_lote_lib_sem_coa_company  ON lote_liberacoes_sem_coa(company_id);
CREATE INDEX IF NOT EXISTS idx_lote_lib_sem_coa_created  ON lote_liberacoes_sem_coa(created_at DESC);

-- RLS
ALTER TABLE lote_liberacoes_sem_coa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_liberacoes" ON lote_liberacoes_sem_coa
  FOR SELECT USING (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "tenant_insert_liberacoes" ON lote_liberacoes_sem_coa
  FOR INSERT WITH CHECK (company_id = (SELECT company_id FROM profiles WHERE id = auth.uid()));

-- Comentários para documentação
COMMENT ON TABLE lote_liberacoes_sem_coa IS
  'Registra toda liberação de lote de insumo feita sem COA validado. '
  'Justificativa obrigatória (≥30 chars). Hash SHA-256 garante imutabilidade. '
  'Base legal: RDC 275/2002 Art. 3 (BPF alimentos), RDC 243/2018 Art. 12.';

COMMENT ON COLUMN lote_liberacoes_sem_coa.hash_sha256 IS
  'Hash SHA-256 calculado automaticamente sobre id+lote_id+usuario+justificativa+timestamp. '
  'Qualquer alteração posterior invalida o hash — trilha imutável de auditoria.';

-- ─── Trigger: calcula hash SHA-256 no INSERT ─────────────────────────────────
CREATE OR REPLACE FUNCTION fn_lote_lib_hash()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.hash_sha256 := encode(
    sha256((NEW.id::text || NEW.lote_id::text || NEW.usuario_nome || NEW.justificativa || NEW.created_at::text)::bytea),
    'hex'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_lote_lib_hash
  BEFORE INSERT ON lote_liberacoes_sem_coa
  FOR EACH ROW EXECUTE FUNCTION fn_lote_lib_hash();
