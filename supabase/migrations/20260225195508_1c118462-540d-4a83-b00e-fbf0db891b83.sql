
-- Auto-populate company_id on INSERT using the logged-in user's company
ALTER TABLE public.entidades ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.itens ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.estoque_lotes ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.estoque_movimentacoes ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.notas_entrada ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.notas_entrada_itens ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.orcamentos ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.pedidos_venda ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.notas_saida ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.contas_receber ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.qc_analises ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.qc_desvios ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.qc_calibracoes ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.formulas ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
ALTER TABLE public.ordens_producao_industrial ALTER COLUMN company_id SET DEFAULT public.get_user_company_id();
