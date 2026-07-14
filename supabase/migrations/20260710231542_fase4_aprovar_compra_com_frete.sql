-- atualiza aprovar_compra (global) para levar o frete do fornecedor ao pedido e ratear no custo do item
create or replace function public.aprovar_compra()
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := get_user_company_id();
  v_pedido_ids uuid[] := '{}';
  r_forn record;
  v_pedido_id uuid;
  v_frete numeric;
  v_soma_itens numeric;
begin
  if v_company is null then
    raise exception 'Empresa do usuário não resolvida' using errcode = 'raise_exception';
  end if;

  create temp table _reqs_ok on commit drop as
  select r.id
  from requisicoes_compra r
  where r.company_id = v_company
    and r.status = 'EM_MAPA'
    and not exists (
      select 1 from requisicoes_compra_itens ri
      where ri.requisicao_id = r.id and ri.status = 'ABERTA'
        and not exists (
          select 1 from requisicoes_compra_cotacoes c
          where c.requisicao_item_id = ri.id and c.escolhido and c.preco_unitario is not null
        )
    );

  if not exists (select 1 from _reqs_ok) then
    raise exception 'Nenhuma requisição pronta para aprovar (todos os itens precisam de cotação escolhida com preço)'
      using errcode = 'no_data_found';
  end if;

  for r_forn in
    select distinct c.fornecedor_id
    from requisicoes_compra_itens ri
    join requisicoes_compra_cotacoes c on c.requisicao_item_id = ri.id and c.escolhido
    where ri.requisicao_id in (select id from _reqs_ok)
      and ri.status = 'ABERTA' and c.preco_unitario is not null
  loop
    -- frete do fornecedor: maior valor não-nulo entre as cotações escolhidas dele (é o frete do pedido)
    select coalesce(max(c.frete), 0)
      into v_frete
    from requisicoes_compra_itens ri
    join requisicoes_compra_cotacoes c on c.requisicao_item_id = ri.id and c.escolhido
    where ri.requisicao_id in (select id from _reqs_ok)
      and ri.status = 'ABERTA' and c.fornecedor_id = r_forn.fornecedor_id
      and c.preco_unitario is not null;

    insert into pedidos_compra (company_id, fornecedor_id, status, frete)
    values (v_company, r_forn.fornecedor_id, 'EMITIDO', nullif(v_frete,0))
    returning id into v_pedido_id;

    insert into pedidos_compra_itens (
      pedido_id, item_id, item_nome, unidade, qtd_por_pacote,
      quantidade_necessaria, quantidade, num_pacotes, preco_unitario, subtotal, requisicao_item_ids
    )
    select
      v_pedido_id,
      ri.item_id,
      max(ri.item_nome),
      max(ri.unidade),
      max(c.qtd_por_pacote),
      sum(ri.quantidade_faltante),
      f_qtd_compra(sum(ri.quantidade_faltante), max(ri.unidade), max(c.unidade_compra), max(c.qtd_por_pacote)),
      case when max(c.qtd_por_pacote) is not null and max(c.qtd_por_pacote) > 0
           then ceil(f_para_gramas(sum(ri.quantidade_faltante), max(ri.unidade))
                     / f_para_gramas(max(c.qtd_por_pacote), coalesce(nullif(max(c.unidade_compra),''), max(ri.unidade))))
           else null end,
      max(c.preco_unitario),
      max(c.preco_unitario) * f_qtd_compra(sum(ri.quantidade_faltante), max(ri.unidade), max(c.unidade_compra), max(c.qtd_por_pacote)),
      array_agg(ri.id)
    from requisicoes_compra_itens ri
    join requisicoes_compra_cotacoes c on c.requisicao_item_id = ri.id and c.escolhido
    where ri.requisicao_id in (select id from _reqs_ok)
      and ri.status = 'ABERTA' and c.fornecedor_id = r_forn.fornecedor_id
      and c.preco_unitario is not null
    group by ri.item_id;

    -- rateia o frete proporcional ao subtotal de cada item do pedido
    select coalesce(sum(subtotal),0) into v_soma_itens from pedidos_compra_itens where pedido_id = v_pedido_id;
    if v_frete > 0 and v_soma_itens > 0 then
      update pedidos_compra_itens
         set frete_rateado = round(v_frete * (subtotal / v_soma_itens), 2)
       where pedido_id = v_pedido_id;
    end if;

    -- total do pedido = itens + frete
    update pedidos_compra p
       set valor_total = (select coalesce(sum(subtotal),0) from pedidos_compra_itens where pedido_id = p.id) + coalesce(v_frete,0)
     where p.id = v_pedido_id;

    v_pedido_ids := array_append(v_pedido_ids, v_pedido_id);
  end loop;

  update requisicoes_compra
     set status = 'APROVADA', aprovada_em = now(), updated_at = now()
   where id in (select id from _reqs_ok);

  return jsonb_build_object('pedidos_criados', v_pedido_ids, 'n', coalesce(array_length(v_pedido_ids,1),0));
end;
$$;
