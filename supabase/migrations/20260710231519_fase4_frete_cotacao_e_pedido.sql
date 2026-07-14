-- frete digitado na cotação (por fornecedor)
alter table public.requisicoes_compra_cotacoes
  add column if not exists frete numeric;

-- carrega o frete pro pedido gerado (rastreabilidade + custo real no PO)
alter table public.pedidos_compra
  add column if not exists frete numeric;
alter table public.pedidos_compra_itens
  add column if not exists frete_rateado numeric;
