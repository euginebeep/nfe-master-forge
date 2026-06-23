-- ============================================================
-- Migration: Tornar base de legislação GLOBAL (sem company_id)
-- legislacao_fontes e legislacao_chunks: sem company_id (global)
-- legislacao_perguntas: mantém company_id (por tenant)
-- legislacao_monitoramento: sem company_id (global)
-- trilhas_estudo: sem company_id (global)
-- ============================================================

-- 1. Remover company_id das tabelas globais (se existir)
ALTER TABLE legislacao_fontes DROP COLUMN IF EXISTS company_id;
ALTER TABLE legislacao_chunks DROP COLUMN IF EXISTS company_id;
ALTER TABLE legislacao_monitoramento DROP COLUMN IF EXISTS company_id;
ALTER TABLE trilhas_estudo DROP COLUMN IF EXISTS company_id;

-- 2. Garantir que legislacao_perguntas tem company_id (por tenant)
ALTER TABLE legislacao_perguntas ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES company(id) ON DELETE CASCADE;

-- 3. Atualizar RLS: legislacao_fontes — leitura para todos autenticados, escrita apenas via service_role
-- Dropar todas as políticas existentes nessas tabelas antes de recriar
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename IN ('legislacao_fontes','legislacao_chunks','legislacao_perguntas','trilhas_estudo','legislacao_monitoramento') LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, (SELECT tablename FROM pg_policies WHERE policyname = r.policyname LIMIT 1));
  END LOOP;
END$$;

-- Recriar políticas limpas
CREATE POLICY "fontes_leitura_global"
  ON legislacao_fontes FOR SELECT USING (true);

CREATE POLICY "fontes_escrita_service_role"
  ON legislacao_fontes FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "chunks_leitura_global"
  ON legislacao_chunks FOR SELECT USING (true);

CREATE POLICY "chunks_escrita_service_role"
  ON legislacao_chunks FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "perguntas_por_tenant"
  ON legislacao_perguntas FOR ALL
  USING (company_id IN (SELECT company_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "trilhas_leitura_global"
  ON trilhas_estudo FOR SELECT USING (true);

CREATE POLICY "monitoramento_leitura_global"
  ON legislacao_monitoramento FOR SELECT USING (true);

-- 8. Índice para busca por tenant nas perguntas
CREATE INDEX IF NOT EXISTS idx_legislacao_perguntas_company_id
  ON legislacao_perguntas(company_id);

-- 9. Comentários documentando a arquitetura
COMMENT ON TABLE legislacao_fontes IS 'Base global de normas ANVISA — gerenciada pelo admin SaaS, disponível para todos os tenants. Sem company_id.';
COMMENT ON TABLE legislacao_chunks IS 'Trechos indexados com embeddings — global, sem company_id. Gerados pelo admin SaaS via legislacao-ingest.';
COMMENT ON TABLE legislacao_perguntas IS 'Histórico de consultas ao Copilot — por tenant (company_id obrigatório).';
COMMENT ON TABLE trilhas_estudo IS 'Trilhas de capacitação regulatória — global, sem company_id.';
COMMENT ON TABLE legislacao_monitoramento IS 'Log de monitoramento de mudanças nas fontes — global, sem company_id.';
