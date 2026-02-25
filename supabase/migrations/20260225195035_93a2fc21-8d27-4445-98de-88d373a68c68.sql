
-- =====================================================
-- MULTI-TENANT: Colunas + Índices + Constraints + RLS
-- =====================================================

-- 1. profiles.company_id (nullable)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.company(id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- 2. Tabelas de negócio que NÃO têm company_id ainda
ALTER TABLE public.entidades ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.itens ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.estoque_lotes ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.estoque_movimentacoes ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.notas_entrada_itens ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.orcamentos ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.pedidos_venda ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.notas_saida ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.contas_receber ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.qc_analises ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.qc_desvios ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.qc_calibracoes ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.formulas ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);
ALTER TABLE public.ordens_producao_industrial ADD COLUMN company_id UUID NOT NULL REFERENCES public.company(id);

-- 2b. notas_entrada já tem company_id mas nullable sem FK - corrigir
ALTER TABLE public.notas_entrada ADD CONSTRAINT fk_notas_entrada_company FOREIGN KEY (company_id) REFERENCES public.company(id);
-- Não forçar NOT NULL pois pode ter dados (está vazia mas para segurança)
ALTER TABLE public.notas_entrada ALTER COLUMN company_id SET NOT NULL;

-- 3. Índices
CREATE INDEX idx_entidades_company_id ON public.entidades(company_id);
CREATE INDEX idx_itens_company_id ON public.itens(company_id);
CREATE INDEX idx_estoque_lotes_company_id ON public.estoque_lotes(company_id);
CREATE INDEX idx_estoque_movimentacoes_company_id ON public.estoque_movimentacoes(company_id);
CREATE INDEX IF NOT EXISTS idx_notas_entrada_company_id ON public.notas_entrada(company_id);
CREATE INDEX idx_notas_entrada_itens_company_id ON public.notas_entrada_itens(company_id);
CREATE INDEX idx_orcamentos_company_id ON public.orcamentos(company_id);
CREATE INDEX idx_pedidos_venda_company_id ON public.pedidos_venda(company_id);
CREATE INDEX idx_notas_saida_company_id ON public.notas_saida(company_id);
CREATE INDEX idx_contas_receber_company_id ON public.contas_receber(company_id);
CREATE INDEX idx_qc_analises_company_id ON public.qc_analises(company_id);
CREATE INDEX idx_qc_desvios_company_id ON public.qc_desvios(company_id);
CREATE INDEX idx_qc_calibracoes_company_id ON public.qc_calibracoes(company_id);
CREATE INDEX idx_formulas_company_id ON public.formulas(company_id);
CREATE INDEX idx_ordens_producao_industrial_company_id ON public.ordens_producao_industrial(company_id);

-- 4. Unique constraints com escopo de tenant
ALTER TABLE public.entidades ADD CONSTRAINT uq_entidades_documento_company UNIQUE(documento, company_id);
ALTER TABLE public.itens ADD CONSTRAINT uq_itens_sku_company UNIQUE(sku_interno, company_id);

-- 5. Função RLS para obter company_id do usuário
CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid()
$$;

-- 6. Drop old policies
DROP POLICY IF EXISTS "Allow all for entidades" ON public.entidades;
DROP POLICY IF EXISTS "Allow all for itens" ON public.itens;
DROP POLICY IF EXISTS "Allow all for estoque_lotes" ON public.estoque_lotes;
DROP POLICY IF EXISTS "Auth users can manage estoque_movimentacoes" ON public.estoque_movimentacoes;
DROP POLICY IF EXISTS "Allow all for notas_entrada" ON public.notas_entrada;
DROP POLICY IF EXISTS "Allow all for notas_entrada_itens" ON public.notas_entrada_itens;
DROP POLICY IF EXISTS "Allow all for orcamentos" ON public.orcamentos;
DROP POLICY IF EXISTS "Allow all for pedidos_venda" ON public.pedidos_venda;
DROP POLICY IF EXISTS "Auth users can manage notas_saida" ON public.notas_saida;
DROP POLICY IF EXISTS "Auth users can manage contas_receber" ON public.contas_receber;
DROP POLICY IF EXISTS "Auth users can manage qc_analises" ON public.qc_analises;
DROP POLICY IF EXISTS "Auth users can manage qc_desvios" ON public.qc_desvios;
DROP POLICY IF EXISTS "Auth users can manage qc_calibracoes" ON public.qc_calibracoes;
DROP POLICY IF EXISTS "Allow all for formulas" ON public.formulas;
DROP POLICY IF EXISTS "Allow all for ordens_producao_industrial" ON public.ordens_producao_industrial;

-- 7. Novas policies com filtro por company_id (15 tabelas x 4 operações = 60 policies)

CREATE POLICY "tenant_select_entidades" ON public.entidades FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_entidades" ON public.entidades FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_entidades" ON public.entidades FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_entidades" ON public.entidades FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_itens" ON public.itens FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_itens" ON public.itens FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_itens" ON public.itens FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_itens" ON public.itens FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_estoque_lotes" ON public.estoque_lotes FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_estoque_lotes" ON public.estoque_lotes FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_estoque_lotes" ON public.estoque_lotes FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_estoque_lotes" ON public.estoque_lotes FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_estoque_movimentacoes" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_estoque_movimentacoes" ON public.estoque_movimentacoes FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_estoque_movimentacoes" ON public.estoque_movimentacoes FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_estoque_movimentacoes" ON public.estoque_movimentacoes FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_notas_entrada" ON public.notas_entrada FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_notas_entrada" ON public.notas_entrada FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_notas_entrada" ON public.notas_entrada FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_notas_entrada" ON public.notas_entrada FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_notas_entrada_itens" ON public.notas_entrada_itens FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_notas_entrada_itens" ON public.notas_entrada_itens FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_notas_entrada_itens" ON public.notas_entrada_itens FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_notas_entrada_itens" ON public.notas_entrada_itens FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_orcamentos" ON public.orcamentos FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_pedidos_venda" ON public.pedidos_venda FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_pedidos_venda" ON public.pedidos_venda FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_pedidos_venda" ON public.pedidos_venda FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_pedidos_venda" ON public.pedidos_venda FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_notas_saida" ON public.notas_saida FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_notas_saida" ON public.notas_saida FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_notas_saida" ON public.notas_saida FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_notas_saida" ON public.notas_saida FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_contas_receber" ON public.contas_receber FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_contas_receber" ON public.contas_receber FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_contas_receber" ON public.contas_receber FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_contas_receber" ON public.contas_receber FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_qc_analises" ON public.qc_analises FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_qc_analises" ON public.qc_analises FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_qc_analises" ON public.qc_analises FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_qc_analises" ON public.qc_analises FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_qc_desvios" ON public.qc_desvios FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_qc_desvios" ON public.qc_desvios FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_qc_desvios" ON public.qc_desvios FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_qc_desvios" ON public.qc_desvios FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_qc_calibracoes" ON public.qc_calibracoes FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_qc_calibracoes" ON public.qc_calibracoes FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_qc_calibracoes" ON public.qc_calibracoes FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_qc_calibracoes" ON public.qc_calibracoes FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_formulas" ON public.formulas FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_formulas" ON public.formulas FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_formulas" ON public.formulas FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_formulas" ON public.formulas FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_select_ops" ON public.ordens_producao_industrial FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_insert_ops" ON public.ordens_producao_industrial FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "tenant_update_ops" ON public.ordens_producao_industrial FOR UPDATE TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "tenant_delete_ops" ON public.ordens_producao_industrial FOR DELETE TO authenticated USING (company_id = public.get_user_company_id());
