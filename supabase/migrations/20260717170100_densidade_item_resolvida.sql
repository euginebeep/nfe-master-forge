-- ============================================================================
-- VERSIONAMENTO: densidade_item_resolvida
-- COA do lote → cadastro do item → fallback. Já em produção. Idempotente.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.densidade_item_resolvida(
  p_item_id uuid,
  p_lote_id uuid DEFAULT NULL::uuid,
  p_dens_fallback numeric DEFAULT 0.55
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_dens_coa numeric;
  v_dens_item numeric;
  v_raw text;
BEGIN
  IF p_lote_id IS NOT NULL THEN
    SELECT resultado INTO v_raw
    FROM public.qc_analises
    WHERE item_id = p_item_id
      AND lote_id = p_lote_id
      AND (
        parametro ILIKE '%densidad%'
        OR parametro ILIKE '%bulk%'
        OR parametro ILIKE '%aparente%'
      )
      AND resultado IS NOT NULL
    ORDER BY data_analise DESC NULLS LAST
    LIMIT 1;

    IF v_raw IS NOT NULL THEN
      v_dens_coa := NULLIF(
        regexp_replace(replace(v_raw, ',', '.'), '[^0-9.].*$', ''),
        ''
      )::numeric;
      IF v_dens_coa IS NOT NULL AND v_dens_coa > 0 THEN
        RETURN jsonb_build_object(
          'ok', true,
          'densidade_kg_l', v_dens_coa,
          'origem', 'COA_LOTE',
          'automatico', true,
          'mensagem', 'Densidade lida automaticamente do COA do lote.'
        );
      END IF;
    END IF;
  END IF;

  SELECT densidade_aparente INTO v_dens_item
  FROM public.itens
  WHERE id = p_item_id;

  IF v_dens_item IS NOT NULL AND v_dens_item > 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'densidade_kg_l', v_dens_item,
      'origem', 'CADASTRO_ITEM',
      'automatico', true,
      'mensagem', 'Densidade do cadastro do insumo (COA registrado).'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'densidade_kg_l', p_dens_fallback,
    'origem', 'FALLBACK',
    'automatico', false,
    'mensagem', format(
      'Sem COA nem cadastro — usando fallback %s kg/L. A RT pode informar/cadastrar a densidade deste insumo.',
      p_dens_fallback
    )
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.densidade_item_resolvida(uuid, uuid, numeric)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
