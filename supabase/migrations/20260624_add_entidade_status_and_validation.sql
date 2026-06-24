-- Migration: Add entity status and prevent CNPJ duplication
-- Date: 2026-06-24
-- Purpose: Implement robust entity management with status tracking and duplicate prevention

-- 1. Add status column to entidades table
ALTER TABLE entidades 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDENTE_CERTIFICADO';

-- Add comment explaining status values
COMMENT ON COLUMN entidades.status IS 'Status da entidade: PENDENTE_CERTIFICADO, CERTIFICADO_VALIDADO, DADOS_COMPLETOS, INATIVO';

-- 2. Create validation function to prevent CNPJ duplication
CREATE OR REPLACE FUNCTION validar_entidade_unica()
RETURNS TRIGGER AS $$
BEGIN
  -- Verificar se CNPJ já existe no mesmo tenant (excluindo o registro atual)
  IF EXISTS (
    SELECT 1 FROM entidades 
    WHERE documento = NEW.documento 
    AND company_id = NEW.company_id 
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000')
    AND status != 'INATIVO'
  ) THEN
    RAISE EXCEPTION 'CNPJ % já existe neste tenant', NEW.documento;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Create trigger to validate entity uniqueness
DROP TRIGGER IF EXISTS tr_validar_entidade_unica ON entidades;
CREATE TRIGGER tr_validar_entidade_unica
BEFORE INSERT OR UPDATE ON entidades
FOR EACH ROW
EXECUTE FUNCTION validar_entidade_unica();

-- 4. Create audit table for tracking changes
CREATE TABLE IF NOT EXISTS entidades_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_id UUID NOT NULL REFERENCES entidades(id) ON DELETE CASCADE,
  acao TEXT NOT NULL CHECK (acao IN ('INSERT', 'UPDATE', 'DELETE')),
  dados_antes JSONB,
  dados_depois JSONB,
  usuario_id UUID,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_entidades_auditoria_entidade_id ON entidades_auditoria(entidade_id);
CREATE INDEX IF NOT EXISTS idx_entidades_auditoria_timestamp ON entidades_auditoria(timestamp);
CREATE INDEX IF NOT EXISTS idx_entidades_auditoria_acao ON entidades_auditoria(acao);

-- 5. Create audit function
CREATE OR REPLACE FUNCTION auditar_entidade()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO entidades_auditoria (entidade_id, acao, dados_antes, dados_depois, usuario_id)
  VALUES (
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) ELSE NULL END,
    auth.uid()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 6. Create trigger for audit logging
DROP TRIGGER IF EXISTS tr_auditar_entidade ON entidades;
CREATE TRIGGER tr_auditar_entidade
AFTER INSERT OR UPDATE OR DELETE ON entidades
FOR EACH ROW
EXECUTE FUNCTION auditar_entidade();

-- 7. Create function to safely upsert entity (prevent duplicates)
CREATE OR REPLACE FUNCTION upsert_entidade(
  p_id UUID,
  p_documento TEXT,
  p_company_id UUID,
  p_razao_social TEXT,
  p_nome_fantasia TEXT,
  p_ie TEXT,
  p_im TEXT,
  p_cnae TEXT,
  p_crt TEXT,
  p_status TEXT,
  p_classificacao TEXT,
  p_site TEXT
)
RETURNS UUID AS $$
DECLARE
  v_entidade_id UUID;
BEGIN
  -- Try to update existing entity
  UPDATE entidades
  SET 
    razao_social = COALESCE(p_razao_social, razao_social),
    nome_fantasia = COALESCE(p_nome_fantasia, nome_fantasia),
    ie = COALESCE(p_ie, ie),
    im = COALESCE(p_im, im),
    cnae = COALESCE(p_cnae, cnae),
    crt = COALESCE(p_crt, crt),
    status = COALESCE(p_status, status),
    classificacao = COALESCE(p_classificacao, classificacao),
    site = COALESCE(p_site, site),
    updated_at = NOW()
  WHERE documento = p_documento 
    AND company_id = p_company_id
    AND status != 'INATIVO'
  RETURNING id INTO v_entidade_id;

  -- If no update happened, insert new entity
  IF v_entidade_id IS NULL THEN
    INSERT INTO entidades (
      id,
      documento,
      company_id,
      razao_social,
      nome_fantasia,
      ie,
      im,
      cnae,
      crt,
      status,
      classificacao,
      site,
      tipo_pessoa,
      contribuinte_icms
    )
    VALUES (
      COALESCE(p_id, gen_random_uuid()),
      p_documento,
      p_company_id,
      p_razao_social,
      p_nome_fantasia,
      p_ie,
      p_im,
      p_cnae,
      p_crt,
      COALESCE(p_status, 'PENDENTE_CERTIFICADO'),
      COALESCE(p_classificacao, 'REGULAR'),
      p_site,
      'PJ',
      'CONTRIBUINTE'
    )
    RETURNING id INTO v_entidade_id;
  END IF;

  RETURN v_entidade_id;
END;
$$ LANGUAGE plpgsql;

-- 8. Grant permissions
GRANT EXECUTE ON FUNCTION validar_entidade_unica() TO authenticated;
GRANT EXECUTE ON FUNCTION auditar_entidade() TO authenticated;
GRANT EXECUTE ON FUNCTION upsert_entidade(UUID, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 9. Add RLS policy for audit table (users can only see their own company's audits)
ALTER TABLE entidades_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view audits for their company entities"
ON entidades_auditoria
FOR SELECT
USING (
  entidade_id IN (
    SELECT id FROM entidades 
    WHERE company_id = (
      SELECT company_id FROM auth.users 
      WHERE id = auth.uid()
    )
  )
);

-- 10. Create index for better performance on CNPJ lookups
CREATE INDEX IF NOT EXISTS idx_entidades_documento_company 
ON entidades(documento, company_id) 
WHERE status != 'INATIVO';

-- 11. Create view for active entities only
CREATE OR REPLACE VIEW entidades_ativas AS
SELECT * FROM entidades
WHERE status != 'INATIVO';

-- 12. Add check constraint for valid status values
ALTER TABLE entidades
ADD CONSTRAINT check_entidade_status 
CHECK (status IN ('PENDENTE_CERTIFICADO', 'CERTIFICADO_VALIDADO', 'DADOS_COMPLETOS', 'INATIVO'));

-- 13. Add comment to explain the status workflow
COMMENT ON TABLE entidades IS 'Tabela de entidades (empresas). Status workflow: PENDENTE_CERTIFICADO → CERTIFICADO_VALIDADO → DADOS_COMPLETOS';
