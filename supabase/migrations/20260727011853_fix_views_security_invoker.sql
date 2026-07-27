-- ============================================================
-- ITEM 1 — Fecha vazamento cross-tenant em 3 views
-- Aplicado em produção via MCP em 2026-07-26.
-- Sem security_invoker, a view roda como o dono (postgres) e NÃO aplica
-- o RLS das tabelas de base, expondo todos os tenants. Com invoker=on,
-- roda com as permissões do chamador -> RLS de itens/notas_entrada isola.
-- Reversível: SET (security_invoker = off).
-- ============================================================
ALTER VIEW public.anvisa_itens_sem_vinculo SET (security_invoker = on);
ALTER VIEW public.item_historico_compra   SET (security_invoker = on);
ALTER VIEW public.v_notas_sem_xml          SET (security_invoker = on);

