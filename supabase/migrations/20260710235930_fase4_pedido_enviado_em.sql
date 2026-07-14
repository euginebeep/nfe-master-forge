alter table public.pedidos_compra
  add column if not exists pedido_enviado_em timestamptz;

comment on column public.pedidos_compra.pedido_enviado_em is
  'Quando o pedido foi enviado ao fornecedor (WhatsApp/e-mail). Selo "Enviado em" na tela.';
