-- Ranking de fornecedores por item (decisão automática "melhor custo real")
-- Reusa a view consolidada (necessidade por item) + cotações por fornecedor.
-- rank_custo=1 = melhor de verdade (considera embalagem + frete), != menor preço unitário.
create or replace view public.mapa_cotacao_ranking with (security_invoker = on) as
with cot as (
  select ri.item_id,
         c.fornecedor_id,
         max(c.preco_unitario)      as preco_unitario,
         max(c.frete)               as frete,
         max(c.qtd_por_pacote)      as qtd_por_pacote,
         max(c.unidade_compra)      as unidade_compra,
         (array_agg(c.prazo_entrega order by c.updated_at desc nulls last))[1] as prazo_entrega,
         bool_or(c.escolhido)       as escolhido,
         max(c.qtd_alocada)         as qtd_alocada
  from requisicoes_compra_cotacoes c
  join requisicoes_compra_itens ri on ri.id = c.requisicao_item_id
  join requisicoes_compra r        on r.id  = ri.requisicao_id
  where ri.status = 'ABERTA'
    and r.status in ('ABERTA','EM_RFQ','EM_MAPA')
    and c.preco_unitario is not null
  group by ri.item_id, c.fornecedor_id
),
calc as (
  select v.company_id, v.item_id, v.item_nome, v.unidade as unidade_item, v.total_falta,
         cot.fornecedor_id,
         coalesce(e.nome_fantasia, e.razao_social) as fornecedor_nome,
         cot.preco_unitario, cot.frete, cot.qtd_por_pacote, cot.unidade_compra,
         cot.prazo_entrega,
         nullif(regexp_replace(coalesce(cot.prazo_entrega,''), '\D', '', 'g'), '')::int as prazo_dias,
         cot.escolhido, cot.qtd_alocada,
         -- quantidade base para custo real, sempre na unidade de compra do fornecedor
         case
           when cot.qtd_por_pacote is not null and cot.qtd_por_pacote > 0
             then public.f_qtd_compra(v.total_falta, v.unidade, cot.unidade_compra, cot.qtd_por_pacote)
           else public.f_de_gramas(public.f_para_gramas(v.total_falta, v.unidade), cot.unidade_compra)
         end as qtd_compra
  from public.compras_necessidades_consolidadas v
  join cot            on cot.item_id = v.item_id
  join public.entidades e on e.id = cot.fornecedor_id
)
select
  calc.*,
  round(qtd_compra * preco_unitario, 2)                          as custo_itens,
  round(qtd_compra * preco_unitario + coalesce(frete,0), 2)      as custo_total,
  rank() over (partition by item_id order by qtd_compra * preco_unitario + coalesce(frete,0) asc) as rank_custo,
  rank() over (partition by item_id order by preco_unitario asc)                                   as rank_preco,
  rank() over (partition by item_id order by prazo_dias asc nulls last)                            as rank_prazo,
  count(*) over (partition by item_id)                                                             as n_cotados
from calc;

grant select on public.mapa_cotacao_ranking to authenticated;
