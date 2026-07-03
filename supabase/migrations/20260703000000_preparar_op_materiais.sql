-- ============================================================================
-- preparar_op_materiais — fonte única de preparo de materiais da OP
-- Explode a fórmula em op_materias_primas (ativos + excipientes técnicos 8% +
-- veículo base QSP), aloca lote por FEFO (DISPONIVEL antes de QUARENTENA),
-- vincula embalagens e gera requisição de compra para o que faltar.
-- Idempotente: só executa em OP com status = 'PLANEJADA'.
-- ============================================================================

-- 1. Colunas exigidas (guardadas por IF NOT EXISTS — seguras de reaplicar)
ALTER TABLE public.op_materias_primas
  ADD COLUMN IF NOT EXISTS lote_id         uuid,
  ADD COLUMN IF NOT EXISTS numero_lote     text,
  ADD COLUMN IF NOT EXISTS data_fabricacao date,
  ADD COLUMN IF NOT EXISTS data_validade   date,
  ADD COLUMN IF NOT EXISTS fornecedor_id   uuid,
  ADD COLUMN IF NOT EXISTS fornecedor_nome text,
  ADD COLUMN IF NOT EXISTS observacoes     text;

ALTER TABLE public.op_embalagens
  ADD COLUMN IF NOT EXISTS lote_id         uuid,
  ADD COLUMN IF NOT EXISTS numero_lote     text,
  ADD COLUMN IF NOT EXISTS data_fabricacao date,
  ADD COLUMN IF NOT EXISTS data_validade   date;

-- 2. Função
CREATE OR REPLACE FUNCTION public.preparar_op_materiais(p_op_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  v_op ordens_producao_industrial%ROWTYPE;
  v_caps numeric; v_fill_mg numeric; v_fill_total_mg numeric; v_frascos int; v_company uuid;
  v_ativos_mg numeric := 0; v_ordem int := 0; v_req_id uuid;
  v_cap_id uuid; v_pote_id uuid; v_tampa_id uuid;
  v_amido_id uuid; v_silica_id uuid; v_estear_id uuid; v_talco_id uuid;
  r record; v_lote record;
  v_div numeric; v_need_int numeric; v_avail numeric; v_short numeric; v_obs text;
  v_mp int := 0; v_emb int := 0; v_req int := 0;
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

  -- Resolução dos excipientes por nome (TODO: tornar configurável via parametros_industria)
  SELECT id INTO v_amido_id  FROM itens WHERE company_id=v_company AND descricao_interna ILIKE '%amido%'              ORDER BY created_at LIMIT 1;
  SELECT id INTO v_silica_id FROM itens WHERE company_id=v_company AND descricao_interna ILIKE '%tixosil%'            ORDER BY created_at LIMIT 1;
  SELECT id INTO v_estear_id FROM itens WHERE company_id=v_company AND descricao_interna ILIKE '%estearato%palmstar%' ORDER BY created_at LIMIT 1;
  SELECT id INTO v_talco_id  FROM itens WHERE company_id=v_company AND descricao_interna ILIKE '%talco%'              ORDER BY created_at LIMIT 1;

  SELECT id INTO v_cap_id   FROM itens WHERE company_id=v_company AND descricao_interna = v_op.capsula_item_nome LIMIT 1;
  SELECT id INTO v_pote_id  FROM itens WHERE company_id=v_company AND descricao_interna = v_op.pote_item_nome    LIMIT 1;
  SELECT id INTO v_tampa_id FROM itens WHERE company_id=v_company AND descricao_interna = v_op.tampa_item_nome   LIMIT 1;
  UPDATE ordens_producao_industrial
     SET capsula_item_id=v_cap_id, pote_item_id=v_pote_id, tampa_item_id=v_tampa_id, updated_at=now()
   WHERE id=p_op_id;

  -- massa dos ativos (por cápsula × total)
  SELECT COALESCE(SUM(fi.quantidade_convertida_mg * v_caps),0) INTO v_ativos_mg
  FROM formula_itens fi WHERE fi.formula_id = v_op.formula_id;

  FOR r IN
      SELECT fi.produto_materia_prima_id AS item_id, fi.nome_insumo AS nome, 'ATIVO' AS cat,
             fi.quantidade_convertida_mg * v_caps AS need_mg, it.unidade_interna AS ui
      FROM formula_itens fi JOIN itens it ON it.id=fi.produto_materia_prima_id
      WHERE fi.formula_id = v_op.formula_id
      UNION ALL SELECT v_silica_id,'Dioxido de Silicio (Tixosil) 2%','EXCIPIENTE_TECNOLOGICO',0.02*v_fill_total_mg,(SELECT unidade_interna FROM itens WHERE id=v_silica_id)
      UNION ALL SELECT v_estear_id,'Estearato de Magnesio 1%','EXCIPIENTE_TECNOLOGICO',0.01*v_fill_total_mg,(SELECT unidade_interna FROM itens WHERE id=v_estear_id)
      UNION ALL SELECT v_talco_id,'Talco 5%','EXCIPIENTE_TECNOLOGICO',0.05*v_fill_total_mg,(SELECT unidade_interna FROM itens WHERE id=v_talco_id)
      UNION ALL SELECT v_amido_id,'Amido (QSP veiculo base)','EXCIPIENTE_BASE',GREATEST(v_fill_total_mg - v_ativos_mg - 0.08*v_fill_total_mg,0),(SELECT unidade_interna FROM itens WHERE id=v_amido_id)
  LOOP
      v_ordem := v_ordem + 1;
      v_div := CASE lower(COALESCE(r.ui,'g')) WHEN 'mg' THEN 1 WHEN 'g' THEN 1000 WHEN 'kg' THEN 1000000 ELSE 1000 END;
      v_need_int := r.need_mg / v_div;

      SELECT COALESCE(SUM(quantidade_interna),0) INTO v_avail
        FROM estoque_lotes WHERE item_id=r.item_id AND status IN ('DISPONIVEL','QUARENTENA');

      SELECT * INTO v_lote FROM estoque_lotes
        WHERE item_id=r.item_id AND status IN ('DISPONIVEL','QUARENTENA') AND quantidade_interna>0
        ORDER BY (status='DISPONIVEL') DESC, data_val ASC NULLS LAST LIMIT 1;

      v_obs := NULL;
      IF v_lote.id IS NOT NULL AND v_lote.status='QUARENTENA' THEN
        v_obs := 'Lote em QUARENTENA - requer liberacao da RT antes da pesagem';
      END IF;

      INSERT INTO op_materias_primas
        (op_id,insumo_id,insumo_nome,categoria,quantidade_teorica_mg,quantidade_teorica_g,
         unidade,ordem_mistura,lote_id,numero_lote,data_fabricacao,data_validade,
         fornecedor_id,fornecedor_nome,observacoes)
      VALUES
        (p_op_id,r.item_id,r.nome,r.cat,r.need_mg,r.need_mg/1000,
         COALESCE(r.ui,'g'),v_ordem,v_lote.id,v_lote.numero_lote,v_lote.data_fab,v_lote.data_val,
         v_lote.fornecedor_id,(SELECT razao_social FROM entidades WHERE id=v_lote.fornecedor_id),v_obs);
      v_mp := v_mp + 1;

      v_short := v_need_int - v_avail;
      IF v_short > 0 THEN
        v_req_id := (SELECT id FROM requisicoes_compra WHERE op_id=p_op_id LIMIT 1);
        IF v_req_id IS NULL THEN
          INSERT INTO requisicoes_compra(op_id,company_id,status,origem,observacoes)
          VALUES(p_op_id,v_company,'ABERTA','MRP','Gerada pelo preparo da '||v_op.codigo) RETURNING id INTO v_req_id;
        END IF;
        INSERT INTO requisicoes_compra_itens
          (requisicao_id,item_id,item_nome,quantidade_necessaria,quantidade_disponivel,quantidade_faltante,unidade,status)
        VALUES(v_req_id,r.item_id,r.nome,v_need_int,v_avail,v_short,COALESCE(r.ui,'g'),'ABERTA');
        v_req := v_req + 1;
      END IF;
  END LOOP;

  FOR r IN
      SELECT 'OUTRO' AS tipo, v_cap_id  AS item_id, v_op.capsula_item_nome AS nome, v_caps::numeric AS need
      UNION ALL SELECT 'POTE',  v_pote_id,  v_op.pote_item_nome,  v_frascos::numeric
      UNION ALL SELECT 'TAMPA', v_tampa_id, v_op.tampa_item_nome, v_frascos::numeric
  LOOP
      SELECT COALESCE(SUM(quantidade_interna),0) INTO v_avail
        FROM estoque_lotes WHERE item_id=r.item_id AND status IN ('DISPONIVEL','QUARENTENA');
      SELECT * INTO v_lote FROM estoque_lotes
        WHERE item_id=r.item_id AND status IN ('DISPONIVEL','QUARENTENA') AND quantidade_interna>0
        ORDER BY (status='DISPONIVEL') DESC, data_val ASC NULLS LAST LIMIT 1;

      INSERT INTO op_embalagens
        (op_id,tipo_embalagem,insumo_id,insumo_nome,lote_id,numero_lote,data_fabricacao,data_validade,quantidade_planejada,status)
      VALUES(p_op_id,r.tipo,r.item_id,COALESCE(r.nome,r.tipo),v_lote.id,v_lote.numero_lote,v_lote.data_fab,v_lote.data_val,CEIL(r.need)::int,'PENDENTE');
      v_emb := v_emb + 1;

      v_short := r.need - v_avail;
      IF v_short > 0 THEN
        v_req_id := (SELECT id FROM requisicoes_compra WHERE op_id=p_op_id LIMIT 1);
        IF v_req_id IS NULL THEN
          INSERT INTO requisicoes_compra(op_id,company_id,status,origem,observacoes)
          VALUES(p_op_id,v_company,'ABERTA','MRP','Gerada pelo preparo da '||v_op.codigo) RETURNING id INTO v_req_id;
        END IF;
        INSERT INTO requisicoes_compra_itens
          (requisicao_id,item_id,item_nome,quantidade_necessaria,quantidade_disponivel,quantidade_faltante,unidade,status)
        VALUES(v_req_id,r.item_id,COALESCE(r.nome,r.tipo),r.need,v_avail,v_short,'un','ABERTA');
        v_req := v_req + 1;
      END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'op', v_op.codigo, 'materias_primas', v_mp, 'embalagens', v_emb,
    'itens_para_comprar', v_req, 'possui_requisicao', (v_req > 0)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.preparar_op_materiais(uuid) TO authenticated;
