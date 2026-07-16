-- ============================================================================
-- Correção completa dos furos do motor regulatório
-- Depende de: 20260716220000_limite_por_grupo_e_premix.sql
--
-- Furo 6: converter_para_unidade — nunca comparar mg vs mcg/g crus
-- Furo 1: já em anvisa_limite_por_grupo (herdado) — reforça SEM_UNIDADE_LIMITE
-- Furo 7: associação proibida por constituinte_id (não substring)
-- Furo 2: vínculo filtrado por company_id
-- Furo 8: quantidade_convertida_mg <= 0 → CONVERSAO_INVALIDA
-- ============================================================================

-- ============================================================================
-- FURO 6 — Conversão de unidade (mg ↔ mcg ↔ g). UI não converte aqui.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.converter_para_unidade(
  p_valor numeric,
  p_de text,
  p_para text
)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  de text;
  para text;
  em_mg numeric;
BEGIN
  IF p_valor IS NULL THEN
    RETURN NULL;
  END IF;

  de := lower(replace(replace(trim(coalesce(p_de, '')), 'µ', 'u'), 'μ', 'u'));
  para := lower(replace(replace(trim(coalesce(p_para, '')), 'µ', 'u'), 'μ', 'u'));

  -- aliases
  IF de IN ('ug', 'mcg') OR de ~ '^u.?g$' THEN de := 'mcg'; END IF;
  IF para IN ('ug', 'mcg') OR para ~ '^u.?g$' THEN para := 'mcg'; END IF;
  IF de = 'µg' OR de = 'μg' THEN de := 'mcg'; END IF;
  IF para = 'µg' OR para = 'μg' THEN para := 'mcg'; END IF;

  IF de = '' OR para = '' THEN
    RETURN NULL; -- SEM_UNIDADE_LIMITE
  END IF;

  -- UI / UFC / NE: não converter sem contexto
  IF de IN ('ui', 'ufc', 'ne', 'na') OR para IN ('ui', 'ufc', 'ne', 'na') THEN
    RETURN NULL;
  END IF;

  IF de NOT IN ('mg', 'mcg', 'g') OR para NOT IN ('mg', 'mcg', 'g') THEN
    RETURN NULL; -- unidade não reconhecida
  END IF;

  IF de = para THEN
    RETURN p_valor;
  END IF;

  -- pivot mg
  IF de = 'mg' THEN
    em_mg := p_valor;
  ELSIF de = 'mcg' THEN
    em_mg := p_valor / 1000.0;
  ELSE -- g
    em_mg := p_valor * 1000.0;
  END IF;

  IF para = 'mg' THEN
    RETURN em_mg;
  ELSIF para = 'mcg' THEN
    RETURN em_mg * 1000.0;
  ELSE -- g
    RETURN em_mg / 1000.0;
  END IF;
END;
$$;

-- limite_* → mg via converter (NULL se unidade inválida)
CREATE OR REPLACE FUNCTION public.anvisa_limite_para_mg(p_valor numeric, p_unidade text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.converter_para_unidade(p_valor, p_unidade, 'mg');
$$;

COMMENT ON FUNCTION public.converter_para_unidade(numeric, text, text) IS
  'Normaliza massa entre mg/mcg/g. UI/desconhecida → NULL (PENDENTE_RT).';

-- ============================================================================
-- FURO 7 — Associação proibida por UUID
-- ============================================================================
ALTER TABLE public.anvisa_associacoes_proibidas
  ADD COLUMN IF NOT EXISTS constituinte_a_id uuid REFERENCES public.anvisa_constituintes(id),
  ADD COLUMN IF NOT EXISTS constituinte_b_id uuid REFERENCES public.anvisa_constituintes(id);

CREATE INDEX IF NOT EXISTS idx_anvisa_assoc_proib_ids
  ON public.anvisa_associacoes_proibidas (constituinte_a_id, constituinte_b_id)
  WHERE ativo IS DISTINCT FROM false;

-- Popula ids reais (cúrcuma × tetraidrocurcuminoides)
UPDATE public.anvisa_associacoes_proibidas a
SET
  constituinte_a_id = COALESCE(
    a.constituinte_a_id,
    (SELECT c.id FROM public.anvisa_constituintes c
     WHERE c.nome_tecnico ILIKE 'Extrato de rizomas de Curcuma longa%'
        OR c.nome_tecnico ILIKE '%rizomas de Curcuma longa%'
     ORDER BY length(c.nome_tecnico) ASC
     LIMIT 1)
  ),
  constituinte_b_id = COALESCE(
    a.constituinte_b_id,
    (SELECT c.id FROM public.anvisa_constituintes c
     WHERE c.nome_tecnico ILIKE 'Tetraidrocurcuminoides%'
     ORDER BY length(c.nome_tecnico) ASC
     LIMIT 1)
  )
WHERE a.ativo IS DISTINCT FROM false
  AND (
    lower(a.constituinte_a_nome) LIKE '%curcuma%'
    OR lower(a.constituinte_b_nome) LIKE '%curcuma%'
    OR lower(a.constituinte_a_nome) LIKE '%tetraidro%'
    OR lower(a.constituinte_b_nome) LIKE '%tetraidro%'
  );

-- ============================================================================
-- FUROS 2, 6, 8 — reescreve comparação em anvisa_avaliar_formula
-- ============================================================================
DROP FUNCTION IF EXISTS public.anvisa_avaliar_formula(uuid, date);
DROP FUNCTION IF EXISTS public.anvisa_avaliar_formula(uuid, date, text);

CREATE OR REPLACE FUNCTION public.anvisa_avaliar_formula(
  p_formula_id uuid,
  p_data date DEFAULT CURRENT_DATE,
  p_grupo text DEFAULT NULL
)
RETURNS TABLE (
  insumo text,
  constituinte text,
  status text,
  ativo_teto_mg numeric,
  ativo_piso_mg numeric,
  limite_min_mg numeric,
  limite_max_mg numeric,
  norma text,
  dado_faltante text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  f record;
  fi record;
  v record;
  c record;
  lim record;
  v_grupo text;
  v_n_caps numeric;
  v_doses numeric;
  v_massa_dia numeric;
  v_teor_max numeric;
  v_teor_min numeric;
  v_teto numeric;
  v_piso numeric;
  v_status text;
  v_faltante text;
BEGIN
  IF p_formula_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO f FROM public.formulas WHERE id = p_formula_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  v_grupo := COALESCE(
    NULLIF(trim(p_grupo), ''),
    NULLIF(trim(f.grupo_populacional_alvo), '')
  );
  v_n_caps := COALESCE(NULLIF(f.n_capsulas_por_dose, 0), 1);
  v_doses := COALESCE(NULLIF(f.doses_por_dia, 0), 1);

  FOR fi IN
    SELECT *
    FROM public.formula_itens x
    WHERE x.formula_id = p_formula_id
    ORDER BY x.ordem_mistura NULLS LAST, x.nome_insumo
  LOOP
    insumo := fi.nome_insumo;
    constituinte := NULL;
    status := NULL;
    ativo_teto_mg := NULL;
    ativo_piso_mg := NULL;
    limite_min_mg := NULL;
    limite_max_mg := NULL;
    norma := NULL;
    dado_faltante := NULL;
    v_status := NULL;
    v_faltante := NULL;
    v_teto := NULL;
    v_piso := NULL;

    IF fi.produto_materia_prima_id IS NULL THEN
      status := 'SEM_VINCULO';
      dado_faltante := 'vinculo';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- Premix sem potência
    IF EXISTS (
      SELECT 1 FROM public.itens it
      WHERE it.id = fi.produto_materia_prima_id
        AND coalesce(it.eh_premix, false) IS TRUE
    ) AND upper(coalesce(fi.unidade_informada::text, '')) = 'UI' THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.estoque_lotes el
        WHERE el.item_id = fi.produto_materia_prima_id
          AND el.tipo_potencia = 'UI_POR_GRAMA'
          AND el.potencia_valor IS NOT NULL
          AND el.potencia_valor > 0
          AND coalesce(el.status, '') IS DISTINCT FROM 'CANCELADO'
      ) THEN
        status := 'PREMIX_SEM_POTENCIA_LOTE';
        dado_faltante := 'potencia_lote_premix';
        RETURN NEXT;
        CONTINUE;
      END IF;
    END IF;

    -- FURO 2: vínculo filtrado por company_id da fórmula
    SELECT * INTO v
    FROM public.item_anvisa_vinculo iv
    WHERE iv.item_id = fi.produto_materia_prima_id
      AND iv.status = 'confirmado'
      AND (f.company_id IS NULL OR iv.company_id = f.company_id)
    ORDER BY iv.confirmado_em DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      IF EXISTS (
        SELECT 1 FROM public.item_anvisa_vinculo iv2
        WHERE iv2.item_id = fi.produto_materia_prima_id
          AND (f.company_id IS NULL OR iv2.company_id = f.company_id)
      ) THEN
        status := 'VINCULO_NAO_CONFIRMADO';
        dado_faltante := 'vinculo_confirmado';
      ELSE
        status := 'SEM_VINCULO';
        dado_faltante := 'vinculo';
      END IF;
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT * INTO c FROM public.anvisa_constituintes WHERE id = v.constituinte_id;
    constituinte := COALESCE(c.nome_tecnico, v.constituinte_id::text);
    norma := COALESCE(c.norma_ultima_alteracao, c.norma_inclusao, 'IN 28/2018');

    IF coalesce(c.is_proibido, false) THEN
      status := 'PROIBIDO';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- FURO 8: dose convertida inválida → nunca CONFORME
    IF coalesce(fi.quantidade_convertida_mg, 0) <= 0 THEN
      status := 'CONVERSAO_INVALIDA';
      dado_faltante := 'quantidade_convertida_mg';
      RETURN NEXT;
      CONTINUE;
    END IF;

    v_massa_dia := fi.quantidade_convertida_mg * v_n_caps * v_doses;

    v_teor_max := COALESCE(v.teor_max_pct, v.teor_nominal_pct, v.teor_valor);
    v_teor_min := COALESCE(v.teor_min_pct, v.teor_nominal_pct, v.teor_valor);

    IF v_teor_max IS NOT NULL AND v_teor_max > 0 AND v_teor_max <= 1000 THEN
      v_teto := v_massa_dia * (v_teor_max / 100.0);
    ELSE
      v_teto := v_massa_dia;
      v_faltante := COALESCE(v_faltante, 'teor');
    END IF;

    IF v_teor_min IS NOT NULL AND v_teor_min > 0 AND v_teor_min <= 1000 THEN
      v_piso := v_massa_dia * (v_teor_min / 100.0);
    ELSE
      v_piso := v_teto;
    END IF;

    ativo_teto_mg := round(v_teto, 8);
    ativo_piso_mg := round(v_piso, 8);

    IF v_grupo IS NULL THEN
      status := 'SEM_GRUPO';
      dado_faltante := 'grupo';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- FURO 1: limite POR GRUPO (não limite_max_num genérico)
    SELECT * INTO lim
    FROM public.anvisa_limite_por_grupo(c.id, v_grupo)
    LIMIT 1;

    IF NOT FOUND OR (lim.limite_max IS NULL AND lim.limite_min IS NULL) THEN
      status := 'SEM_LIMITE_PARA_GRUPO';
      dado_faltante := 'limite_grupo';
      RETURN NEXT;
      CONTINUE;
    END IF;

    -- FURO 6: unidade do limite — converter para mg; se falhar → PENDENTE
    IF nullif(trim(coalesce(lim.unidade, '')), '') IS NULL THEN
      status := 'SEM_UNIDADE_LIMITE';
      dado_faltante := 'limite_unidade';
      RETURN NEXT;
      CONTINUE;
    END IF;

    IF lim.limite_max IS NOT NULL AND lim.limite_max_mg IS NULL THEN
      status := 'SEM_UNIDADE_LIMITE';
      dado_faltante := 'limite_unidade';
      limite_max_mg := NULL;
      limite_min_mg := public.converter_para_unidade(lim.limite_min, lim.unidade, 'mg');
      RETURN NEXT;
      CONTINUE;
    END IF;

    limite_min_mg := lim.limite_min_mg;
    limite_max_mg := lim.limite_max_mg;

    -- Comparação SEMPRE em mg (dose e limite na mesma unidade)
    IF ativo_teto_mg IS NOT NULL AND limite_max_mg IS NOT NULL
       AND ativo_teto_mg > limite_max_mg THEN
      v_status := 'EXCEDE_LIMITE_MAXIMO';
    ELSIF limite_min_mg IS NOT NULL AND ativo_piso_mg IS NOT NULL
          AND ativo_piso_mg < limite_min_mg THEN
      v_status := 'ABAIXO_LIMITE_MINIMO';
    ELSE
      v_status := 'DENTRO_DO_LIMITE';
    END IF;

    status := v_status;
    dado_faltante := v_faltante;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.anvisa_avaliar_formula(uuid, date, text) IS
  'Motor de cálculo: limite por grupo + unidade normalizada (mg). Na dúvida → status pendente, nunca CONFORME por omissão.';

-- ============================================================================
-- regulatory_validar_produto — herda cálculo; FURO 7 associação por id
-- ============================================================================
CREATE OR REPLACE FUNCTION public.regulatory_validar_produto(
  p_formula_id uuid,
  p_data date DEFAULT CURRENT_DATE,
  p_grupo text DEFAULT NULL,
  p_alegacoes text[] DEFAULT NULL,
  p_documento_tipo text DEFAULT NULL,
  p_documento_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company uuid := public.get_user_company_id();
  v_formula record;
  v_grupo text;
  v_bloqueante boolean := false;
  v_pendente boolean := false;
  v_status_geral text := 'CONFORME';
  v_identidade jsonb := '[]'::jsonb;
  v_limites jsonb := '[]'::jsonb;
  v_grupo_inc jsonb := '[]'::jsonb;
  v_associacoes jsonb := '[]'::jsonb;
  v_aleg_perm jsonb := '[]'::jsonb;
  v_aleg_proib jsonb := '[]'::jsonb;
  v_advert jsonb := '[]'::jsonb;
  v_normas jsonb := '[]'::jsonb;
  v_const_ids uuid[] := ARRAY[]::uuid[];
  v_const_nomes text[] := ARRAY[]::text[];
  v_item record;
  v_vinculo record;
  v_const record;
  v_aval record;
  v_assoc record;
  v_aleg text;
  v_match boolean;
  v_parecer jsonb;
  v_snapshot_id uuid := NULL;
  v_hash text;
  v_rt text;
BEGIN
  IF p_formula_id IS NULL THEN
    RAISE EXCEPTION 'p_formula_id é obrigatório';
  END IF;

  SELECT f.*
    INTO v_formula
  FROM public.formulas f
  WHERE f.id = p_formula_id
    AND (v_company IS NULL OR f.company_id = v_company);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Fórmula % não encontrada ou fora do tenant', p_formula_id;
  END IF;

  v_grupo := COALESCE(
    NULLIF(TRIM(p_grupo), ''),
    NULLIF(TRIM(v_formula.grupo_populacional_alvo), '')
  );

  IF v_grupo IS NULL THEN
    v_pendente := true;
  END IF;

  IF v_formula.doses_por_dia IS NULL OR v_formula.doses_por_dia <= 0 THEN
    v_pendente := true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.formula_itens fi WHERE fi.formula_id = p_formula_id
  ) THEN
    v_pendente := true;
  END IF;

  v_normas := v_normas || jsonb_build_object(
    'norma', 'IN 28/2018',
    'dispositivo', 'Anexo IV — limites por grupo + unidade normalizada',
    'data_verificacao', p_data
  );

  FOR v_item IN
    SELECT fi.*
    FROM public.formula_itens fi
    WHERE fi.formula_id = p_formula_id
    ORDER BY fi.ordem_mistura NULLS LAST, fi.nome_insumo
  LOOP
    v_vinculo := NULL;
    v_const := NULL;

    IF v_item.produto_materia_prima_id IS NULL THEN
      v_pendente := true;
      v_identidade := v_identidade || jsonb_build_object(
        'insumo', v_item.nome_insumo,
        'status', 'SEM_VINCULO',
        'constituinte', NULL,
        'motivo', 'Item sem produto_materia_prima_id',
        'dado_faltante', 'vinculo'
      );
      CONTINUE;
    END IF;

    -- FURO 2: company_id
    SELECT v.*
      INTO v_vinculo
    FROM public.item_anvisa_vinculo v
    WHERE v.item_id = v_item.produto_materia_prima_id
      AND v.status = 'confirmado'
      AND (v_formula.company_id IS NULL OR v.company_id = v_formula.company_id)
    ORDER BY v.confirmado_em DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      v_pendente := true;
      IF EXISTS (
        SELECT 1 FROM public.item_anvisa_vinculo v2
        WHERE v2.item_id = v_item.produto_materia_prima_id
          AND (v_formula.company_id IS NULL OR v2.company_id = v_formula.company_id)
      ) THEN
        v_identidade := v_identidade || jsonb_build_object(
          'insumo', v_item.nome_insumo,
          'status', 'VINCULO_NAO_CONFIRMADO',
          'constituinte', NULL,
          'motivo', 'Vínculo existe mas não está confirmado pelo RT',
          'dado_faltante', 'vinculo_confirmado'
        );
      ELSE
        v_identidade := v_identidade || jsonb_build_object(
          'insumo', v_item.nome_insumo,
          'status', 'SEM_VINCULO',
          'constituinte', NULL,
          'motivo', 'Nenhum vínculo item→constituinte',
          'dado_faltante', 'vinculo'
        );
      END IF;
      CONTINUE;
    END IF;

    SELECT c.*
      INTO v_const
    FROM public.anvisa_constituintes c
    WHERE c.id = v_vinculo.constituinte_id;

    v_identidade := v_identidade || jsonb_build_object(
      'insumo', v_item.nome_insumo,
      'status', 'CONFIRMADO',
      'constituinte', COALESCE(v_const.nome_tecnico, v_vinculo.constituinte_id::text),
      'motivo', NULL
    );

    IF v_const.id IS NOT NULL THEN
      v_const_ids := array_append(v_const_ids, v_const.id);
      v_const_nomes := array_append(v_const_nomes, v_const.nome_tecnico);

      IF COALESCE(v_const.homologado, false) IS NOT TRUE THEN
        v_pendente := true;
      END IF;

      IF COALESCE(v_const.is_proibido, false) THEN
        v_bloqueante := true;
      END IF;

      IF v_grupo IS NOT NULL
         AND v_const.grupos_nao_autorizados IS NOT NULL
         AND EXISTS (
           SELECT 1
           FROM unnest(v_const.grupos_nao_autorizados) g
           WHERE lower(g) = lower(v_grupo)
              OR lower(g) LIKE '%' || lower(v_grupo) || '%'
              OR lower(v_grupo) LIKE '%' || lower(g) || '%'
         )
      THEN
        v_bloqueante := true;
        v_grupo_inc := v_grupo_inc || jsonb_build_object(
          'constituinte', v_const.nome_tecnico,
          'grupo', v_grupo,
          'motivo', 'Constituinte em grupos_nao_autorizados'
        );
      END IF;

      IF v_const.advertencias IS NOT NULL THEN
        v_advert := v_advert || to_jsonb(v_const.advertencias);
      END IF;

      IF p_alegacoes IS NOT NULL THEN
        IF v_const.alegacoes IS NULL OR cardinality(v_const.alegacoes) = 0 THEN
          FOREACH v_aleg IN ARRAY p_alegacoes LOOP
            v_aleg_proib := v_aleg_proib || to_jsonb(v_aleg);
          END LOOP;
          v_pendente := true;
        ELSE
          FOREACH v_aleg IN ARRAY p_alegacoes LOOP
            v_match := EXISTS (
              SELECT 1 FROM unnest(v_const.alegacoes) a
              WHERE lower(a) = lower(v_aleg)
                 OR lower(a) LIKE '%' || lower(v_aleg) || '%'
            );
            IF v_match THEN
              v_aleg_perm := v_aleg_perm || to_jsonb(v_aleg);
            ELSE
              v_aleg_proib := v_aleg_proib || to_jsonb(v_aleg);
              v_pendente := true;
            END IF;
          END LOOP;
        END IF;
      END IF;

      IF v_const.norma_ultima_alteracao IS NOT NULL OR v_const.norma_inclusao IS NOT NULL THEN
        v_normas := v_normas || jsonb_build_object(
          'norma', COALESCE(v_const.norma_ultima_alteracao, v_const.norma_inclusao),
          'dispositivo', v_const.nome_tecnico,
          'data_verificacao', p_data,
          'fonte_url', v_const.fonte_url
        );
      END IF;
    END IF;
  END LOOP;

  -- Limites: herda correções (grupo + unidade + CONVERSAO_INVALIDA)
  FOR v_aval IN
    SELECT * FROM public.anvisa_avaliar_formula(p_formula_id, p_data, v_grupo)
  LOOP
    v_limites := v_limites || jsonb_build_object(
      'insumo', v_aval.insumo,
      'constituinte', v_aval.constituinte,
      'status', v_aval.status,
      'ativo_teto_mg', v_aval.ativo_teto_mg,
      'ativo_piso_mg', v_aval.ativo_piso_mg,
      'limite_min_mg', v_aval.limite_min_mg,
      'limite_max_mg', v_aval.limite_max_mg,
      'norma', v_aval.norma,
      'dado_faltante', v_aval.dado_faltante
    );

    IF upper(COALESCE(v_aval.status, '')) IN (
      'EXCEDE_LIMITE_MAXIMO', 'PROIBIDO', 'NAO_CONFORME', 'BLOQUEADO'
    ) OR upper(COALESCE(v_aval.status, '')) LIKE '%EXCEDE%'
       OR upper(COALESCE(v_aval.status, '')) LIKE '%PROIB%'
    THEN
      v_bloqueante := true;
    ELSIF upper(COALESCE(v_aval.status, '')) IN (
        'SEM_LIMITE_PARA_GRUPO', 'SEM_GRUPO', 'SEM_UNIDADE_LIMITE',
        'PREMIX_SEM_POTENCIA_LOTE', 'CONVERSAO_INVALIDA',
        'SEM_VINCULO', 'VINCULO_NAO_CONFIRMADO', 'ABAIXO_LIMITE_MINIMO'
      )
       OR v_aval.limite_max_mg IS NULL
       OR NULLIF(TRIM(COALESCE(v_aval.dado_faltante, '')), '') IS NOT NULL
       OR upper(COALESCE(v_aval.status, '')) LIKE '%PENDENTE%'
       OR upper(COALESCE(v_aval.status, '')) LIKE '%FALTANTE%'
    THEN
      v_pendente := true;
    END IF;

    IF v_aval.norma IS NOT NULL THEN
      v_normas := v_normas || jsonb_build_object(
        'norma', v_aval.norma,
        'dispositivo', COALESCE(v_aval.constituinte, v_aval.insumo),
        'data_verificacao', p_data
      );
    END IF;
  END LOOP;

  -- FURO 7: associação por constituinte_id (não substring de nome)
  FOR v_assoc IN
    SELECT a.*
    FROM public.anvisa_associacoes_proibidas a
    WHERE a.ativo IS DISTINCT FROM false
      AND a.constituinte_a_id IS NOT NULL
      AND a.constituinte_b_id IS NOT NULL
  LOOP
    IF v_assoc.constituinte_a_id = ANY (v_const_ids)
       AND v_assoc.constituinte_b_id = ANY (v_const_ids)
    THEN
      v_bloqueante := true;
      v_associacoes := v_associacoes || jsonb_build_object(
        'a', v_assoc.constituinte_a_nome,
        'b', v_assoc.constituinte_b_nome,
        'a_id', v_assoc.constituinte_a_id,
        'b_id', v_assoc.constituinte_b_id,
        'norma', v_assoc.norma
      );
    END IF;
  END LOOP;

  IF v_bloqueante THEN
    v_status_geral := 'NAO_CONFORME';
  ELSIF v_pendente
     OR v_grupo IS NULL
     OR jsonb_array_length(v_aleg_proib) > 0
     OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_identidade) e
          WHERE e->>'status' IS DISTINCT FROM 'CONFIRMADO'
        )
  THEN
    v_status_geral := 'PENDENTE_RT';
  ELSE
    v_status_geral := 'CONFORME';
  END IF;

  IF v_status_geral = 'CONFORME' AND jsonb_array_length(v_identidade) = 0 THEN
    v_status_geral := 'PENDENTE_RT';
  END IF;

  v_parecer := jsonb_build_object(
    'statusGeral', v_status_geral,
    'bloqueante', v_bloqueante,
    'formulaId', p_formula_id,
    'dataReferencia', p_data,
    'verificacoes', jsonb_build_object(
      'identidade', v_identidade,
      'limites', v_limites,
      'grupo', jsonb_build_object(
        'grupo', v_grupo,
        'dado_faltante', CASE WHEN v_grupo IS NULL THEN 'grupo' ELSE NULL END,
        'incompativeis', v_grupo_inc
      ),
      'associacoes', v_associacoes,
      'alegacoes', jsonb_build_object(
        'permitidas', v_aleg_perm,
        'proibidas', v_aleg_proib,
        'advertencias', v_advert
      )
    ),
    'normasAplicadas', v_normas,
    'snapshotId', NULL
  );

  IF p_documento_tipo IS NOT NULL AND v_company IS NOT NULL THEN
    SELECT string_agg(x, ' — ')
      INTO v_rt
    FROM (
      SELECT (rt.nome_completo || ' — ' || rt.tipo_conselho || '-' || rt.uf_conselho || ' ' || rt.numero_registro) AS x
      FROM public.responsaveis_tecnicos rt
      WHERE rt.company_id = v_company
        AND rt.status = 'ATIVO'
      ORDER BY rt.validade_registro DESC NULLS LAST
      LIMIT 1
    ) s;

    v_hash := encode(
      digest(
        v_parecer::text || coalesce(p_documento_tipo, '') || coalesce(p_documento_id::text, ''),
        'sha256'
      ),
      'hex'
    );

    INSERT INTO public.regulatory_snapshots (
      company_id, documento_tipo, documento_id, formula_id, versao_formula,
      parecer, normas, rt_responsavel, hash_snapshot
    ) VALUES (
      v_company,
      p_documento_tipo,
      p_documento_id,
      p_formula_id,
      v_formula.versao,
      v_parecer,
      v_normas,
      v_rt,
      v_hash
    )
    RETURNING id INTO v_snapshot_id;

    v_parecer := jsonb_set(v_parecer, '{snapshotId}', to_jsonb(v_snapshot_id));
  END IF;

  RETURN v_parecer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.converter_para_unidade(numeric, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anvisa_limite_para_mg(numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anvisa_avaliar_formula(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.regulatory_validar_produto(uuid, date, text, text[], text, uuid)
  TO authenticated, service_role;
