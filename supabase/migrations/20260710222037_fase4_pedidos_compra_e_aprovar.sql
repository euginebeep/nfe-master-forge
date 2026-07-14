-- ============ HELPERS DE UNIDADE / ARREDONDAMENTO ============
create or replace function public.f_para_gramas(p_qtd numeric, p_unidade text)
returns numeric language sql immutable as $$
  select case lower(coalesce(p_unidade,'g'))
    when 'kg'  then p_qtd * 1000
    when 'g'   then p_qtd
    when 'mg'  then p_qtd * 0.001
    when 'mcg' then p_qtd * 0.000001
    else p_qtd  -- un, ml, l, etc: sem conversão de massa
  end;
$$;

create or replace function public.f_de_gramas(p_gramas numeric, p_unidade text)
returns numeric language sql immutable as $$
  select case lower(coalesce(p_unidade,'g'))
    when 'kg'  then p_gramas / 1000
    when 'g'   then p_gramas
    when 'mg'  then p_gramas / 0.001
    when 'mcg' then p_gramas / 0.000001
    else p_gramas
  end;
$$;

-- espelha calcularQuantidadeCotacao do front: COM pacote arredonda p/ cima em embalagens
-- inteiras (na unidade de compra); SEM pacote devolve a necessidade exata (unidade do item).
create or replace function public.f_qtd_compra(
  p_falta numeric, p_unidade_item text, p_unidade_compra text, p_qtd_por_pacote numeric
) returns numeric language sql immutable as $$
  select case
    when p_qtd_por_pacote is not null and p_qtd_por_pacote > 0 then
      f_de_gramas(
        ceil(
          f_para_gramas(p_falta, p_unidade_item)
          / f_para_gramas(p_qtd_por_pacote, coalesce(nullif(p_unidade_compra,''), p_unidade_item))
        ) * f_para_gramas(p_qtd_por_pacote, coalesce(nullif(p_unidade_compra,''), p_unidade_item)),
        coalesce(nullif(p_unidade_compra,''), p_unidade_item)
      )
    else p_falta
  end;
$$;

-- ============ TABELAS pedidos_compra ============
create table if not exists public.pedidos_compra (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id),
  numero_interno text,
  fornecedor_id uuid not null references public.entidades(id),
  status text not null default 'EMITIDO'
    check (status in ('EMITIDO','RECEBIDO_PARCIAL','RECEBIDO','CANCELADO')),
  valor_total numeric,
  condicao_pagamento text,
  prazo_entrega text,
  observacao text,
  emitido_por uuid,
  emitido_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.pedidos_compra_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos_compra(id) on delete cascade,
  item_id uuid references public.itens(id),
  item_nome text,
  unidade text,
  qtd_por_pacote numeric,
  quantidade_necessaria numeric,          -- soma crua da necessidade (rastreabilidade)
  quantidade numeric,                      -- arredondada por pacote (o que se compra)
  num_pacotes numeric,
  preco_unitario numeric,
  subtotal numeric,
  requisicao_item_ids uuid[],              -- linhas de requisição cobertas por esta linha do PO
  quantidade_recebida numeric default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_pedidos_compra_company on public.pedidos_compra(company_id);
create index if not exists idx_pedidos_compra_fornecedor on public.pedidos_compra(fornecedor_id);
create index if not exists idx_pedidos_compra_itens_pedido on public.pedidos_compra_itens(pedido_id);

-- RLS (mesmo padrão do resto: isola por company_id)
alter table public.pedidos_compra enable row level security;
alter table public.pedidos_compra_itens enable row level security;

drop policy if exists pedidos_compra_tenant on public.pedidos_compra;
create policy pedidos_compra_tenant on public.pedidos_compra
  for all using (company_id = get_user_company_id())
  with check (company_id = get_user_company_id());

drop policy if exists pedidos_compra_itens_tenant on public.pedidos_compra_itens;
create policy pedidos_compra_itens_tenant on public.pedidos_compra_itens
  for all using (exists (
    select 1 from public.pedidos_compra p
    where p.id = pedidos_compra_itens.pedido_id and p.company_id = get_user_company_id()
  ))
  with check (exists (
    select 1 from public.pedidos_compra p
    where p.id = pedidos_compra_itens.pedido_id and p.company_id = get_user_company_id()
  ));

-- numeração PC-AAAA-000N por empresa/ano
create or replace function public.set_numero_pedido()
returns trigger language plpgsql as $$
declare
  v_ano text := to_char(now(), 'YYYY');
  v_seq int;
begin
  if new.numero_interno is not null then return new; end if;
  select count(*) + 1 into v_seq
  from public.pedidos_compra
  where company_id = new.company_id
    and to_char(created_at, 'YYYY') = v_ano;
  new.numero_interno := 'PC-' || v_ano || '-' || lpad(v_seq::text, 4, '0');
  return new;
end;
$$;

drop trigger if exists trg_set_numero_pedido on public.pedidos_compra;
create trigger trg_set_numero_pedido before insert on public.pedidos_compra
  for each row execute function public.set_numero_pedido();

-- ============ RPC aprovar_compra (global) ============
-- Gera 1 pedido por fornecedor a partir dos itens DECIDIDOS, arredondando por pacote
-- sobre o total por fornecedor. Só aprova requisições 100% decididas. Atômico.
-- NOTA: o fluxo ALVO é aprovar_compra_fornecedor (20260710232830 / 20260710233939).
create or replace function public.aprovar_compra()
returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  v_company uuid := get_user_company_id();
  v_pedido_ids uuid[] := '{}';
  r_forn record;
  v_pedido_id uuid;
begin
  if v_company is null then
    raise exception 'Empresa do usuário não resolvida' using errcode = 'raise_exception';
  end if;

  -- requisições elegíveis: EM_MAPA e com TODOS os itens ABERTOS decididos
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

  -- 1 pedido por fornecedor escolhido (dentro das reqs elegíveis)
  for r_forn in
    select distinct c.fornecedor_id
    from requisicoes_compra_itens ri
    join requisicoes_compra_cotacoes c on c.requisicao_item_id = ri.id and c.escolhido
    where ri.requisicao_id in (select id from _reqs_ok)
      and ri.status = 'ABERTA' and c.preco_unitario is not null
  loop
    insert into pedidos_compra (company_id, fornecedor_id, status)
    values (v_company, r_forn.fornecedor_id, 'EMITIDO')
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

    update pedidos_compra p
       set valor_total = (select coalesce(sum(subtotal),0) from pedidos_compra_itens where pedido_id = p.id)
     where p.id = v_pedido_id;

    v_pedido_ids := array_append(v_pedido_ids, v_pedido_id);
  end loop;

  -- move as requisições elegíveis para APROVADA
  update requisicoes_compra
     set status = 'APROVADA', aprovada_em = now(), updated_at = now()
   where id in (select id from _reqs_ok);

  return jsonb_build_object('pedidos_criados', v_pedido_ids, 'n', coalesce(array_length(v_pedido_ids,1),0));
end;
$$;

grant execute on function public.f_para_gramas(numeric, text) to authenticated;
grant execute on function public.f_de_gramas(numeric, text) to authenticated;
grant execute on function public.f_qtd_compra(numeric, text, text, numeric) to authenticated;
grant execute on function public.aprovar_compra() to authenticated;
