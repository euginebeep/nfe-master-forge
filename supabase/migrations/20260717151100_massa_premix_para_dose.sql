-- ============================================================================
-- VERSIONAMENTO: massa_premix_para_dose
-- Já aplicada em produção. Idempotente via CREATE OR REPLACE.
-- Calcula massa de pré-mix (mg) para dose-alvo em UI, via fator_ui_mg_do_lote.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.massa_premix_para_dose(
  p_lote_premix_id uuid,
  p_dose_ui numeric,
  p_exigir_validacao_rt boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fator jsonb;
  v_fator_ui_mg numeric;
  v_validada boolean;
BEGIN
  IF p_dose_ui IS NULL OR p_dose_ui <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'DOSE_INVALIDA',
      'mensagem', 'Informe a dose-alvo em UI (> 0).'
    );
  END IF;

  v_fator := public.fator_ui_mg_do_lote(p_lote_premix_id);
  IF (v_fator->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_fator;
  END IF;

  v_validada := coalesce((v_fator->>'potencia_validada_rt')::boolean, false);
  IF p_exigir_validacao_rt AND NOT v_validada THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'POTENCIA_NAO_VALIDADA_RT',
      'mensagem',
        'A potência deste lote de pré-mix ainda não foi validada pela RT. Valide antes de usar na fórmula.',
      'potencia_ui_g', v_fator->'potencia_ui_g'
    );
  END IF;

  v_fator_ui_mg := (v_fator->>'fator_ui_para_mg')::numeric;

  RETURN jsonb_build_object(
    'ok', true,
    'dose_ui', p_dose_ui,
    'massa_premix_mg', round(p_dose_ui * v_fator_ui_mg, 4),
    'potencia_ui_g', v_fator->'potencia_ui_g',
    'potencia_validada_rt', v_validada,
    'fonte', v_fator->'fonte',
    'mensagem', format(
      '%s UI -> %s mg de pré-mix (potência do lote).',
      p_dose_ui,
      round(p_dose_ui * v_fator_ui_mg, 4)
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.massa_premix_para_dose(uuid, numeric, boolean)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
