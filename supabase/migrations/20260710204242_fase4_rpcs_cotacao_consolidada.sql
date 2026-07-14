-- PR #2 (Fase 4) — RPCs de cotação consolidada
-- Fan-out do item consolidado -> N requisicoes_compra_itens, atômico, SECURITY INVOKER (RLS isola tenant).
-- NOTA: a versão de 8 params de gravar_cotacao_item_consolidado é substituída (9 params, com p_frete)
--       na migration 20260710231820 e a antiga é DROPADA em 20260710231836.

create or replace function public.gravar_cotacao_item_consolidado(
  p_item_id uuid,
  p_fornecedor_id uuid,
  p_preco numeric,
  p_qtd_por_pacote numeric default null,
  p_unidade text default null,
  p_prazo text default null,
  p_qtd_cotada numeric default null,
  p_observacao text default null
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line_ids uuid[];
  v_count integer;
begin
  -- linhas subjacentes do item consolidado (abertas, em requisição na fase de cotação)
  select array_agg(ri.id)
    into v_line_ids
  from requisicoes_compra_itens ri
  join requisicoes_compra r on r.id = ri.requisicao_id
  where ri.item_id = p_item_id
    and ri.status = 'ABERTA'
    and r.status in ('ABERTA','EM_RFQ','EM_MAPA');

  if v_line_ids is null or array_length(v_line_ids, 1) is null then
    raise exception 'Nenhuma linha de requisição aberta para o item %', p_item_id
      using errcode = 'no_data_found';
  end if;

  insert into requisicoes_compra_cotacoes (
    requisicao_item_id, fornecedor_id, unidade_compra, qtd_por_pacote,
    qtd_cotada, preco_unitario, prazo_entrega, observacao, escolhido
  )
  select rid, p_fornecedor_id, nullif(btrim(p_unidade), ''), p_qtd_por_pacote,
         p_qtd_cotada, p_preco, nullif(btrim(p_prazo), ''), nullif(btrim(p_observacao), ''), false
  from unnest(v_line_ids) as t(rid)
  on conflict (requisicao_item_id, fornecedor_id) do update set
    unidade_compra = excluded.unidade_compra,
    qtd_por_pacote = excluded.qtd_por_pacote,
    qtd_cotada     = excluded.qtd_cotada,
    preco_unitario = excluded.preco_unitario,
    prazo_entrega  = excluded.prazo_entrega,
    observacao     = excluded.observacao,
    updated_at     = now();
  -- 'escolhido' intocado no conflito (salvar preço não desmarca escolha)

  get diagnostics v_count = row_count;

  -- está cotando = está no mapa: avança apenas EM_RFQ -> EM_MAPA
  update requisicoes_compra r
     set status = 'EM_MAPA', updated_at = now()
   where r.id in (
     select distinct ri.requisicao_id
     from requisicoes_compra_itens ri
     where ri.id = any(v_line_ids)
   )
   and r.status = 'EM_RFQ';

  return v_count;
end;
$$;

create or replace function public.escolher_fornecedor_item_consolidado(
  p_item_id uuid,
  p_fornecedor_id uuid
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line_ids uuid[];
  v_chosen integer;
begin
  select array_agg(ri.id)
    into v_line_ids
  from requisicoes_compra_itens ri
  join requisicoes_compra r on r.id = ri.requisicao_id
  where ri.item_id = p_item_id
    and ri.status = 'ABERTA'
    and r.status in ('ABERTA','EM_RFQ','EM_MAPA');

  if v_line_ids is null or array_length(v_line_ids, 1) is null then
    raise exception 'Nenhuma linha de requisição aberta para o item %', p_item_id
      using errcode = 'no_data_found';
  end if;

  -- exige cotação COM preço para o fornecedor em todas as linhas do item
  if exists (
    select 1
    from unnest(v_line_ids) as t(rid)
    where not exists (
      select 1 from requisicoes_compra_cotacoes c
      where c.requisicao_item_id = t.rid
        and c.fornecedor_id = p_fornecedor_id
        and c.preco_unitario is not null
    )
  ) then
    raise exception 'Fornecedor sem cotação com preço em uma ou mais linhas do item'
      using errcode = 'check_violation';
  end if;

  -- 1) limpa escolhido das linhas (evita colisão no unique parcial)
  update requisicoes_compra_cotacoes
     set escolhido = false, updated_at = now()
   where requisicao_item_id = any(v_line_ids)
     and escolhido;

  -- 2) marca o vencedor (só onde há preço)
  update requisicoes_compra_cotacoes
     set escolhido = true, updated_at = now()
   where requisicao_item_id = any(v_line_ids)
     and fornecedor_id = p_fornecedor_id
     and preco_unitario is not null;
  get diagnostics v_chosen = row_count;

  -- 3) propaga p/ a linha da requisição — SEM arredondar (arredondamento é no PO)
  update requisicoes_compra_itens ri
     set fornecedor_id = p_fornecedor_id,
         preco_cotado  = c.preco_unitario,
         quantidade_comprar = ri.quantidade_faltante
    from requisicoes_compra_cotacoes c
   where c.requisicao_item_id = ri.id
     and c.fornecedor_id = p_fornecedor_id
     and c.escolhido
     and ri.id = any(v_line_ids);

  return v_chosen;
end;
$$;

grant execute on function public.gravar_cotacao_item_consolidado(uuid, uuid, numeric, numeric, text, text, numeric, text) to authenticated;
grant execute on function public.escolher_fornecedor_item_consolidado(uuid, uuid) to authenticated;
