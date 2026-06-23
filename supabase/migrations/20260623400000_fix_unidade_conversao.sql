-- ============================================================================
-- MIGRATION: Corrigir unidades malformadas e recalcular fatores de conversão
-- Problema: NF-es com unidades como "25 KG" em vez de "KG"
-- Solução: Extrair número e recalcular fator corretamente
-- ============================================================================

-- 1. Criar função para extrair unidade e multiplicador
CREATE OR REPLACE FUNCTION extract_unidade_multiplicador(
  unidade_xml TEXT,
  quantidade_xml NUMERIC DEFAULT 1
)
RETURNS TABLE (
  unidade_corrigida TEXT,
  multiplicador NUMERIC,
  quantidade_real NUMERIC
) AS $$
BEGIN
  -- Verificar se tem padrão "25 KG" (número + espaço + letra)
  IF unidade_xml ~ '^\d+(\.\d+)?\s*[A-Za-z%]+$' THEN
    -- Extrair número
    RETURN QUERY
    SELECT 
      UPPER(TRIM(REGEXP_REPLACE(unidade_xml, '^\d+(\.\d+)?\s*', ''))) as unidade,
      (REGEXP_MATCHES(unidade_xml, '\d+(\.\d+)?', 'g'))[1]::NUMERIC as mult,
      quantidade_xml * (REGEXP_MATCHES(unidade_xml, '\d+(\.\d+)?', 'g'))[1]::NUMERIC as qtd;
  ELSE
    -- Sem número embutido, retornar como está
    RETURN QUERY
    SELECT 
      UPPER(TRIM(unidade_xml)) as unidade,
      1::NUMERIC as mult,
      quantidade_xml as qtd;
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Criar função para calcular fator de conversão
CREATE OR REPLACE FUNCTION calcular_fator_conversao(
  unidade_origem TEXT,
  unidade_destino TEXT,
  multiplicador NUMERIC DEFAULT 1
)
RETURNS NUMERIC AS $$
DECLARE
  fator NUMERIC;
BEGIN
  -- Tabela de conversão padrão
  fator := CASE 
    -- Peso
    WHEN unidade_origem = 'KG' AND unidade_destino = 'G' THEN 1000
    WHEN unidade_origem = 'KG' AND unidade_destino = 'MG' THEN 1000000
    WHEN unidade_origem = 'G' AND unidade_destino = 'MG' THEN 1000
    WHEN unidade_origem = 'G' AND unidade_destino = 'KG' THEN 0.001
    WHEN unidade_origem = 'MG' AND unidade_destino = 'G' THEN 0.001
    WHEN unidade_origem = 'MG' AND unidade_destino = 'KG' THEN 0.000001
    
    -- Volume
    WHEN unidade_origem = 'L' AND unidade_destino = 'ML' THEN 1000
    WHEN unidade_origem = 'ML' AND unidade_destino = 'L' THEN 0.001
    
    -- Unidades
    WHEN unidade_origem = 'MILHEIRO' AND unidade_destino = 'UN' THEN 1000
    WHEN unidade_origem = 'UN' AND unidade_destino = 'MILHEIRO' THEN 0.001
    WHEN unidade_origem = 'CAIXA' AND unidade_destino = 'UN' THEN 12
    WHEN unidade_origem = 'UN' AND unidade_destino = 'CAIXA' THEN 1.0/12
    
    -- Mesma unidade
    ELSE 1
  END;
  
  RETURN fator * multiplicador;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Atualizar nota_entrada_itens com unidades corrigidas
UPDATE nota_entrada_itens nei
SET 
  unidade_xml = (
    SELECT unidade_corrigida 
    FROM extract_unidade_multiplicador(nei.unidade_xml, nei.quantidade_xml)
  ),
  quantidade_xml = (
    SELECT quantidade_real 
    FROM extract_unidade_multiplicador(nei.unidade_xml, nei.quantidade_xml)
  ),
  atualizado_em = NOW()
WHERE 
  unidade_xml ~ '^\d+(\.\d+)?\s*[A-Za-z%]+$'
  AND EXISTS (
    SELECT 1 FROM entidades e 
    WHERE e.id = nei.fornecedor_id 
    AND e.company_id = (SELECT id FROM empresas WHERE slug = 'vitalnow' LIMIT 1)
  );

-- 4. Recalcular fator de conversão para itens vinculados
UPDATE nota_entrada_itens nei
SET 
  fator_conversao = COALESCE(
    calcular_fator_conversao(
      (SELECT unidade_corrigida FROM extract_unidade_multiplicador(nei.unidade_xml, 1)),
      (SELECT unidade_interna FROM local_itens WHERE id = nei.item_id),
      (SELECT multiplicador FROM extract_unidade_multiplicador(nei.unidade_xml, 1))
    ),
    1
  ),
  atualizado_em = NOW()
WHERE 
  nei.item_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM entidades e 
    WHERE e.id = nei.fornecedor_id 
    AND e.company_id = (SELECT id FROM empresas WHERE slug = 'vitalnow' LIMIT 1)
  );

-- 5. Recalcular quantidade interna
UPDATE nota_entrada_itens nei
SET 
  quantidade_interna = COALESCE(
    nei.quantidade_xml * COALESCE(nei.fator_conversao, 1),
    nei.quantidade_xml
  ),
  atualizado_em = NOW()
WHERE 
  nei.item_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM entidades e 
    WHERE e.id = nei.fornecedor_id 
    AND e.company_id = (SELECT id FROM empresas WHERE slug = 'vitalnow' LIMIT 1)
  );

-- 6. Registrar histórico de correção
INSERT INTO fator_conversao_historico (
  id,
  company_id,
  fornecedor_id,
  item_id,
  nfe_numero,
  nfe_serie,
  unidade_origem,
  unidade_destino,
  fator_conversao,
  quantidade_xml,
  quantidade_interna,
  custo_unitario_xml,
  custo_unitario_convertido,
  origem,
  usuario_id,
  criado_em,
  atualizado_em
)
SELECT 
  gen_random_uuid(),
  e.company_id,
  nei.fornecedor_id,
  nei.item_id,
  nei.nfe_numero,
  nei.nfe_serie,
  (SELECT unidade_corrigida FROM extract_unidade_multiplicador(nei.unidade_xml, 1)) as unidade_origem,
  li.unidade_interna as unidade_destino,
  COALESCE(nei.fator_conversao, 1) as fator,
  nei.quantidade_xml,
  COALESCE(nei.quantidade_interna, nei.quantidade_xml) as qtd_interna,
  nei.valor_unitario_xml,
  CASE 
    WHEN COALESCE(nei.fator_conversao, 1) > 0 
    THEN nei.valor_unitario_xml / COALESCE(nei.fator_conversao, 1)
    ELSE nei.valor_unitario_xml
  END as custo_convertido,
  'correcao_automatica' as origem,
  (SELECT id FROM auth.users LIMIT 1) as usuario_id,
  nei.criado_em,
  NOW() as atualizado_em
FROM nota_entrada_itens nei
LEFT JOIN local_itens li ON li.id = nei.item_id
LEFT JOIN entidades e ON e.id = nei.fornecedor_id
WHERE 
  nei.item_id IS NOT NULL
  AND e.company_id = (SELECT id FROM empresas WHERE slug = 'vitalnow' LIMIT 1)
  AND NOT EXISTS (
    SELECT 1 FROM fator_conversao_historico fch
    WHERE fch.nfe_numero = nei.nfe_numero
    AND fch.nfe_serie = nei.nfe_serie
    AND fch.item_id = nei.item_id
  )
ON CONFLICT DO NOTHING;

-- 7. Relatório de resumo
SELECT 
  'RESUMO DA CORREÇÃO' as titulo,
  (SELECT COUNT(DISTINCT nfe_numero) FROM nota_entrada_itens nei
   WHERE EXISTS (SELECT 1 FROM entidades e WHERE e.id = nei.fornecedor_id 
   AND e.company_id = (SELECT id FROM empresas WHERE slug = 'vitalnow' LIMIT 1))
  ) as total_nfe,
  (SELECT COUNT(*) FROM nota_entrada_itens nei
   WHERE EXISTS (SELECT 1 FROM entidades e WHERE e.id = nei.fornecedor_id 
   AND e.company_id = (SELECT id FROM empresas WHERE slug = 'vitalnow' LIMIT 1))
  ) as total_itens,
  (SELECT COUNT(*) FROM fator_conversao_historico fch
   WHERE fch.company_id = (SELECT id FROM empresas WHERE slug = 'vitalnow' LIMIT 1)
   AND fch.origem = 'correcao_automatica'
  ) as itens_registrados_historico;
