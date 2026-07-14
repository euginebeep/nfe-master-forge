-- marcador: linha de requisição já virou pedido (evita comprar 2x o mesmo item)
alter table public.requisicoes_compra_itens
  add column if not exists pedido_item_id uuid references public.pedidos_compra_itens(id);

-- aprova/gera pedido de UM fornecedor só (parcial, não exige o resto decidido)
-- NOTA: esta versão usa a NECESSIDADE inteira; é REESCRITA em 20260710233939 para usar a
--       QUANTIDADE ALOCADA (split). Mantida aqui para fidelidade histórica.
create or replace function public.aprovar_compra_fornecedor(p_fornecedor_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := get_user_company_id();
  v_pedido_id uuid;
  v_frete numeric;
  v_soma numeric;
  v_line_ids uuid[];
begin
  if v_company is null then
    raise exception 'Empresa do usuário não resolvida' using errcode = 'raise_exception';
  end if;

  -- linhas decididas desse fornecedor, ainda não pedidas
  select array_agg(ri.id)
    into v_line_ids
  from requisicoes_compra_itens ri
  join requisicoes_compra r on r.id = ri.requisicao_id
  join requisicoes_compra_cotacoes c on c.requisicao_item_id = ri.id and c.escolhido
  where r.company_id = v_company
    and ri.status = 'ABERTA'
    and r.status in ('EM_RFQ','EM_MAPA')
    and ri.pedido_item_id is null
    and c.fornecedor_id = p_fornecedor_id
    and c.preco_unitario is not null;

  if v_line_ids is null or array_length(v_line_ids,1) is null then
    raise exception 'Nenhum item decidido (com preço) para este fornecedor'
      using errcode = 'no_data_found';
  end if;

  select coalesce(max(c.frete),0) into v_frete
  from requisicoes_compra_cotacoes c
  where c.requisicao_item_id = any(v_line_ids) and c.fornecedor_id = p_fornecedor_id and c.escolhido;

  insert into pedidos_compra (company_id, fornecedor_id, status, frete)
  values (v_company, p_fornecedor_id, 'EMITIDO', nullif(v_frete,0))
  returning id into v_pedido_id;

  with novos as (
    insert into pedidos_compra_itens (
      pedido_id, item_id, item_nome, unidade, qtd_por_pacote,
      quantidade_necessaria, quantidade, num_pacotes, preco_unitario, subtotal, requisicao_item_ids
    )
    select
      v_pedido_id, ri.item_id, max(ri.item_nome), max(ri.unidade), max(c.qtd_por_pacote),
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
    where ri.id = any(v_line_ids) and c.fornecedor_id = p_fornecedor_id
    group by ri.item_id
    returning id, requisicao_item_ids
  )
  update requisicoes_compra_itens ri
     set pedido_item_id = n.id
  from novos n
  where ri.id = any(n.requisicao_item_ids);

  select coalesce(sum(subtotal),0) into v_soma from pedidos_compra_itens where pedido_id = v_pedido_id;
  if v_frete > 0 and v_soma > 0 then
    update pedidos_compra_itens
       set frete_rateado = round(v_frete * (subtotal / v_soma), 2)
     where pedido_id = v_pedido_id;
  end if;

  update pedidos_compra p
     set valor_total = (select coalesce(sum(subtotal),0) from pedidos_compra_itens where pedido_id = p.id) + coalesce(v_frete,0)
   where p.id = v_pedido_id;

  update requisicoes_compra r
     set status = 'APROVADA', aprovada_em = now(), updated_at = now()
   where r.company_id = v_company
     and r.status in ('EM_RFQ','EM_MAPA')
     and r.id in (select distinct requisicao_id from requisicoes_compra_itens where id = any(v_line_ids))
     and not exists (
       select 1 from requisicoes_compra_itens ri2
       where ri2.requisicao_id = r.id and ri2.status = 'ABERTA' and ri2.pedido_item_id is null
     );

  return jsonb_build_object('pedido_id', v_pedido_id, 'itens', array_length(v_line_ids,1), 'frete', v_frete);
end;
$$;

grant execute on function public.aprovar_compra_fornecedor(uuid) to authenticated;
