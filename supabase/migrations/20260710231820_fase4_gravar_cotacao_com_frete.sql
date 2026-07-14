-- adiciona p_frete ao gravar de cotação consolidada (grava frete por linha do item)
create or replace function public.gravar_cotacao_item_consolidado(
  p_item_id uuid,
  p_fornecedor_id uuid,
  p_preco numeric,
  p_qtd_por_pacote numeric default null,
  p_unidade text default null,
  p_prazo text default null,
  p_qtd_cotada numeric default null,
  p_observacao text default null,
  p_frete numeric default null
) returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line_ids uuid[];
  v_count integer;
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

  insert into requisicoes_compra_cotacoes (
    requisicao_item_id, fornecedor_id, unidade_compra, qtd_por_pacote,
    qtd_cotada, preco_unitario, prazo_entrega, observacao, frete, escolhido
  )
  select rid, p_fornecedor_id, nullif(btrim(p_unidade), ''), p_qtd_por_pacote,
         p_qtd_cotada, p_preco, nullif(btrim(p_prazo), ''), nullif(btrim(p_observacao), ''), p_frete, false
  from unnest(v_line_ids) as t(rid)
  on conflict (requisicao_item_id, fornecedor_id) do update set
    unidade_compra = excluded.unidade_compra,
    qtd_por_pacote = excluded.qtd_por_pacote,
    qtd_cotada     = excluded.qtd_cotada,
    preco_unitario = excluded.preco_unitario,
    prazo_entrega  = excluded.prazo_entrega,
    observacao     = excluded.observacao,
    frete          = excluded.frete,
    updated_at     = now();

  get diagnostics v_count = row_count;

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

grant execute on function public.gravar_cotacao_item_consolidado(uuid, uuid, numeric, numeric, text, text, numeric, text, numeric) to authenticated;
