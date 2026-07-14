-- Painel do comprador: necessidades abertas somadas por item, com inteligência de compra.
-- security_invoker=on => respeita a RLS de requisicoes_compra (isolamento por tenant automático).
create or replace view public.compras_necessidades_consolidadas
with (security_invoker = on) as
select
  r.company_id,
  i.item_id,
  i.item_nome,
  it.tipo_item,
  i.unidade,
  sum(i.quantidade_faltante)                                   as total_falta,
  array_agg(distinct op.codigo) filter (where op.codigo is not null) as ops,
  count(distinct r.op_id)                                      as n_ops,
  count(distinct r.id)                                         as n_requisicoes,
  it.embalagem_compra_qtd,
  it.embalagem_compra_unidade,
  h.num_compras,
  h.preco_medio,
  h.ultimo_preco,
  h.ultima_compra_data,
  h.ultimo_fornecedor_id,
  h.ultimo_fornecedor_nome,
  (select count(*) from item_fornecedores f where f.item_id = i.item_id) as n_fornecedores_cadastrados
from requisicoes_compra_itens i
join requisicoes_compra r on r.id = i.requisicao_id
left join itens it on it.id = i.item_id
left join ordens_producao_industrial op on op.id = r.op_id
left join item_historico_compra h on h.item_id = i.item_id and h.company_id = r.company_id
where r.status in ('ABERTA','EM_RFQ','EM_MAPA')
  and i.status = 'ABERTA'
group by
  r.company_id, i.item_id, i.item_nome, it.tipo_item, i.unidade,
  it.embalagem_compra_qtd, it.embalagem_compra_unidade,
  h.num_compras, h.preco_medio, h.ultimo_preco, h.ultima_compra_data,
  h.ultimo_fornecedor_id, h.ultimo_fornecedor_nome;

grant select on public.compras_necessidades_consolidadas to authenticated;
