-- =====================================================================
-- CORRECAO DE DADOS — Recompor custo medio de itens zerados
-- Aplicada em producao via MCP em 2026-07-27 (Barretos).
--
-- CAUSA: estoque_lotes tem dois gatilhos de custo medio (trg_recalcular_custo_medio
-- e trig_custo_medio_lote) que recalculam a media ponderada considerando APENAS
-- lotes com quantidade_interna > 0. Quando um item fica sem nenhum lote com saldo,
-- a soma vira NULL, a funcao cai no ELSE e grava custo_medio_atual = 0.
--
-- Isso disparou em 27/07/2026 na baixa dos 40 lotes vencidos, zerando o custo de
-- 20 itens. Destes, 9 (probioticos) se auto-corrigiram quando a baixa indevida foi
-- revertida. Restaram 11.
--
-- CRITERIO: custo_unitario_interno do lote mais recente que tenha custo > 0.
-- Nenhum dado foi perdido — o custo de cada lote sempre esteve preservado.
--
-- ESCOPO: apenas custo_medio_atual e custo_medio_atualizado_em. Nenhum outro
-- atributo do item e tocado (decisao do Fabio).
--
-- VERIFICADO APOS: 0 itens com lote e custo zerado.
-- =====================================================================

with alvo as (
  select i.id from public.itens i
   where i.company_id = '60d2caee-d99d-4954-8bab-38ddf2cf5019'
     and coalesce(i.custo_medio_atual,0) = 0
     and exists (select 1 from public.estoque_lotes e where e.item_id = i.id)
),
ult as (
  select distinct on (e.item_id) e.item_id, e.custo_unitario_interno
    from public.estoque_lotes e
    join alvo a on a.id = e.item_id
   where coalesce(e.custo_unitario_interno,0) > 0
   order by e.item_id, e.created_at desc
)
update public.itens i
   set custo_medio_atual = u.custo_unitario_interno,
       custo_medio_atualizado_em = now()
  from ult u
 where i.id = u.item_id
   and i.company_id = '60d2caee-d99d-4954-8bab-38ddf2cf5019';
