WITH nfe_itens_reais AS (
  SELECT 
    nei.id as nfe_item_id,
    nei.nfe_numero,
    nei.nfe_serie,
    nei.data_emissao,
    nei.fornecedor_id,
    nei.item_id,
    nei.quantidade_xml,
    nei.unidade_xml,
    nei.valor_unitario_xml,
    nei.valor_total_xml,
    li.unidade_interna,
    li.unidade_fornecedor,
    li.fator_conversao,
    li.descricao_interna,
    (nei.quantidade_xml * li.fator_conversao) as quantidade_interna,
    CASE 
      WHEN li.fator_conversao > 0 THEN nei.valor_unitario_xml / li.fator_conversao
      ELSE nei.valor_unitario_xml
    END as custo_unitario_convertido,
    e.company_id,
    nei.criado_em
  FROM nota_entrada_itens nei
  LEFT JOIN local_itens li ON li.id = nei.item_id
  LEFT JOIN entidades e ON e.id = nei.fornecedor_id
  WHERE nei.item_id IS NOT NULL
    AND li.fator_conversao IS NOT NULL
    AND li.fator_conversao > 0
    AND e.company_id = (SELECT id FROM empresas WHERE slug = 'vitalnow' LIMIT 1)
  ORDER BY nei.data_emissao DESC
)
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
  company_id,
  fornecedor_id,
  item_id,
  nfe_numero,
  nfe_serie,
  unidade_xml as unidade_origem,
  unidade_interna as unidade_destino,
  fator_conversao,
  quantidade_xml,
  quantidade_interna,
  valor_unitario_xml as custo_unitario_xml,
  custo_unitario_convertido,
  'manual' as origem,
  (SELECT id FROM auth.users LIMIT 1) as usuario_id,
  criado_em,
  NOW() as atualizado_em
FROM nfe_itens_reais
ON CONFLICT DO NOTHING;
