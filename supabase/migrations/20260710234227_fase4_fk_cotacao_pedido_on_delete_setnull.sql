-- apagar/cancelar um pedido não pode travar: "desfaz" a alocação em vez de bloquear
alter table public.requisicoes_compra_cotacoes
  drop constraint if exists requisicoes_compra_cotacoes_pedido_item_id_fkey;

alter table public.requisicoes_compra_cotacoes
  add constraint requisicoes_compra_cotacoes_pedido_item_id_fkey
  foreign key (pedido_item_id) references public.pedidos_compra_itens(id) on delete set null;
