-- =====================================================================
-- INTEGRIDADE — data de fabricacao nunca posterior a validade
-- Aplicada em producao via MCP em 2026-07-27 (Barretos).
--
-- ORIGEM: o importador da NF-e 139295 gravou data_fab e data_val invertidas
-- em 9 lotes de probiotico. Eles foram baixados como "vencidos" sem estarem —
-- 900 g / R$ 2.691 dados como descartados por engano.
--
-- Como validade e sempre posterior a fabricacao, a inversao SEMPRE produz
-- data_fab > data_val. Esta constraint torna o defeito impossivel de persistir.
--
-- EFEITO COLATERAL ESPERADO: a proxima nota do mesmo fornecedor, com o mesmo
-- formato de <infAdProd>, vai FALHAR na importacao em vez de gravar dado errado
-- em silencio. Isso e intencional — falha visivel e melhor que dado corrompido.
-- A causa raiz (parser de infAdProd em supabase-nfe-import.ts) segue no backlog.
--
-- VERIFICADO ANTES DE APLICAR: 0 violacoes em 229 lotes (todos os tenants).
-- =====================================================================

alter table public.estoque_lotes
  add constraint estoque_lotes_fab_antes_val
  check (data_fab is null or data_val is null or data_fab <= data_val);

comment on constraint estoque_lotes_fab_antes_val on public.estoque_lotes is
  'Fabricacao nunca posterior a validade. Ver incidente da NF-e 139295 em 28/07/2026.';
