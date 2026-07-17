-- ============================================================================
-- VERSIONAMENTO: densidade_blend_estimada
-- Já em produção. DROP da assinatura antiga (2 args) evita ambiguidade.
-- ============================================================================

DROP FUNCTION IF EXISTS public.densidade_blend_estimada(uuid, numeric);

CREATE OR REPLACE FUNCTION public.densidade_blend_estimada(
  p_formula_id uuid,
  p_dens_veiculo numeric DEFAULT 0.55,
  p_dens_sio2 numeric DEFAULT 0.03,
  p_dens_estearato numeric DEFAULT 0.30,
  p_dens_talco numeric DEFAULT 0.55
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_estrutura jsonb;
  v_massa_total numeric := 0;
  v_volume_total numeric := 0;
  v_faltando int := 0;
  v_total_itens int := 0;
  v_dens numeric;
  v_exc_por_cap numeric;
  v_qsp_por_cap numeric;
  v_n_cap int;
  r record;
  v_res jsonb;
  v_exc_total numeric;
  v_qsp_total numeric;
BEGIN
  v_estrutura := public.calcular_capsula_industrial(p_formula_id);
  IF (v_estrutura->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_estrutura;
  END IF;

  v_n_cap := (v_estrutura->>'n_capsulas_por_dose')::int;
  v_exc_por_cap := (v_estrutura#>>'{por_capsula,excipientes_8pct_mg}')::numeric;
  v_qsp_por_cap := (v_estrutura#>>'{por_capsula,qsp_amido_mg}')::numeric;

  FOR r IN
    SELECT
      fi.produto_materia_prima_id AS item_id,
      fi.quantidade_convertida_mg AS massa_mg,
      fi.exige_premix
    FROM public.formula_itens fi
    WHERE fi.formula_id = p_formula_id
  LOOP
    v_total_itens := v_total_itens + 1;
    IF coalesce(r.exige_premix, false) THEN
      v_dens := p_dens_veiculo;
    ELSE
      v_res := public.densidade_item_resolvida(r.item_id, NULL, p_dens_veiculo);
      v_dens := (v_res->>'densidade_kg_l')::numeric;
      IF (v_res->>'origem') = 'FALLBACK' THEN
        v_faltando := v_faltando + 1;
      END IF;
    END IF;
    v_massa_total := v_massa_total + r.massa_mg;
    v_volume_total := v_volume_total + (r.massa_mg / v_dens);
  END LOOP;

  v_exc_total := v_exc_por_cap * v_n_cap;
  v_qsp_total := v_qsp_por_cap * v_n_cap;
  v_massa_total := v_massa_total + v_exc_total + v_qsp_total;
  v_volume_total := v_volume_total
    + ((v_exc_total * (2.0 / 8.0)) / p_dens_sio2)
    + ((v_exc_total * (1.0 / 8.0)) / p_dens_estearato)
    + ((v_exc_total * (5.0 / 8.0)) / p_dens_talco)
    + (v_qsp_total / p_dens_veiculo);

  RETURN jsonb_build_object(
    'ok', v_volume_total > 0,
    'formula_id', p_formula_id,
    'densidade_estimada_kg_l', CASE
      WHEN v_volume_total > 0 THEN round(v_massa_total / v_volume_total, 4)
      ELSE NULL
    END,
    'massa_total_mg', round(v_massa_total, 4),
    'inclui', 'ativos + excipientes 8% + QSP',
    'itens_ativos', v_total_itens,
    'ativos_sem_densidade_coa', v_faltando,
    'premix_usa_densidade_veiculo', p_dens_veiculo,
    'e_estimativa', true,
    'requer_medicao_blend', true,
    'observacao',
      'Densidade ESTIMADA por composição (COA do lote/cadastro + excipientes + QSP; pré-mix usa veículo). Densidade dos itens resolvida automaticamente quando há COA. NÃO substitui a medição do blend final, confirmada pela RT antes de aprovar.'
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.densidade_blend_estimada(uuid, numeric, numeric, numeric, numeric)
  TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
