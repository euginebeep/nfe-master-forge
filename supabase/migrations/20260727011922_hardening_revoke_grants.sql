-- ============================================================
-- ITEM 2 — Endurecimento de grants multi-tenant
-- Aplicado em produção via MCP em 2026-07-26.
-- Auditoria do frontend (zip 33): usuário logado opera como 'authenticated'.
-- anon (chave pública do bundle) só precisa escrever em demo_leads (lead pré-login).
-- RPCs públicas (get_lote_publico) são SECURITY DEFINER -> ignoram grant de tabela.
--
-- (a) Revoga INSERT/UPDATE/DELETE/TRUNCATE de anon em todas as tabelas e views,
--     exceto INSERT/UPDATE em demo_leads.
-- (b) Revoga TRUNCATE de authenticated em tudo (TRUNCATE ignora RLS).
-- anon MANTÉM SELECT (páginas públicas). authenticated MANTÉM escrita (app logado).
-- ============================================================

-- Tabelas base (exceto demo_leads)
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relname <> 'demo_leads'
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon;', r.relname);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated;', r.relname);
  END LOOP;
  EXECUTE 'REVOKE DELETE, TRUNCATE ON public.demo_leads FROM anon;';
  EXECUTE 'REVOKE TRUNCATE ON public.demo_leads FROM authenticated;';
END $$;

-- Views (relkind='v') — ficaram de fora do loop de tabelas
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='v'
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon;', r.relname);
    EXECUTE format('REVOKE TRUNCATE ON public.%I FROM authenticated;', r.relname);
  END LOOP;
END $$;

