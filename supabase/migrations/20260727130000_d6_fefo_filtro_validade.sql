-- ============================================================
-- D6 — FEFO nunca escolhe lote vencido (preparar_op_materiais)
-- Aplicado em producao via MCP em 2026-07-27.
-- Politica RT (Camila), 2026-07-27:
--   * QUARENTENA nao-vencida ENTRA na producao (material ja comprado, aguarda
--     liberacao; aviso "requer liberacao da RT" mantido).
--   * VENCIDO nunca entra — nem na escolha do lote, nem na soma de disponivel.
--   * data_val NULL = tratado como nao-vencido (nao bloqueia lote sem validade).
--   * Se ha saldo mas todo vencido: observacao "SEM LOTE VALIDO" em vez de silencio.
-- Muda SO o comportamento de selecao; assinatura e retorno identicos (p_op_id uuid -> jsonb).
-- 4 filtros "(data_val IS NULL OR data_val >= current_date)" adicionados.
-- Reversivel: CREATE OR REPLACE com o corpo anterior (sem os filtros).
-- ============================================================

CREATE OR REPLACE FUNCTION public.preparar_op_materiais(p_op_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_op ordens_producao_industrial%ROWTYPE;
  v_caps numeric; v_fill_mg numeric; v_fill_total_mg numeric; v_frascos int; v_company uuid;
  v_ativos_mg numeric := 0; v_tec_mg numeric := 0; v_ordem int := 0; v_req_id uuid;
  v_cap_id uuid; v_pote_id uuid; v_tampa_id uuid;
  r record; v_lote record;
  v_div numeric; v_need_int numeric; v_avail numeric; v_short numeric; v_obs text;
  v_mp int := 0; v_emb int := 0; v_req int := 0;
  v_tem_vencido boolean;
BEGIN
  SELECT * INTO v_op FROM ordens_producao_industrial WHERE id = p_op_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OP nao encontrada'; END IF;
  IF v_op.status <> 'PLANEJADA' THEN
    RAISE EXCEPTION 'OP % esta % (preparo permitido apenas em PLANEJADA)', v_op.codigo, v_op.status;
  END IF;
  v_caps := v_op.total_capsulas_com_acrescimo;
  v_fill_mg := COALESCE(v_op.peso_capsula_mg, 500);
  v_fill_total_mg := v_fill_mg * v_caps;
  v_frascos := v_op.quantidade_frascos;
  v_company := v_op.company_id;

  DELETE FROM requisicoes_compra_itens WHERE requisicao_id IN (SELECT id FROM requisicoes_compra WHERE op_id=p_op_id);
  DELETE FROM requisicoes_compra WHERE op_id=p_op_id;
  DELETE FROM op_materias_primas WHERE op_id=p_op_id;
  DELETE FROM op_embalagens WHERE op_id=p_op_id;

  SELECT id INTO v_cap_id   FROM itens WHERE company_id=v_company AND descricao_interna = v_op.capsula_item_nome LIMIT 1;
  SELECT id INTO v_pote_id  FROM itens WHERE company_id=v_company AND descricao_interna = v_op.pote_item_nome    LIMIT 1;
  SELECT id INTO v_tampa_id FROM itens WHERE company_id=v_company AND descricao_interna = v_op.tampa_item_nome   LIMIT 1;
  UPDATE ordens_producao_industrial SET capsula_item_id=v_cap_id, pote_item_id=v_pote_id, tampa_item_id=v_tampa_id, updated_at=now() WHERE id=p_op_id;

  SELECT COALESCE(SUM(fi.quantidade_convertida_mg * v_caps),0) INTO v_ativos_mg
  FROM formula_itens fi WHERE fi.formula_id = v_op.formula_id;
  SELECT COALESCE(SUM((c.percentual/100.0) * v_fill_total_mg),0) INTO v_tec_mg
  FROM op_excipientes_config c
  WHERE c.company_id=v_company AND c.ativo AND c.categoria='EXCIPIENTE_TECNOLOGICO' AND c.item_id IS NOT NULL;

  FOR r IN
    SELECT * FROM (
      SELECT fi.produto_materia_prima_id AS item_id, fi.nome_insumo AS nome, 'ATIVO'::text AS cat,
             fi.quantidade_convertida_mg * v_caps AS need_mg, it.unidade_interna AS ui, 0 AS ord0
      FROM formula_itens fi JOIN itens it ON it.id=fi.produto_materia_prima_id
      WHERE fi.formula_id = v_op.formula_id
      UNION ALL
      SELECT c.item_id, c.nome, 'EXCIPIENTE_TECNOLOGICO',
             (c.percentual/100.0) * v_fill_total_mg,
             (SELECT unidade_interna FROM itens WHERE id=c.item_id), 100 + c.ordem
      FROM op_excipientes_config c
      WHERE c.company_id=v_company AND c.ativo AND c.categoria='EXCIPIENTE_TECNOLOGICO' AND c.item_id IS NOT NULL
      UNION ALL
      SELECT b.item_id, b.nome, 'EXCIPIENTE_BASE',
             GREATEST(v_fill_total_mg - v_ativos_mg - v_tec_mg, 0),
             (SELECT unidade_interna FROM itens WHERE id=b.item_id), 999
      FROM (SELECT item_id, nome FROM op_excipientes_config
            WHERE company_id=v_company AND ativo AND categoria='EXCIPIENTE_BASE' AND item_id IS NOT NULL
            ORDER BY ordem LIMIT 1) b
    ) src ORDER BY ord0
  LOOP
      v_ordem := v_ordem + 1;
      v_div := CASE lower(COALESCE(r.ui,'g')) WHEN 'mg' THEN 1 WHEN 'g' THEN 1000 WHEN 'kg' THEN 1000000 ELSE 1000 END;
      v_need_int := r.need_mg / v_div;
      -- D6: soma de disponivel EXCLUI vencido
      SELECT COALESCE(SUM(quantidade_interna),0) INTO v_avail FROM estoque_lotes
        WHERE item_id=r.item_id AND status IN ('DISPONIVEL','QUARENTENA')
          AND (data_val IS NULL OR data_val >= current_date);
      -- D6: selecao FEFO NUNCA escolhe vencido
      SELECT * INTO v_lote FROM estoque_lotes
        WHERE item_id=r.item_id AND status IN ('DISPONIVEL','QUARENTENA') AND quantidade_interna>0
          AND (data_val IS NULL OR data_val >= current_date)
        ORDER BY (status='DISPONIVEL') DESC, data_val ASC NULLS LAST LIMIT 1;
      -- D6: detecta se ha saldo, mas SO vencido (para sinalizar em vez de silenciar)
      SELECT EXISTS(SELECT 1 FROM estoque_lotes WHERE item_id=r.item_id AND quantidade_interna>0
        AND data_val < current_date AND status IN ('DISPONIVEL','QUARENTENA','VENCIDO')) INTO v_tem_vencido;
      v_obs := NULL;
      IF v_lote.id IS NULL AND v_tem_vencido THEN
        v_obs := 'SEM LOTE VALIDO: existe saldo, mas todo vencido. Requer compra ou reavaliacao da RT.';
      ELSIF v_lote.id IS NOT NULL AND v_lote.status='QUARENTENA' THEN
        v_obs := 'Lote em QUARENTENA - requer liberacao da RT antes da pesagem';
      END IF;
      INSERT INTO op_materias_primas
        (op_id,insumo_id,insumo_nome,categoria,quantidade_teorica_mg,quantidade_teorica_g,unidade,ordem_mistura,lote_id,numero_lote,data_fabricacao,data_validade,fornecedor_id,fornecedor_nome,observacoes,tolerancia_percentual,quantidade_minima_g,quantidade_maxima_g)
      VALUES (p_op_id,r.item_id,r.nome,r.cat,r.need_mg,r.need_mg/1000,COALESCE(r.ui,'g'),v_ordem,v_lote.id,v_lote.numero_lote,v_lote.data_fab,v_lote.data_val,v_lote.fornecedor_id,(SELECT razao_social FROM entidades WHERE id=v_lote.fornecedor_id),v_obs,10,ROUND((r.need_mg/1000.0*0.9)::numeric,4),ROUND((r.need_mg/1000.0*1.1)::numeric,4));
      v_mp := v_mp + 1;
      v_short := v_need_int - v_avail;
      IF v_short > 0 THEN
        v_req_id := (SELECT id FROM requisicoes_compra WHERE op_id=p_op_id LIMIT 1);
        IF v_req_id IS NULL THEN INSERT INTO requisicoes_compra(op_id,company_id,status,origem,observacoes) VALUES(p_op_id,v_company,'ABERTA','MRP','Gerada pelo preparo da '||v_op.codigo) RETURNING id INTO v_req_id; END IF;
        INSERT INTO requisicoes_compra_itens (requisicao_id,item_id,item_nome,quantidade_necessaria,quantidade_disponivel,quantidade_faltante,unidade,status)
        VALUES(v_req_id,r.item_id,r.nome,v_need_int,v_avail,v_short,COALESCE(r.ui,'g'),'ABERTA');
        v_req := v_req + 1;
      END IF;
  END LOOP;

  FOR r IN
      SELECT 'OUTRO' AS tipo, v_cap_id AS item_id, v_op.capsula_item_nome AS nome, v_caps::numeric AS need
      UNION ALL SELECT 'POTE', v_pote_id, v_op.pote_item_nome, v_frascos::numeric
      UNION ALL SELECT 'TAMPA', v_tampa_id, v_op.tampa_item_nome, v_frascos::numeric
  LOOP
      -- D6: embalagem tambem exclui vencido
      SELECT COALESCE(SUM(quantidade_interna),0) INTO v_avail FROM estoque_lotes
        WHERE item_id=r.item_id AND status IN ('DISPONIVEL','QUARENTENA')
          AND (data_val IS NULL OR data_val >= current_date);
      SELECT * INTO v_lote FROM estoque_lotes
        WHERE item_id=r.item_id AND status IN ('DISPONIVEL','QUARENTENA') AND quantidade_interna>0
          AND (data_val IS NULL OR data_val >= current_date)
        ORDER BY (status='DISPONIVEL') DESC, data_val ASC NULLS LAST LIMIT 1;
      INSERT INTO op_embalagens (op_id,tipo_embalagem,insumo_id,insumo_nome,lote_id,numero_lote,data_fabricacao,data_validade,quantidade_planejada,status)
      VALUES(p_op_id,r.tipo,r.item_id,COALESCE(r.nome,r.tipo),v_lote.id,v_lote.numero_lote,v_lote.data_fab,v_lote.data_val,CEIL(r.need)::int,'PENDENTE');
      v_emb := v_emb + 1;
      v_short := r.need - v_avail;
      IF v_short > 0 THEN
        v_req_id := (SELECT id FROM requisicoes_compra WHERE op_id=p_op_id LIMIT 1);
        IF v_req_id IS NULL THEN INSERT INTO requisicoes_compra(op_id,company_id,status,origem,observacoes) VALUES(p_op_id,v_company,'ABERTA','MRP','Gerada pelo preparo da '||v_op.codigo) RETURNING id INTO v_req_id; END IF;
        INSERT INTO requisicoes_compra_itens (requisicao_id,item_id,item_nome,quantidade_necessaria,quantidade_disponivel,quantidade_faltante,unidade,status)
        VALUES(v_req_id,r.item_id,COALESCE(r.nome,r.tipo),r.need,v_avail,v_short,'un','ABERTA');
        v_req := v_req + 1;
      END IF;
  END LOOP;

  RETURN jsonb_build_object('op', v_op.codigo, 'materias_primas', v_mp, 'embalagens', v_emb,
    'itens_para_comprar', v_req, 'possui_requisicao', (v_req > 0),
    'sem_config_excipientes', NOT EXISTS (SELECT 1 FROM op_excipientes_config WHERE company_id=v_company AND ativo AND item_id IS NOT NULL));
END; $function$;

