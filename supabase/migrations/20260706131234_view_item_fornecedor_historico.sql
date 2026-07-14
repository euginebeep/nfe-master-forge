CREATE OR REPLACE VIEW public.item_fornecedor_historico
WITH (security_invoker = true) AS
SELECT
  ni.item_id,
  ne.fornecedor_id,
  ne.company_id,
  count(*)                                               AS num_compras,
  round(avg(ni.vuncom), 4)                               AS preco_medio,
  max(ne.dh_emissao)                                     AS ultima_compra_data,
  (array_agg(ni.vuncom ORDER BY ne.dh_emissao DESC))[1]  AS ultimo_preco,
  (array_agg(ni.ucom   ORDER BY ne.dh_emissao DESC))[1]  AS ultima_unidade,
  (array_agg(ni.qcom   ORDER BY ne.dh_emissao DESC))[1]  AS ultima_qtd
FROM public.notas_entrada_itens ni
JOIN public.notas_entrada ne ON ne.id = ni.nota_entrada_id
WHERE ni.item_id IS NOT NULL AND ne.fornecedor_id IS NOT NULL
GROUP BY ni.item_id, ne.fornecedor_id, ne.company_id;
