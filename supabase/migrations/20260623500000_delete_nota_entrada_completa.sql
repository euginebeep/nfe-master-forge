-- ============================================================================
-- MIGRATION: Função para excluir NF-e com reversão completa de estoque
-- Funcionalidade: Excluir nota, itens, estoque, histórico e registrar auditoria
-- ============================================================================

-- 1. Criar tabela de auditoria de exclusões
CREATE TABLE IF NOT EXISTS auditoria_exclusoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES empresas(id),
  tipo_documento TEXT NOT NULL, -- 'NOTA_ENTRADA', 'ITEM', etc
  documento_id UUID,
  documento_numero TEXT,
  documento_serie TEXT,
  dados_excluidos JSONB, -- Snapshot dos dados antes da exclusão
  motivo TEXT,
  usuario_id UUID REFERENCES auth.users(id),
  ip_address INET,
  criado_em TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT auditoria_exclusoes_company_id_fkey FOREIGN KEY (company_id) REFERENCES empresas(id)
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_auditoria_exclusoes_company_id ON auditoria_exclusoes(company_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_exclusoes_tipo_documento ON auditoria_exclusoes(tipo_documento);
CREATE INDEX IF NOT EXISTS idx_auditoria_exclusoes_criado_em ON auditoria_exclusoes(criado_em DESC);

-- RLS para auditoria
ALTER TABLE auditoria_exclusoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários podem ver auditoria de sua empresa" ON auditoria_exclusoes
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM entidade_papeis 
      WHERE usuario_id = auth.uid()
    )
  );

-- 2. Criar função para excluir nota de entrada completa
CREATE OR REPLACE FUNCTION delete_nota_entrada_completa(
  p_nota_id UUID
)
RETURNS TABLE (
  sucesso BOOLEAN,
  mensagem TEXT,
  itens_deletados INTEGER,
  estoque_revertido NUMERIC
) AS $$
DECLARE
  v_company_id UUID;
  v_nota_numero TEXT;
  v_nota_serie TEXT;
  v_itens_count INTEGER := 0;
  v_estoque_total NUMERIC := 0;
  v_nota_data RECORD;
BEGIN
  -- 1. Validar que a nota existe e obter dados
  SELECT 
    ne.id,
    ne.nfe_numero,
    ne.nfe_serie,
    ne.company_id,
    ne.data_emissao,
    COUNT(nei.id) as total_itens
  INTO v_nota_data
  FROM nota_entrada ne
  LEFT JOIN nota_entrada_itens nei ON nei.nota_entrada_id = ne.id
  WHERE ne.id = p_nota_id
  GROUP BY ne.id, ne.nfe_numero, ne.nfe_serie, ne.company_id, ne.data_emissao;

  IF v_nota_data IS NULL THEN
    RETURN QUERY SELECT false, 'Nota de entrada não encontrada', 0, 0;
    RETURN;
  END IF;

  v_company_id := v_nota_data.company_id;
  v_nota_numero := v_nota_data.nfe_numero;
  v_nota_serie := v_nota_data.nfe_serie;
  v_itens_count := v_nota_data.total_itens;

  -- 2. Registrar snapshot na auditoria ANTES de deletar
  INSERT INTO auditoria_exclusoes (
    company_id,
    tipo_documento,
    documento_id,
    documento_numero,
    documento_serie,
    dados_excluidos,
    motivo,
    usuario_id,
    criado_em
  )
  SELECT 
    v_company_id,
    'NOTA_ENTRADA',
    ne.id,
    ne.nfe_numero,
    ne.nfe_serie,
    ROW_TO_JSON(ne.*),
    'Exclusão manual via interface',
    auth.uid(),
    NOW()
  FROM nota_entrada ne
  WHERE ne.id = p_nota_id;

  -- 3. Reverter estoque para cada item
  WITH itens_para_reverter AS (
    SELECT 
      nei.id,
      nei.item_id,
      nei.quantidade_interna,
      li.id as local_item_id
    FROM nota_entrada_itens nei
    LEFT JOIN local_itens li ON li.id = nei.item_id
    WHERE nei.nota_entrada_id = p_nota_id
      AND nei.item_id IS NOT NULL
  )
  UPDATE local_itens li
  SET 
    quantidade_em_estoque = COALESCE(quantidade_em_estoque, 0) - 
      COALESCE((
        SELECT SUM(quantidade_interna) 
        FROM itens_para_reverter 
        WHERE local_item_id = li.id
      ), 0),
    atualizado_em = NOW()
  FROM itens_para_reverter
  WHERE li.id = itens_para_reverter.local_item_id;

  -- 4. Calcular total de estoque revertido
  SELECT COALESCE(SUM(quantidade_interna), 0)
  INTO v_estoque_total
  FROM nota_entrada_itens
  WHERE nota_entrada_id = p_nota_id;

  -- 5. Registrar movimentação de reversão de estoque
  INSERT INTO movimentacao_estoque (
    id,
    company_id,
    local_item_id,
    tipo_movimentacao,
    quantidade,
    quantidade_anterior,
    quantidade_nova,
    motivo,
    referencia_documento,
    referencia_numero,
    criado_em,
    atualizado_em
  )
  SELECT 
    gen_random_uuid(),
    v_company_id,
    nei.item_id,
    'SAIDA',
    ABS(nei.quantidade_interna),
    COALESCE(li.quantidade_em_estoque, 0) + nei.quantidade_interna,
    COALESCE(li.quantidade_em_estoque, 0),
    CONCAT('Reversão: Exclusão de NF-e ', v_nota_numero, '/', v_nota_serie),
    'NOTA_ENTRADA',
    v_nota_numero,
    NOW(),
    NOW()
  FROM nota_entrada_itens nei
  LEFT JOIN local_itens li ON li.id = nei.item_id
  WHERE nei.nota_entrada_id = p_nota_id
    AND nei.item_id IS NOT NULL;

  -- 6. Deletar histórico de fator de conversão
  DELETE FROM fator_conversao_historico
  WHERE 
    nfe_numero = v_nota_numero
    AND nfe_serie = v_nota_serie
    AND company_id = v_company_id;

  -- 7. Deletar desvios de conversão
  DELETE FROM fator_conversao_desvios
  WHERE 
    company_id = v_company_id
    AND criado_em >= v_nota_data.data_emissao - INTERVAL '1 day'
    AND criado_em <= v_nota_data.data_emissao + INTERVAL '1 day';

  -- 8. Deletar itens da nota
  DELETE FROM nota_entrada_itens
  WHERE nota_entrada_id = p_nota_id;

  -- 9. Deletar a nota
  DELETE FROM nota_entrada
  WHERE id = p_nota_id;

  -- 10. Registrar sucesso na auditoria
  INSERT INTO auditoria_exclusoes (
    company_id,
    tipo_documento,
    documento_numero,
    documento_serie,
    dados_excluidos,
    motivo,
    usuario_id,
    criado_em
  )
  VALUES (
    v_company_id,
    'NOTA_ENTRADA_DELETADA',
    v_nota_numero,
    v_nota_serie,
    JSONB_BUILD_OBJECT(
      'itens_deletados', v_itens_count,
      'estoque_revertido', v_estoque_total,
      'deletado_em', NOW()
    ),
    'Exclusão concluída com sucesso',
    auth.uid(),
    NOW()
  );

  -- Retornar resultado
  RETURN QUERY SELECT 
    true as sucesso,
    CONCAT('NF-e ', v_nota_numero, '/', v_nota_serie, ' excluída com sucesso') as mensagem,
    v_itens_count as itens_deletados,
    v_estoque_total as estoque_revertido;

EXCEPTION WHEN OTHERS THEN
  RETURN QUERY SELECT 
    false as sucesso,
    CONCAT('Erro ao excluir: ', SQLERRM) as mensagem,
    0 as itens_deletados,
    0 as estoque_revertido;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Criar trigger para registrar exclusões em tempo real
CREATE OR REPLACE FUNCTION audit_delete_nota_entrada()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO auditoria_exclusoes (
    company_id,
    tipo_documento,
    documento_id,
    documento_numero,
    documento_serie,
    dados_excluidos,
    motivo,
    usuario_id,
    criado_em
  )
  VALUES (
    OLD.company_id,
    'NOTA_ENTRADA_TRIGGER',
    OLD.id,
    OLD.nfe_numero,
    OLD.nfe_serie,
    ROW_TO_JSON(OLD.*),
    'Deletado por trigger',
    auth.uid(),
    NOW()
  );
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger (se não existir)
DROP TRIGGER IF EXISTS trigger_audit_delete_nota_entrada ON nota_entrada;
CREATE TRIGGER trigger_audit_delete_nota_entrada
BEFORE DELETE ON nota_entrada
FOR EACH ROW
EXECUTE FUNCTION audit_delete_nota_entrada();

-- 4. Conceder permissões
GRANT EXECUTE ON FUNCTION delete_nota_entrada_completa(UUID) TO authenticated;
GRANT SELECT ON TABLE auditoria_exclusoes TO authenticated;
