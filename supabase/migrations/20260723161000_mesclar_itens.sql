-- ============================================================
-- RPC mesclar_itens: absorve um item duplicado no sobrevivente
-- Transação única, checagem de tenant, auditoria, item_alias.
-- LER o corpo de excluir_item_seguro antes de excluir o absorvido.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mesclar_itens(
  p_item_manter uuid,
  p_item_absorver uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_manter public.itens%ROWTYPE;
  v_absorver public.itens%ROWTYPE;
  v_excluir jsonb;
  v_repontados integer := 0;
  v_n integer;
BEGIN
  IF p_item_manter IS NULL OR p_item_absorver IS NULL THEN
    RAISE EXCEPTION 'itens inválidos';
  END IF;
  IF p_item_manter = p_item_absorver THEN
    RAISE EXCEPTION 'manter e absorver devem ser distintos';
  END IF;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'tenant não identificado';
  END IF;

  SELECT * INTO v_manter FROM public.itens
   WHERE id = p_item_manter AND company_id = v_company;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item a manter não encontrado neste tenant';
  END IF;

  SELECT * INTO v_absorver FROM public.itens
   WHERE id = p_item_absorver AND company_id = v_company;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'item a absorver não encontrado neste tenant';
  END IF;

  -- 1) estoque_lotes
  UPDATE public.estoque_lotes
     SET item_id = p_item_manter
   WHERE item_id = p_item_absorver;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_repontados := v_repontados + v_n;

  -- 2) notas_entrada_itens
  UPDATE public.notas_entrada_itens
     SET item_id = p_item_manter
   WHERE item_id = p_item_absorver;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_repontados := v_repontados + v_n;

  -- 3) item_fornecedores — conflito em (item_id, fornecedor_id)
  DELETE FROM public.item_fornecedores if1
   USING public.item_fornecedores if2
   WHERE if1.item_id = p_item_absorver
     AND if2.item_id = p_item_manter
     AND if1.fornecedor_id = if2.fornecedor_id;

  UPDATE public.item_fornecedores
     SET item_id = p_item_manter
   WHERE item_id = p_item_absorver;
  GET DIAGNOSTICS v_n = ROW_COUNT; v_repontados := v_repontados + v_n;

  -- 4) formula_itens (coluna produto_materia_prima_id e/ou item_id)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'formula_itens'
       AND column_name = 'produto_materia_prima_id'
  ) THEN
    EXECUTE 'UPDATE public.formula_itens SET produto_materia_prima_id = $1 WHERE produto_materia_prima_id = $2'
      USING p_item_manter, p_item_absorver;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_repontados := v_repontados + v_n;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'formula_itens'
       AND column_name = 'item_id'
  ) THEN
    EXECUTE 'UPDATE public.formula_itens SET item_id = $1 WHERE item_id = $2'
      USING p_item_manter, p_item_absorver;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_repontados := v_repontados + v_n;
  END IF;

  -- 5) item_anvisa_vinculo
  IF to_regclass('public.item_anvisa_vinculo') IS NOT NULL THEN
    -- conflito: se já existe vínculo no manter, remove o do absorver
    DELETE FROM public.item_anvisa_vinculo a
     USING public.item_anvisa_vinculo b
     WHERE a.item_id = p_item_absorver
       AND b.item_id = p_item_manter;
    UPDATE public.item_anvisa_vinculo
       SET item_id = p_item_manter
     WHERE item_id = p_item_absorver;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_repontados := v_repontados + v_n;
  END IF;

  -- 6) item_historico_compra (view ou tabela)
  IF to_regclass('public.item_historico_compra') IS NOT NULL
     AND EXISTS (
       SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'item_historico_compra'
          AND table_type = 'BASE TABLE'
     ) THEN
    UPDATE public.item_historico_compra
       SET item_id = p_item_manter
     WHERE item_id = p_item_absorver;
    GET DIAGNOSTICS v_n = ROW_COUNT; v_repontados := v_repontados + v_n;
  END IF;

  -- 7) lote_documentos via lotes já repontados — COA segue o lote
  -- (não precisa repontar se lote.item_id já aponta ao manter)

  -- 8) Alias: descrição do absorvido reconhece o manter
  INSERT INTO public.item_alias (item_id, texto, tipo)
  SELECT p_item_manter, v_absorver.descricao_interna, 'MERGE'
   WHERE NOT EXISTS (
     SELECT 1 FROM public.item_alias a
      WHERE a.item_id = p_item_manter
        AND a.texto = v_absorver.descricao_interna
   );

  IF v_absorver.sku_interno IS NOT NULL THEN
    INSERT INTO public.item_alias (item_id, texto, tipo)
    SELECT p_item_manter, v_absorver.sku_interno, 'SKU_MERGE'
     WHERE NOT EXISTS (
       SELECT 1 FROM public.item_alias a
        WHERE a.item_id = p_item_manter
          AND a.texto = v_absorver.sku_interno
     );
  END IF;

  -- 9) Excluir ou desativar o absorvido via RPC segura
  SELECT public.excluir_item_seguro(p_item_absorver) INTO v_excluir;

  INSERT INTO public.auditoria_exclusoes (
    company_id, tipo_documento, documento_id, documento_numero,
    dados_excluidos, motivo, usuario_id, criado_em
  ) VALUES (
    v_company,
    'ITEM_MERGE',
    p_item_absorver,
    coalesce(v_absorver.sku_interno, v_absorver.descricao_interna),
    jsonb_build_object(
      'manter', p_item_manter,
      'absorver', p_item_absorver,
      'descricao_absorvida', v_absorver.descricao_interna,
      'repontados', v_repontados,
      'excluir_resultado', v_excluir
    ),
    'Mesclagem de item duplicado',
    auth.uid(),
    now()
  );

  RETURN jsonb_build_object(
    'sucesso', true,
    'item_manter', p_item_manter,
    'item_absorver', p_item_absorver,
    'repontados', v_repontados,
    'exclusao', v_excluir
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mesclar_itens(uuid, uuid) TO authenticated;
