-- 1) remove a trava de "1 escolhido por item" — split permite N fornecedores por item
drop index if exists public.uniq_cotacao_escolhida_por_item;

-- marcador de "esta alocação já virou pedido" (na cotação, não na linha da requisição)
alter table public.requisicoes_compra_cotacoes
  add column if not exists pedido_item_id uuid references public.pedidos_compra_itens(id);

-- 2) alocar uma fatia a um fornecedor para o item (split). qtd_alocada já é a qtd final de compra
--    (item com pacote: num_pacotes * qtd_por_pacote, calculado no front; item sem pacote: qtd livre).
create or replace function public.alocar_fornecedor_item(
  p_item_id uuid,
  p_fornecedor_id uuid,
  p_qtd_alocada numeric,
  p_num_pacotes numeric default null
) returns integer language plpgsql security invoker set search_path = public as $$
declare
  v_count integer;
  v_tem_preco boolean;
begin
  -- exige cotação com preço quando aloca quantidade > 0
  if coalesce(p_qtd_alocada,0) > 0 then
    select exists(
      select 1
      from requisicoes_compra_cotacoes c
      join requisicoes_compra_itens ri on ri.id = c.requisicao_item_id
      join requisicoes_compra r on r.id = ri.requisicao_id
      where ri.item_id = p_item_id and c.fornecedor_id = p_fornecedor_id
        and ri.status = 'ABERTA' and r.status in ('ABERTA','EM_RFQ','EM_MAPA')
        and c.preco_unitario is not null
    ) into v_tem_preco;
    if not v_tem_preco then
      raise exception 'Informe o preço deste fornecedor antes de alocar quantidade'
        using errcode = 'check_violation';
    end if;
  end if;

  update requisicoes_compra_cotacoes c
     set qtd_alocada = nullif(p_qtd_alocada, 0),
         num_pacotes_alocado = p_num_pacotes,
         escolhido = (coalesce(p_qtd_alocada,0) > 0),
         updated_at = now()
  from requisicoes_compra_itens ri
  join requisicoes_compra r on r.id = ri.requisicao_id
  where c.requisicao_item_id = ri.id
    and ri.item_id = p_item_id
    and ri.status = 'ABERTA'
    and r.status in ('ABERTA','EM_RFQ','EM_MAPA')
    and c.fornecedor_id = p_fornecedor_id
    and c.pedido_item_id is null;  -- não mexe em alocação já pedida

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.alocar_fornecedor_item(uuid, uuid, numeric, numeric) to authenticated;

-- 3) aprovar por fornecedor usando a QUANTIDADE ALOCADA (split)
create or replace function public.aprovar_compra_fornecedor(p_fornecedor_id uuid)
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := get_user_company_id();
  v_pedido_id uuid;
  v_frete numeric;
  v_soma numeric;
  v_n integer := 0;
begin
  if v_company is null then
    raise exception 'Empresa do usuário não resolvida' using errcode = 'raise_exception';
  end if;

  -- itens com alocação deste fornecedor ainda não pedida
  if not exists (
    select 1
    from requisicoes_compra_cotacoes c
    join requisicoes_compra_itens ri on ri.id = c.requisicao_item_id
    join requisicoes_compra r on r.id = ri.requisicao_id
    where r.company_id = v_company and ri.status = 'ABERTA'
      and r.status in ('EM_RFQ','EM_MAPA')
      and c.fornecedor_id = p_fornecedor_id
      and c.qtd_alocada is not null and c.qtd_alocada > 0
      and c.preco_unitario is not null and c.pedido_item_id is null
  ) then
    raise exception 'Nenhuma alocação pendente para este fornecedor' using errcode = 'no_data_found';
  end if;

  -- frete do fornecedor (uma vez)
  select coalesce(max(c.frete),0) into v_frete
  from requisicoes_compra_cotacoes c
  join requisicoes_compra_itens ri on ri.id = c.requisicao_item_id
  join requisicoes_compra r on r.id = ri.requisicao_id
  where r.company_id = v_company and ri.status = 'ABERTA' and r.status in ('EM_RFQ','EM_MAPA')
    and c.fornecedor_id = p_fornecedor_id and c.qtd_alocada > 0 and c.pedido_item_id is null;

  insert into pedidos_compra (company_id, fornecedor_id, status, frete)
  values (v_company, p_fornecedor_id, 'EMITIDO', nullif(v_frete,0))
  returning id into v_pedido_id;

  -- 1 linha de pedido por item, usando a QTD ALOCADA (não a necessidade inteira)
  with alocado as (
    select ri.item_id,
           max(ri.item_nome) as item_nome,
           max(c.unidade_compra) as unidade,
           max(c.qtd_por_pacote) as qtd_por_pacote,
           max(c.qtd_alocada) as qtd,               -- alocação (replicada nas linhas do item)
           max(c.num_pacotes_alocado) as num_pacotes,
           max(c.preco_unitario) as preco,
           array_agg(distinct ri.id) as linhas
    from requisicoes_compra_cotacoes c
    join requisicoes_compra_itens ri on ri.id = c.requisicao_item_id
    join requisicoes_compra r on r.id = ri.requisicao_id
    where r.company_id = v_company and ri.status = 'ABERTA' and r.status in ('EM_RFQ','EM_MAPA')
      and c.fornecedor_id = p_fornecedor_id and c.qtd_alocada > 0 and c.preco_unitario is not null
      and c.pedido_item_id is null
    group by ri.item_id
  ), inseridos as (
    insert into pedidos_compra_itens (
      pedido_id, item_id, item_nome, unidade, qtd_por_pacote,
      quantidade_necessaria, quantidade, num_pacotes, preco_unitario, subtotal, requisicao_item_ids
    )
    select v_pedido_id, a.item_id, a.item_nome, a.unidade, a.qtd_por_pacote,
           a.qtd, a.qtd, a.num_pacotes, a.preco, a.preco * a.qtd, a.linhas
    from alocado a
    returning id, item_id
  )
  -- marca as cotações deste fornecedor/item como pedidas
  update requisicoes_compra_cotacoes c
     set pedido_item_id = ins.id, updated_at = now()
  from inseridos ins
  join requisicoes_compra_itens ri on ri.item_id = ins.item_id
  where c.requisicao_item_id = ri.id and c.fornecedor_id = p_fornecedor_id and c.pedido_item_id is null;

  get diagnostics v_n = row_count;

  -- frete rateado por subtotal
  select coalesce(sum(subtotal),0) into v_soma from pedidos_compra_itens where pedido_id = v_pedido_id;
  if v_frete > 0 and v_soma > 0 then
    update pedidos_compra_itens set frete_rateado = round(v_frete * (subtotal / v_soma), 2)
     where pedido_id = v_pedido_id;
  end if;

  update pedidos_compra p
     set valor_total = (select coalesce(sum(subtotal),0) from pedidos_compra_itens where pedido_id = p.id) + coalesce(v_frete,0)
   where p.id = v_pedido_id;

  -- linha da requisição vira PEDIDO quando o item não tem mais alocação pendente
  update requisicoes_compra_itens ri
     set status = 'PEDIDO'
   where ri.status = 'ABERTA'
     and exists (select 1 from requisicoes_compra_cotacoes c where c.requisicao_item_id = ri.id and c.pedido_item_id is not null)
     and not exists (
       select 1 from requisicoes_compra_cotacoes c2
       where c2.requisicao_item_id = ri.id and c2.qtd_alocada > 0 and c2.pedido_item_id is null
     );

  -- requisição vira APROVADA quando todas as linhas saíram de ABERTA
  update requisicoes_compra r
     set status = 'APROVADA', aprovada_em = now(), updated_at = now()
   where r.company_id = v_company and r.status in ('EM_RFQ','EM_MAPA')
     and not exists (select 1 from requisicoes_compra_itens ri where ri.requisicao_id = r.id and ri.status = 'ABERTA');

  return jsonb_build_object('pedido_id', v_pedido_id, 'itens', v_n, 'frete', v_frete);
end;
$$;

grant execute on function public.aprovar_compra_fornecedor(uuid) to authenticated;
