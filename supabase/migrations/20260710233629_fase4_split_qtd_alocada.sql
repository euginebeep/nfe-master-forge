-- split: quanto se compra de CADA fornecedor para o mesmo item
alter table public.requisicoes_compra_cotacoes
  add column if not exists qtd_alocada numeric,            -- fatia na unidade de compra (item sem pacote: qtd livre)
  add column if not exists num_pacotes_alocado numeric;    -- item com pacote: nº de pacotes (qtd_alocada = num_pacotes * qtd_por_pacote)

comment on column public.requisicoes_compra_cotacoes.qtd_alocada is
  'Quantidade alocada a este fornecedor para o item (split). Item com pacote: derivada de num_pacotes_alocado. Item sem pacote: quantidade livre digitada.';
