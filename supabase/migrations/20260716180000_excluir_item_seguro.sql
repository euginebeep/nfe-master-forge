-- ============================================================================
-- Exclusão segura / desativação de insumos
-- Premissa: rastreabilidade Anvisa/Receita — histórico NÃO pode ser apagado.
-- Só lixo de cadastro (nunca usado) pode DELETE; demais → ativo=false.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.pode_excluir_item(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_motivos text[] := ARRAY[]::text[];
  v_count integer;
BEGIN
  IF p_item_id IS NULL THEN
    RETURN jsonb_build_object(
      'pode_excluir', false,
      'motivos', jsonb_build_array('id inválido'),
      'tem_historico', true
    );
  END IF;

  IF v_company IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.itens i
    WHERE i.id = p_item_id AND i.company_id = v_company
  ) THEN
    RETURN jsonb_build_object(
      'pode_excluir', false,
      'motivos', jsonb_build_array('item não encontrado nesta empresa'),
      'tem_historico', true
    );
  END IF;

  -- Estoque com saldo (qualquer lote com quantidade > 0)
  SELECT COUNT(*)::int INTO v_count
  FROM public.estoque_lotes el
  WHERE el.item_id = p_item_id
    AND COALESCE(el.quantidade_interna, 0) > 0
    AND COALESCE(el.status, '') IS DISTINCT FROM 'CANCELADO';
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('tem estoque (%s lote(s) com saldo)', v_count));
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.estoque_movimentacoes em
  WHERE em.item_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('usado em %s movimentação(ões) de estoque', v_count));
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.notas_entrada_itens nei
  WHERE nei.item_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('usado em %s nota(s) de entrada', v_count));
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.notas_saida_itens nsi
  WHERE nsi.item_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('usado em %s nota(s) de saída', v_count));
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.op_materias_primas omp
  WHERE omp.insumo_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('usado em %s OP(s)', v_count));
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.formula_itens fi
  WHERE fi.produto_materia_prima_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('usado em %s fórmula(s)', v_count));
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.rastreabilidade_lote_mp r
  WHERE r.item_mp_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('tem %s registro(s) de rastreabilidade', v_count));
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.lote_materias_primas lmp
  WHERE lmp.insumo_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('vinculado a %s lote(s) de PA', v_count));
  END IF;

  IF to_regclass('public.pedidos_compra_itens') IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_count
    FROM public.pedidos_compra_itens pci
    WHERE pci.item_id = p_item_id;
    IF v_count > 0 THEN
      v_motivos := array_append(v_motivos, format('usado em %s pedido(s) de compra', v_count));
    END IF;
  END IF;

  IF to_regclass('public.requisicoes_compra_itens') IS NOT NULL THEN
    EXECUTE
      'SELECT COUNT(*)::int FROM public.requisicoes_compra_itens WHERE item_id = $1'
      INTO v_count
      USING p_item_id;
    IF v_count > 0 THEN
      v_motivos := array_append(v_motivos, format('usado em %s requisição(ões) de compra', v_count));
    END IF;
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.orcamento_itens oi
  WHERE oi.produto_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('usado em %s orçamento(s)', v_count));
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.pedido_itens pi
  WHERE pi.produto_id = p_item_id;
  IF v_count > 0 THEN
    v_motivos := array_append(v_motivos, format('usado em %s pedido(s) de venda', v_count));
  END IF;

  IF to_regclass('public.pedido_vendedor_itens') IS NOT NULL THEN
    SELECT COUNT(*)::int INTO v_count
    FROM public.pedido_vendedor_itens pvi
    WHERE pvi.item_id = p_item_id;
    IF v_count > 0 THEN
      v_motivos := array_append(v_motivos, format('usado em %s pedido(s) de vendedor', v_count));
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'pode_excluir', COALESCE(array_length(v_motivos, 1), 0) = 0,
    'motivos', to_jsonb(v_motivos),
    'tem_historico', COALESCE(array_length(v_motivos, 1), 0) > 0
  );
END;
$$;

COMMENT ON FUNCTION public.pode_excluir_item(uuid) IS
  'Decide se o item pode ser apagado (sem histórico) ou só desativado. RLS por company_id.';

CREATE OR REPLACE FUNCTION public.excluir_item_seguro(p_item_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_check jsonb;
  v_sku text;
BEGIN
  IF v_company IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'empresa não identificada');
  END IF;

  v_check := public.pode_excluir_item(p_item_id);

  IF NOT COALESCE((v_check->>'pode_excluir')::boolean, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'Item possui histórico e não pode ser excluído',
      'motivos', v_check->'motivos'
    );
  END IF;

  SELECT i.sku_interno INTO v_sku
  FROM public.itens i
  WHERE i.id = p_item_id AND i.company_id = v_company;

  IF v_sku IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'item não encontrado nesta empresa');
  END IF;

  DELETE FROM public.itens
  WHERE id = p_item_id AND company_id = v_company;

  RETURN jsonb_build_object(
    'ok', true,
    'excluido', true,
    'sku', v_sku
  );
END;
$$;

COMMENT ON FUNCTION public.excluir_item_seguro(uuid) IS
  'Apaga item somente se pode_excluir_item=true. Cascade cuida de alias/fornecedores/vínculo/estoque vazio.';

CREATE OR REPLACE FUNCTION public.desativar_item(p_item_id uuid, p_ativo boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_sku text;
BEGIN
  IF v_company IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'empresa não identificada');
  END IF;

  UPDATE public.itens i
  SET ativo = COALESCE(p_ativo, false),
      updated_at = now()
  WHERE i.id = p_item_id
    AND i.company_id = v_company
  RETURNING i.sku_interno INTO v_sku;

  IF v_sku IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'item não encontrado nesta empresa');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'ativo', COALESCE(p_ativo, false),
    'sku', v_sku
  );
END;
$$;

COMMENT ON FUNCTION public.desativar_item(uuid, boolean) IS
  'Ativa/desativa item (ativo=true/false). Reversível; preserva histórico.';

GRANT EXECUTE ON FUNCTION public.pode_excluir_item(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.excluir_item_seguro(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.desativar_item(uuid, boolean) TO authenticated, service_role;
