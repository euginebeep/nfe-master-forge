-- ============================================================================
-- Limite por grupo populacional + fator de premix variável por lote
--
-- (A) anvisa_avaliar_formula NÃO pode usar limite genérico (adulto) para criança.
-- (B) Premix UI→mg vem da potência do LOTE (COA), nunca do fator da D3 pura.
-- Na dúvida → PENDENTE / bloqueia cálculo. Nunca inventa.
--
-- AVISO: CREATE OR REPLACE em anvisa_avaliar_formula — o corpo original não está
-- versionado no repo; esta versão implementa o contrato documentado + grupo.
-- Claude DEVE testar contra fórmula real ANTES de apply_migration em prod.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Flag: este item É um premix (diluição), não o ativo puro
ALTER TABLE public.itens
  ADD COLUMN IF NOT EXISTS eh_premix boolean NOT NULL DEFAULT false;

-- Potência do lote validada pela RT (CQ do premix)
ALTER TABLE public.estoque_lotes
  ADD COLUMN IF NOT EXISTS potencia_validada_rt boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS potencia_validada_em timestamptz,
  ADD COLUMN IF NOT EXISTS potencia_validada_por text;

COMMENT ON COLUMN public.itens.eh_premix IS
  'True se o cadastro é premix/diluição. Fator UI→mg NÃO usa conversoes_unidades do puro — só potência do lote.';
COMMENT ON COLUMN public.estoque_lotes.potencia_validada_rt IS
  'RT validou a potência (UI/g ou mg/g) vinda do CQ/COA do lote do premix.';

-- ============================================================================
-- Parse de limite (texto Power BI ou JSON estruturado)
-- Ex. texto: "Mínimo: 2,25 μg\n\nMáximo: 37,5 μg"
-- Ex. struct: {"min": 2.25, "max": 37.5, "unidade": "μg"}
-- ============================================================================
CREATE OR REPLACE FUNCTION public.f_parse_limite_anvisa(p_limite jsonb)
RETURNS TABLE (
  limite_min numeric,
  limite_max numeric,
  unidade text
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_texto text;
  v_min_s text;
  v_max_s text;
  v_uni text;
  v_min numeric;
  v_max numeric;
BEGIN
  IF p_limite IS NULL OR p_limite = 'null'::jsonb THEN
    RETURN;
  END IF;

  -- Estruturado {min,max,unidade}
  IF p_limite ? 'max' OR p_limite ? 'min' THEN
    v_min_s := nullif(trim(p_limite->>'min'), '');
    v_max_s := nullif(trim(p_limite->>'max'), '');
    v_uni := nullif(trim(p_limite->>'unidade'), '');

    IF v_min_s IS NOT NULL AND upper(v_min_s) NOT IN ('NE', 'NA', 'N/A', '-') THEN
      BEGIN
        v_min := replace(v_min_s, ',', '.')::numeric;
      EXCEPTION WHEN others THEN
        v_min := NULL;
      END;
    END IF;

    IF v_max_s IS NOT NULL AND upper(v_max_s) NOT IN ('NE', 'NA', 'N/A', '-') THEN
      BEGIN
        v_max := replace(v_max_s, ',', '.')::numeric;
      EXCEPTION WHEN others THEN
        v_max := NULL;
      END;
    END IF;

    IF v_min IS NULL AND v_max IS NULL THEN
      RETURN;
    END IF;

    v_uni := lower(replace(replace(coalesce(v_uni, 'mg'), 'µ', 'u'), 'μ', 'u'));
    IF v_uni IN ('ug', 'mcg') OR v_uni ~ '^u.?g$' THEN
      v_uni := 'mcg';
    END IF;

    limite_min := v_min;
    limite_max := v_max;
    unidade := COALESCE(NULLIF(v_uni, ''), 'mg');
    RETURN NEXT;
    RETURN;
  END IF;

  -- Power BI: {"texto": "Mínimo: … Máximo: …"}
  v_texto := coalesce(p_limite->>'texto', p_limite#>>'{}');
  IF v_texto IS NULL OR length(trim(v_texto)) = 0 THEN
    RETURN;
  END IF;

  v_min_s := (regexp_match(v_texto, 'M[ií]nimo\s*:\s*([0-9]+(?:[.,][0-9]+)?)', 'i'))[1];
  v_max_s := (regexp_match(v_texto, 'M[aá]ximo\s*:\s*([0-9]+(?:[.,][0-9]+)?)', 'i'))[1];
  v_uni := (regexp_match(v_texto, 'M[aá]ximo\s*:\s*[0-9]+(?:[.,][0-9]+)?\s*([µμu]?g|mg|UI|mcg|ug)', 'i'))[1];
  IF v_uni IS NULL THEN
    v_uni := (regexp_match(v_texto, 'M[ií]nimo\s*:\s*[0-9]+(?:[.,][0-9]+)?\s*([µμu]?g|mg|UI|mcg|ug)', 'i'))[1];
  END IF;
  IF v_uni IS NULL THEN
    v_uni := (regexp_match(v_texto, '([µμu]?g|mg|UI|mcg|ug)\b', 'i'))[1];
  END IF;

  IF v_min_s IS NOT NULL THEN
    BEGIN v_min := replace(v_min_s, ',', '.')::numeric; EXCEPTION WHEN others THEN v_min := NULL; END;
  END IF;
  IF v_max_s IS NOT NULL THEN
    BEGIN v_max := replace(v_max_s, ',', '.')::numeric; EXCEPTION WHEN others THEN v_max := NULL; END;
  END IF;

  IF v_min IS NULL AND v_max IS NULL THEN
    RETURN;
  END IF;

  -- Normaliza unidade
  v_uni := lower(replace(replace(coalesce(v_uni, 'mg'), 'µ', 'u'), 'μ', 'u'));
  IF v_uni IN ('ug', 'mcg') OR v_uni ~ '^u.?g$' THEN
    v_uni := 'mcg';
  END IF;

  limite_min := v_min;
  limite_max := v_max;
  unidade := COALESCE(NULLIF(v_uni, ''), 'mg');
  RETURN NEXT;
END;
$$;

-- Converte limite na unidade original → mg (para comparar com ativo_*_mg)
CREATE OR REPLACE FUNCTION public.anvisa_limite_para_mg(p_valor numeric, p_unidade text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  u text := lower(replace(replace(coalesce(p_unidade, 'mg'), 'µ', 'u'), 'μ', 'u'));
BEGIN
  IF p_valor IS NULL THEN RETURN NULL; END IF;
  IF u IN ('ug', 'mcg') OR u LIKE 'u%g' THEN
    RETURN p_valor / 1000.0; -- mcg → mg
  END IF;
  IF u = 'g' THEN
    RETURN p_valor * 1000.0;
  END IF;
  -- UI: não converte sem substância — retorna NULL (caller trata)
  IF u = 'ui' THEN
    RETURN NULL;
  END IF;
  RETURN p_valor; -- mg
END;
$$;

-- ============================================================================
-- Limite do constituinte PARA O GRUPO da fórmula
-- ============================================================================
CREATE OR REPLACE FUNCTION public.anvisa_limite_por_grupo(
  p_constituinte_id uuid,
  p_grupo text
)
RETURNS TABLE (
  limite_min numeric,
  limite_max numeric,
  unidade text,
  limite_min_mg numeric,
  limite_max_mg numeric,
  coluna_fonte text,
  grupo_normalizado text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  g text;
  j jsonb;
  parsed record;
  col text;
BEGIN
  IF p_constituinte_id IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO c
  FROM public.anvisa_constituintes x
  WHERE x.id = p_constituinte_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  g := lower(unaccent(trim(coalesce(p_grupo, ''))));
  g := regexp_replace(g, '\s+', '_', 'g');
  g := regexp_replace(g, '[^a-z0-9_]', '', 'g');

  IF g = '' THEN
    RETURN; -- sem grupo → NULL → PENDENTE_RT
  END IF;

  -- Mapa UI (AnvisaCheckerForm / laudo) + aliases
  IF g IN (
    'adultos', 'adulto', 'adultos_19', 'adultos_19plus', 'adultos19plus',
    '19_mais', '19mais', 'maiores_19', 'idosos', 'idoso'
  ) THEN
    j := c.limites_19_mais; col := 'limites_19_mais'; g := 'adultos_19_mais';
  ELSIF g IN (
    'criancas_4_8', 'crianca_4_8', 'criancas48', '4_8', '4a8',
    'crianca_4_a_8', 'criancas_4_a_8'
  ) THEN
    j := c.limites_4_8_anos; col := 'limites_4_8_anos'; g := 'criancas_4_8';
  ELSIF g IN (
    'criancas_9_18', 'crianca_9_18', 'criancas918', '9_18', '9a18',
    'crianca_9_a_18', 'criancas_9_a_18'
  ) THEN
    j := c.limites_9_18_anos; col := 'limites_9_18_anos'; g := 'criancas_9_18';
  ELSIF g IN (
    'criancas_1_3', 'crianca_1_3', '1_3', '1a3'
  ) THEN
    j := c.limites_1_3_anos; col := 'limites_1_3_anos'; g := 'criancas_1_3';
  ELSIF g IN (
    'lactentes_0_6', 'lactentes_0_6m', '0_6', '0_6_meses', '0a6'
  ) THEN
    j := c.limites_0_6_meses; col := 'limites_0_6_meses'; g := 'lactentes_0_6';
  ELSIF g IN (
    'lactentes_7_11', 'lactentes_7_11m', '7_11', '7_11_meses', '7a11'
  ) THEN
    j := c.limites_7_11_meses; col := 'limites_7_11_meses'; g := 'lactentes_7_11';
  ELSIF g IN ('gestantes', 'gestante') THEN
    j := c.limites_gestantes; col := 'limites_gestantes'; g := 'gestantes';
  ELSIF g IN ('lactantes', 'lactante') THEN
    j := c.limites_lactantes; col := 'limites_lactantes'; g := 'lactantes';
  ELSE
    RETURN; -- string sem mapa → NULL → PENDENTE_RT
  END IF;

  IF j IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO parsed FROM public.f_parse_limite_anvisa(j) LIMIT 1;
  IF NOT FOUND OR (parsed.limite_min IS NULL AND parsed.limite_max IS NULL) THEN
    RETURN;
  END IF;

  limite_min := parsed.limite_min;
  limite_max := parsed.limite_max;
  unidade := parsed.unidade;
  limite_min_mg := public.anvisa_limite_para_mg(parsed.limite_min, parsed.unidade);
  limite_max_mg := public.anvisa_limite_para_mg(parsed.limite_max, parsed.unidade);
  coluna_fonte := col;
  grupo_normalizado := g;
  RETURN NEXT;
END;
$$;

-- ============================================================================
-- Fator UI→mg a partir da potência do LOTE do premix
-- potencia UI/g → mg/UI = 1000 / potencia_ui_g
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fator_ui_mg_do_lote(p_lote_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  l record;
  it record;
  fator numeric;
BEGIN
  IF p_lote_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'LOTE_NAO_INFORMADO',
      'mensagem', 'Informe o lote do premix para converter UI→mg.'
    );
  END IF;

  SELECT * INTO l FROM public.estoque_lotes WHERE id = p_lote_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'motivo', 'LOTE_NAO_ENCONTRADO');
  END IF;

  SELECT * INTO it FROM public.itens WHERE id = l.item_id;

  IF coalesce(it.eh_premix, false) IS NOT TRUE
     AND upper(coalesce(it.tipo_item, '')) IS DISTINCT FROM 'PREMIX' THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'ITEM_NAO_E_PREMIX',
      'mensagem', 'Fator por lote só se aplica a itens marcados como premix.'
    );
  END IF;

  IF l.tipo_potencia IS DISTINCT FROM 'UI_POR_GRAMA'
     OR l.potencia_valor IS NULL
     OR l.potencia_valor <= 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'motivo', 'PREMIX_SEM_POTENCIA_LOTE',
      'mensagem', 'Premix sem potência (UI/g) no lote. Não usar fator da D3 pura — informe a potência do COA/CQ.'
    );
  END IF;

  -- 1 g = potencia_valor UI → 1 UI = 1000/potencia_valor mg de premix
  fator := 1000.0 / l.potencia_valor;

  RETURN jsonb_build_object(
    'ok', true,
    'fator_ui_para_mg', fator,
    'potencia_ui_g', l.potencia_valor,
    'potencia_validada_rt', coalesce(l.potencia_validada_rt, false),
    'fonte', format('estoque_lotes.potencia_valor=%s UI/g (lote %s)', l.potencia_valor, l.numero_lote),
    'mensagem', format('1 UI = %s mg de premix (potência %s UI/g)', fator, l.potencia_valor)
  );
END;
$$;

-- ============================================================================
-- Motor: anvisa_avaliar_formula — usa limite POR GRUPO
-- DROP da assinatura antiga (2 args) para não deixar overload genérico ativo.
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

    -- Premix sem potência em nenhum lote → não inventa fator da pura
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

    SELECT * INTO v
    FROM public.item_anvisa_vinculo iv
    WHERE iv.item_id = fi.produto_materia_prima_id
      AND iv.status = 'confirmado'
    ORDER BY iv.confirmado_em DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      IF EXISTS (
        SELECT 1 FROM public.item_anvisa_vinculo iv2
        WHERE iv2.item_id = fi.produto_materia_prima_id
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

    -- Massa do insumo / dia (mg de matéria-prima)
    v_massa_dia := coalesce(fi.quantidade_convertida_mg, 0) * v_n_caps * v_doses;

    v_teor_max := COALESCE(v.teor_max_pct, v.teor_nominal_pct, v.teor_valor);
    v_teor_min := COALESCE(v.teor_min_pct, v.teor_nominal_pct, v.teor_valor);

    IF v_teor_max IS NOT NULL AND v_teor_max > 0 THEN
      -- teor em % (sal → elemento / ensaio)
      IF v_teor_max <= 1000 THEN
        v_teto := v_massa_dia * (v_teor_max / 100.0);
      ELSE
        v_teto := v_massa_dia; -- valor absurdo → não multiplica
      END IF;
    ELSE
      v_teto := v_massa_dia;
      v_faltante := COALESCE(v_faltante, 'teor');
    END IF;

    IF v_teor_min IS NOT NULL AND v_teor_min > 0 AND v_teor_min <= 1000 THEN
      v_piso := v_massa_dia * (v_teor_min / 100.0);
    ELSE
      v_piso := v_teto;
    END IF;

    -- Overage aumenta massa fabricada, não a dose rotulada regulatória
    ativo_teto_mg := round(v_teto, 8);
    ativo_piso_mg := round(v_piso, 8);

    IF v_grupo IS NULL THEN
      status := 'SEM_GRUPO';
      dado_faltante := 'grupo';
      RETURN NEXT;
      CONTINUE;
    END IF;

    SELECT * INTO lim
    FROM public.anvisa_limite_por_grupo(c.id, v_grupo)
    LIMIT 1;

    IF NOT FOUND OR lim.limite_max_mg IS NULL THEN
      status := 'SEM_LIMITE_PARA_GRUPO';
      dado_faltante := 'limite_grupo';
      limite_min_mg := NULL;
      limite_max_mg := NULL;
      RETURN NEXT;
      CONTINUE;
    END IF;

    limite_min_mg := lim.limite_min_mg;
    limite_max_mg := lim.limite_max_mg;

    IF ativo_teto_mg IS NOT NULL AND lim.limite_max_mg IS NOT NULL
       AND ativo_teto_mg > lim.limite_max_mg THEN
      v_status := 'EXCEDE_LIMITE_MAXIMO';
    ELSIF lim.limite_min_mg IS NOT NULL AND ativo_piso_mg IS NOT NULL
          AND ativo_piso_mg < lim.limite_min_mg THEN
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
  'Avalia teto/piso por insumo contra limite do GRUPO populacional (nunca o genérico adulto por omissão).';

-- regulatory_validar_produto: passar grupo + tratar SEM_LIMITE_PARA_GRUPO
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
  v_nome_a text;
  v_nome_b text;
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
    'dispositivo', 'Anexo IV — limites por grupo populacional (via anvisa_limite_por_grupo)',
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

    SELECT v.*
      INTO v_vinculo
    FROM public.item_anvisa_vinculo v
    WHERE v.item_id = v_item.produto_materia_prima_id
      AND v.status = 'confirmado'
    ORDER BY v.confirmado_em DESC NULLS LAST
    LIMIT 1;

    IF NOT FOUND THEN
      v_pendente := true;
      IF EXISTS (
        SELECT 1 FROM public.item_anvisa_vinculo v2
        WHERE v2.item_id = v_item.produto_materia_prima_id
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

  -- Limites: CHAMA anvisa_avaliar_formula COM O GRUPO
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
        'SEM_LIMITE_PARA_GRUPO', 'SEM_GRUPO', 'PREMIX_SEM_POTENCIA_LOTE',
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

  FOR v_assoc IN
    SELECT a.*
    FROM public.anvisa_associacoes_proibidas a
    WHERE a.ativo IS DISTINCT FROM false
  LOOP
    v_nome_a := lower(v_assoc.constituinte_a_nome);
    v_nome_b := lower(v_assoc.constituinte_b_nome);
    IF EXISTS (
      SELECT 1 FROM unnest(v_const_nomes) n
      WHERE lower(n) LIKE '%' || v_nome_a || '%'
         OR v_nome_a LIKE '%' || lower(n) || '%'
    ) AND EXISTS (
      SELECT 1 FROM unnest(v_const_nomes) n
      WHERE lower(n) LIKE '%' || v_nome_b || '%'
         OR v_nome_b LIKE '%' || lower(n) || '%'
    ) THEN
      v_bloqueante := true;
      v_associacoes := v_associacoes || jsonb_build_object(
        'a', v_assoc.constituinte_a_nome,
        'b', v_assoc.constituinte_b_nome,
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

GRANT EXECUTE ON FUNCTION public.f_parse_limite_anvisa(jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anvisa_limite_para_mg(numeric, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anvisa_limite_por_grupo(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fator_ui_mg_do_lote(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.anvisa_avaliar_formula(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.regulatory_validar_produto(uuid, date, text, text[], text, uuid)
  TO authenticated, service_role;
