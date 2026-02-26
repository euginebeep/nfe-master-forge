
-- MIGRAÇÃO SEGURANÇA MULTI-TENANT v4 (colunas verificadas)

-- 1. COMPANY
DROP POLICY IF EXISTS "Allow all for company" ON public.company;
CREATE POLICY "tenant_select_company" ON public.company FOR SELECT TO authenticated USING (id = public.get_user_company_id());
CREATE POLICY "tenant_update_company" ON public.company FOR UPDATE TO authenticated USING (id = public.get_user_company_id()) WITH CHECK (id = public.get_user_company_id());
CREATE POLICY "tenant_insert_company" ON public.company FOR INSERT TO authenticated WITH CHECK (true);

-- 2. HELPER FUNCTIONS
CREATE OR REPLACE FUNCTION public.entidade_belongs_to_tenant(_eid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.entidades WHERE id = _eid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.item_belongs_to_tenant(_iid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.itens WHERE id = _iid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.formula_belongs_to_tenant(_fid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.formulas WHERE id = _fid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.lote_belongs_to_tenant(_lid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.estoque_lotes WHERE id = _lid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.op_belongs_to_tenant(_oid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.ordens_producao_industrial WHERE id = _oid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.nota_saida_belongs_to_tenant(_nid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.notas_saida WHERE id = _nid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.orcamento_belongs_to_tenant(_oid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.orcamentos WHERE id = _oid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.pedido_belongs_to_tenant(_pid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.pedidos_venda WHERE id = _pid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.nota_entrada_belongs_to_tenant(_nid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.notas_entrada WHERE id = _nid AND company_id = public.get_user_company_id()) $$;
CREATE OR REPLACE FUNCTION public.custo_op_belongs_to_tenant(_cid uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$ SELECT EXISTS (SELECT 1 FROM public.custos_op co JOIN public.ordens_producao_industrial opi ON opi.id = co.op_id WHERE co.id = _cid AND opi.company_id = public.get_user_company_id()) $$;

-- 3. ENTIDADE CHILDREN
DROP POLICY IF EXISTS "Allow all for entidade_contatos" ON public.entidade_contatos;
DROP POLICY IF EXISTS "Authenticated users can manage entidade_contatos" ON public.entidade_contatos;
CREATE POLICY "t_entidade_contatos" ON public.entidade_contatos FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(entidade_id)) WITH CHECK (public.entidade_belongs_to_tenant(entidade_id));
DROP POLICY IF EXISTS "Allow all for entidade_enderecos" ON public.entidade_enderecos;
DROP POLICY IF EXISTS "Authenticated users can manage entidade_enderecos" ON public.entidade_enderecos;
CREATE POLICY "t_entidade_enderecos" ON public.entidade_enderecos FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(entidade_id)) WITH CHECK (public.entidade_belongs_to_tenant(entidade_id));
DROP POLICY IF EXISTS "Allow all for entidade_documentos" ON public.entidade_documentos;
DROP POLICY IF EXISTS "Authenticated users can manage entidade_documentos" ON public.entidade_documentos;
CREATE POLICY "t_entidade_documentos" ON public.entidade_documentos FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(entidade_id)) WITH CHECK (public.entidade_belongs_to_tenant(entidade_id));
DROP POLICY IF EXISTS "Allow all for entidade_comercial_crm" ON public.entidade_comercial_crm;
DROP POLICY IF EXISTS "Authenticated users can manage entidade_comercial_crm" ON public.entidade_comercial_crm;
CREATE POLICY "t_entidade_crm" ON public.entidade_comercial_crm FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(entidade_id)) WITH CHECK (public.entidade_belongs_to_tenant(entidade_id));
DROP POLICY IF EXISTS "Allow all for entidade_financeiro_config" ON public.entidade_financeiro_config;
DROP POLICY IF EXISTS "Authenticated users can manage entidade_financeiro_config" ON public.entidade_financeiro_config;
CREATE POLICY "t_entidade_fin" ON public.entidade_financeiro_config FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(entidade_id)) WITH CHECK (public.entidade_belongs_to_tenant(entidade_id));
DROP POLICY IF EXISTS "Allow all for entidade_fiscal_config" ON public.entidade_fiscal_config;
DROP POLICY IF EXISTS "Authenticated users can manage entidade_fiscal_config" ON public.entidade_fiscal_config;
CREATE POLICY "t_entidade_fisc" ON public.entidade_fiscal_config FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(entidade_id)) WITH CHECK (public.entidade_belongs_to_tenant(entidade_id));
DROP POLICY IF EXISTS "Allow all for entidade_logistica_config" ON public.entidade_logistica_config;
DROP POLICY IF EXISTS "Authenticated users can manage entidade_logistica_config" ON public.entidade_logistica_config;
CREATE POLICY "t_entidade_log" ON public.entidade_logistica_config FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(entidade_id)) WITH CHECK (public.entidade_belongs_to_tenant(entidade_id));
DROP POLICY IF EXISTS "Allow all for entidade_papeis" ON public.entidade_papeis;
DROP POLICY IF EXISTS "Authenticated users can manage entidade_papeis" ON public.entidade_papeis;
CREATE POLICY "t_entidade_papeis" ON public.entidade_papeis FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(entidade_id)) WITH CHECK (public.entidade_belongs_to_tenant(entidade_id));
DROP POLICY IF EXISTS "Allow all for avaliacoes_fornecedor" ON public.avaliacoes_fornecedor;
CREATE POLICY "t_aval_forn" ON public.avaliacoes_fornecedor FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(fornecedor_id)) WITH CHECK (public.entidade_belongs_to_tenant(fornecedor_id));
DROP POLICY IF EXISTS "Allow all for ranking_fornecedores" ON public.ranking_fornecedores;
CREATE POLICY "t_rank_forn" ON public.ranking_fornecedores FOR ALL TO authenticated USING (public.entidade_belongs_to_tenant(fornecedor_id)) WITH CHECK (public.entidade_belongs_to_tenant(fornecedor_id));

-- 4. ITEM CHILDREN
DROP POLICY IF EXISTS "Allow all for item_alias" ON public.item_alias;
DROP POLICY IF EXISTS "Authenticated users can manage item_alias" ON public.item_alias;
CREATE POLICY "t_item_alias" ON public.item_alias FOR ALL TO authenticated USING (public.item_belongs_to_tenant(item_id)) WITH CHECK (public.item_belongs_to_tenant(item_id));
DROP POLICY IF EXISTS "Allow all for item_fornecedores" ON public.item_fornecedores;
DROP POLICY IF EXISTS "Authenticated users can manage item_fornecedores" ON public.item_fornecedores;
CREATE POLICY "t_item_forn" ON public.item_fornecedores FOR ALL TO authenticated USING (public.item_belongs_to_tenant(item_id)) WITH CHECK (public.item_belongs_to_tenant(item_id));
DROP POLICY IF EXISTS "Auth users can manage catalogo_precos" ON public.catalogo_precos;
CREATE POLICY "t_catalogo" ON public.catalogo_precos FOR ALL TO authenticated USING (public.item_belongs_to_tenant(item_id)) WITH CHECK (public.item_belongs_to_tenant(item_id));

-- 5. FORMULA CHILDREN
DROP POLICY IF EXISTS "Allow all for formula_itens" ON public.formula_itens;
DROP POLICY IF EXISTS "Authenticated users can manage formula_itens" ON public.formula_itens;
CREATE POLICY "t_formula_itens" ON public.formula_itens FOR ALL TO authenticated USING (public.formula_belongs_to_tenant(formula_id)) WITH CHECK (public.formula_belongs_to_tenant(formula_id));
DROP POLICY IF EXISTS "Allow all for formula_versoes" ON public.formula_versoes;
DROP POLICY IF EXISTS "Authenticated users can manage formula_versoes" ON public.formula_versoes;
CREATE POLICY "t_formula_ver" ON public.formula_versoes FOR ALL TO authenticated USING (public.formula_belongs_to_tenant(formula_id)) WITH CHECK (public.formula_belongs_to_tenant(formula_id));
DROP POLICY IF EXISTS "Allow all for alegacoes_anvisa" ON public.alegacoes_anvisa;
CREATE POLICY "t_alegacoes" ON public.alegacoes_anvisa FOR ALL TO authenticated USING (public.formula_belongs_to_tenant(formula_id)) WITH CHECK (public.formula_belongs_to_tenant(formula_id));
DROP POLICY IF EXISTS "Allow all for tabelas_nutricionais" ON public.tabelas_nutricionais;
DROP POLICY IF EXISTS "Authenticated users can manage tabelas_nutricionais" ON public.tabelas_nutricionais;
CREATE POLICY "t_tab_nutri" ON public.tabelas_nutricionais FOR ALL TO authenticated USING (public.formula_belongs_to_tenant(formula_id)) WITH CHECK (public.formula_belongs_to_tenant(formula_id));

-- 6. LOTE CHILDREN
DROP POLICY IF EXISTS "Allow all for lote_documentos" ON public.lote_documentos;
DROP POLICY IF EXISTS "Authenticated users can manage lote_documentos" ON public.lote_documentos;
CREATE POLICY "t_lote_docs" ON public.lote_documentos FOR ALL TO authenticated USING (public.lote_belongs_to_tenant(lote_id)) WITH CHECK (public.lote_belongs_to_tenant(lote_id));
DROP POLICY IF EXISTS "Allow all for lote_materias_primas" ON public.lote_materias_primas;
DROP POLICY IF EXISTS "Authenticated users can manage lote_materias_primas" ON public.lote_materias_primas;
-- lote_materias_primas → lote_produto_acabado_id → lotes_produto_acabado.op_id
CREATE POLICY "t_lote_mp" ON public.lote_materias_primas FOR ALL TO authenticated USING (public.op_belongs_to_tenant((SELECT op_id FROM public.lotes_produto_acabado WHERE id = lote_produto_acabado_id))) WITH CHECK (public.op_belongs_to_tenant((SELECT op_id FROM public.lotes_produto_acabado WHERE id = lote_produto_acabado_id)));
DROP POLICY IF EXISTS "Allow all for rastreabilidade_lote_mp" ON public.rastreabilidade_lote_mp;
DROP POLICY IF EXISTS "Authenticated users can manage rastreabilidade_lote_mp" ON public.rastreabilidade_lote_mp;
CREATE POLICY "t_rastreab" ON public.rastreabilidade_lote_mp FOR ALL TO authenticated USING (public.lote_belongs_to_tenant(lote_mp_id)) WITH CHECK (public.lote_belongs_to_tenant(lote_mp_id));
DROP POLICY IF EXISTS "Allow all for lotes_produto_acabado" ON public.lotes_produto_acabado;
DROP POLICY IF EXISTS "Authenticated users can manage lotes_produto_acabado" ON public.lotes_produto_acabado;
CREATE POLICY "t_lotes_pa" ON public.lotes_produto_acabado FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));

-- 7. OP CHILDREN
DROP POLICY IF EXISTS "Allow all for op_materias_primas" ON public.op_materias_primas;
CREATE POLICY "t_op_mp" ON public.op_materias_primas FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for op_embalagens" ON public.op_embalagens;
CREATE POLICY "t_op_emb" ON public.op_embalagens FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for op_checklist" ON public.op_checklist;
CREATE POLICY "t_op_check" ON public.op_checklist FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for op_historico_etapas" ON public.op_historico_etapas;
CREATE POLICY "t_op_hist" ON public.op_historico_etapas FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for op_controle_qualidade" ON public.op_controle_qualidade;
CREATE POLICY "t_op_qc" ON public.op_controle_qualidade FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for op_controle_perdas" ON public.op_controle_perdas;
CREATE POLICY "t_op_perdas" ON public.op_controle_perdas FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for op_pesagens_criticas" ON public.op_pesagens_criticas;
CREATE POLICY "t_op_pesag" ON public.op_pesagens_criticas FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for op_anexos" ON public.op_anexos;
CREATE POLICY "t_op_anexos" ON public.op_anexos FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for op_assinaturas_rt" ON public.op_assinaturas_rt;
CREATE POLICY "t_op_assrt" ON public.op_assinaturas_rt FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for custos_op" ON public.custos_op;
CREATE POLICY "t_custos_op" ON public.custos_op FOR ALL TO authenticated USING (public.op_belongs_to_tenant(op_id)) WITH CHECK (public.op_belongs_to_tenant(op_id));
DROP POLICY IF EXISTS "Allow all for custos_op_lotes" ON public.custos_op_lotes;
CREATE POLICY "t_custos_lotes" ON public.custos_op_lotes FOR ALL TO authenticated USING (public.custo_op_belongs_to_tenant(custo_op_id)) WITH CHECK (public.custo_op_belongs_to_tenant(custo_op_id));

-- 8. NOTA CHILDREN (nota_saida_id)
DROP POLICY IF EXISTS "Allow all for notas_saida_itens" ON public.notas_saida_itens;
DROP POLICY IF EXISTS "Authenticated users can manage notas_saida_itens" ON public.notas_saida_itens;
CREATE POLICY "t_ns_itens" ON public.notas_saida_itens FOR ALL TO authenticated USING (public.nota_saida_belongs_to_tenant(nota_saida_id)) WITH CHECK (public.nota_saida_belongs_to_tenant(nota_saida_id));
DROP POLICY IF EXISTS "Allow all for notas_entrada_itens" ON public.notas_entrada_itens;
DROP POLICY IF EXISTS "tenant_all_notas_entrada_itens" ON public.notas_entrada_itens;
CREATE POLICY "t_ne_itens" ON public.notas_entrada_itens FOR ALL TO authenticated USING (public.nota_entrada_belongs_to_tenant(nota_entrada_id)) WITH CHECK (public.nota_entrada_belongs_to_tenant(nota_entrada_id));

-- 9. ORCAMENTO CHILDREN (orcamento_itens has orcamento_id)
DROP POLICY IF EXISTS "Allow all for orcamento_itens" ON public.orcamento_itens;
DROP POLICY IF EXISTS "Authenticated users can manage orcamento_itens" ON public.orcamento_itens;
CREATE POLICY "t_orc_itens" ON public.orcamento_itens FOR ALL TO authenticated USING (public.orcamento_belongs_to_tenant(orcamento_id)) WITH CHECK (public.orcamento_belongs_to_tenant(orcamento_id));

-- ordens_producao_geradas uses formula_id (NOT orcamento_id)
DROP POLICY IF EXISTS "Allow all for ordens_producao_geradas" ON public.ordens_producao_geradas;
DROP POLICY IF EXISTS "Authenticated users can manage ordens_producao_geradas" ON public.ordens_producao_geradas;
CREATE POLICY "t_op_geradas" ON public.ordens_producao_geradas FOR ALL TO authenticated USING (public.formula_belongs_to_tenant(formula_id)) WITH CHECK (public.formula_belongs_to_tenant(formula_id));

-- pedido_itens uses pedido_id
DROP POLICY IF EXISTS "Allow all for pedido_itens" ON public.pedido_itens;
DROP POLICY IF EXISTS "Authenticated users can manage pedido_itens" ON public.pedido_itens;
CREATE POLICY "t_ped_itens" ON public.pedido_itens FOR ALL TO authenticated USING (public.pedido_belongs_to_tenant(pedido_id)) WITH CHECK (public.pedido_belongs_to_tenant(pedido_id));

-- 10. ADD company_id TO MISSING TABLES
ALTER TABLE public.responsaveis_tecnicos ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for responsaveis_tecnicos" ON public.responsaveis_tecnicos;
DROP POLICY IF EXISTS "Authenticated users can manage responsaveis_tecnicos" ON public.responsaveis_tecnicos;
CREATE POLICY "t_rt" ON public.responsaveis_tecnicos FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.contratos_templates ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for contratos_templates" ON public.contratos_templates;
DROP POLICY IF EXISTS "Authenticated users can manage contratos_templates" ON public.contratos_templates;
CREATE POLICY "t_contratos" ON public.contratos_templates FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "Allow all for notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "notif_sel" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_upd" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_ins" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notif_del" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.config_capacidade_producao ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for config_capacidade_producao" ON public.config_capacidade_producao;
CREATE POLICY "t_cfg_cap" ON public.config_capacidade_producao FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.config_custos_producao ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for config_custos_producao" ON public.config_custos_producao;
CREATE POLICY "t_cfg_custo" ON public.config_custos_producao FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for audit_log" ON public.audit_log;
CREATE POLICY "t_audit" ON public.audit_log FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.audit_trail_imutavel ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Insert only for audit_trail_imutavel" ON public.audit_trail_imutavel;
DROP POLICY IF EXISTS "Read only for audit_trail_imutavel" ON public.audit_trail_imutavel;
CREATE POLICY "t_audit_sel" ON public.audit_trail_imutavel FOR SELECT TO authenticated USING (company_id = public.get_user_company_id());
CREATE POLICY "t_audit_ins" ON public.audit_trail_imutavel FOR INSERT TO authenticated WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.alertas_executivos ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for alertas_executivos" ON public.alertas_executivos;
CREATE POLICY "t_alertas" ON public.alertas_executivos FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.anomalias_operacionais ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for anomalias_operacionais" ON public.anomalias_operacionais;
CREATE POLICY "t_anomalias" ON public.anomalias_operacionais FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.kpis_executivos ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for kpis_executivos" ON public.kpis_executivos;
CREATE POLICY "t_kpis" ON public.kpis_executivos FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.previsoes_producao ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for previsoes_producao" ON public.previsoes_producao;
CREATE POLICY "t_previsoes" ON public.previsoes_producao FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.sugestoes_otimizacao ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for sugestoes_otimizacao" ON public.sugestoes_otimizacao;
CREATE POLICY "t_sugestoes" ON public.sugestoes_otimizacao FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.simulacoes_producao ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for simulacoes_producao" ON public.simulacoes_producao;
CREATE POLICY "t_simul" ON public.simulacoes_producao FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.log_validacoes_anvisa ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for log_validacoes_anvisa" ON public.log_validacoes_anvisa;
CREATE POLICY "t_log_anvisa" ON public.log_validacoes_anvisa FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.trilha_auditoria_tecnica ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for trilha_auditoria_tecnica" ON public.trilha_auditoria_tecnica;
CREATE POLICY "t_trilha" ON public.trilha_auditoria_tecnica FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.versoes_parametros_industriais ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for versoes_parametros_industriais" ON public.versoes_parametros_industriais;
CREATE POLICY "t_versoes_param" ON public.versoes_parametros_industriais FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.arquivos ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for arquivos" ON public.arquivos;
CREATE POLICY "t_arquivos" ON public.arquivos FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

ALTER TABLE public.regras_anvisa ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();
DROP POLICY IF EXISTS "Allow all for regras_anvisa" ON public.regras_anvisa;
CREATE POLICY "t_regras" ON public.regras_anvisa FOR ALL TO authenticated USING (company_id = public.get_user_company_id()) WITH CHECK (company_id = public.get_user_company_id());

-- 11. ENABLE RLS ON ALL
ALTER TABLE public.entidade_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_enderecos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_comercial_crm ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_financeiro_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_fiscal_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_logistica_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entidade_papeis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avaliacoes_fornecedor ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ranking_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_alias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalogo_precos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.formula_versoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alegacoes_anvisa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tabelas_nutricionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote_documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lote_materias_primas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rastreabilidade_lote_mp ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lotes_produto_acabado ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_materias_primas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_embalagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_checklist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_historico_etapas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_controle_qualidade ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_controle_perdas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_pesagens_criticas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.op_assinaturas_rt ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_op ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custos_op_lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_saida_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orcamento_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordens_producao_geradas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responsaveis_tecnicos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_capacidade_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config_custos_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_trail_imutavel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alertas_executivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anomalias_operacionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kpis_executivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.previsoes_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sugestoes_otimizacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulacoes_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.log_validacoes_anvisa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trilha_auditoria_tecnica ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versoes_parametros_industriais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.arquivos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regras_anvisa ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company ENABLE ROW LEVEL SECURITY;
