-- ============================================================================
-- VERSIONAMENTO: calcular_capsula_industrial
-- Cálculo server-side de nº de cápsulas por dose (densidade + 8% excipientes).
-- Idempotente via CREATE OR REPLACE. Já alinhado ao modelo comercial 500 mg.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.calcular_capsula_industrial(p_formula_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_formula record;
  v_densidade numeric;
  v_dose_ativos numeric := 0;
  v_alvo_comercial numeric := 500;
  v_tolerancia_pct numeric := 5;
  v_teto_fisico numeric;
  v_limite_capsula numeric;
  v_cabe_ativo_capsula numeric;
  v_n_capsulas int;
  v_ativo_por_capsula numeric;
  v_exc_por_capsula numeric;
  v_qsp_por_capsula numeric;
  v_peso_real_capsula numeric;
BEGIN
  SELECT * INTO v_formula FROM public.formulas WHERE id = p_formula_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'FORMULA_NAO_ENCONTRADA');
  END IF;

  v_densidade := COALESCE(NULLIF(v_formula.densidade_aparente_kg_l, 0), 0.65);

  SELECT COALESCE(SUM(quantidade_convertida_mg), 0)
    INTO v_dose_ativos
  FROM public.formula_itens
  WHERE formula_id = p_formula_id;

  v_teto_fisico := round(0.68 * v_densidade * 1000, 1);
  v_limite_capsula := LEAST(v_alvo_comercial, v_teto_fisico);
  v_cabe_ativo_capsula := round(v_limite_capsula * 0.92, 4);
  v_n_capsulas := CASE
    WHEN v_dose_ativos <= 0 THEN 1
    ELSE GREATEST(1, ceil(v_dose_ativos / v_cabe_ativo_capsula))
  END;
  v_ativo_por_capsula := round(v_dose_ativos / v_n_capsulas, 4);
  v_exc_por_capsula := round(v_limite_capsula * 0.08, 4);
  v_qsp_por_capsula := GREATEST(
    0,
    round(v_limite_capsula - v_ativo_por_capsula - v_exc_por_capsula, 4)
  );
  v_peso_real_capsula := round(
    v_ativo_por_capsula + v_exc_por_capsula + v_qsp_por_capsula,
    4
  );

  RETURN jsonb_build_object(
    'ok', true,
    'formula_id', p_formula_id,
    'densidade_kg_l', v_densidade,
    'dose_ativos_total_mg', v_dose_ativos,
    'alvo_comercial_mg', v_alvo_comercial,
    'teto_comercial_mg', round(v_alvo_comercial * (1 + v_tolerancia_pct / 100.0), 1),
    'teto_fisico_mg', v_teto_fisico,
    'limite_por_capsula_mg', v_limite_capsula,
    'cabe_ativo_por_capsula_mg', v_cabe_ativo_capsula,
    'n_capsulas_por_dose', v_n_capsulas,
    'por_capsula', jsonb_build_object(
      'ativo_mg', v_ativo_por_capsula,
      'excipientes_8pct_mg', v_exc_por_capsula,
      'qsp_amido_mg', v_qsp_por_capsula,
      'peso_total_mg', v_peso_real_capsula
    ),
    'peso_total_dose_mg', round(v_peso_real_capsula * v_n_capsulas, 4),
    'densidade_e_default', (
      v_formula.densidade_aparente_kg_l IS NULL
      OR v_formula.densidade_aparente_kg_l = 0.65
    ),
    'alerta_densidade', CASE
      WHEN (
        v_formula.densidade_aparente_kg_l IS NULL
        OR v_formula.densidade_aparente_kg_l = 0.65
      ) THEN
        'Densidade padrão (0,65). Meça a densidade real do blend antes de aprovar — o nº de cápsulas depende dela.'
      ELSE NULL
    END
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.calcular_capsula_industrial(uuid)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
