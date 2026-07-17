-- ============================================================================
-- VERSIONAMENTO + correção âncora (git alinhado à produção / sessão 17/07)
--
-- Correções aplicadas em prod e refletidas aqui:
-- - preservar número da vitamina (D3≠D2, B12…)
-- - trocar \b (não confiável neste banco) por [^0-9a-z]
-- - aceitar "VIT." abreviado → vitamina
-- - calcidiol/calcitriol e K1/K2 como âncoras distintas
-- CREATE OR REPLACE — idempotente. Não dropar.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.norm_texto_ancora(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    lower(unaccent(coalesce(p_texto, ''))),
    '\s+',
    ' ',
    'g'
  ));
$$;

-- Remove % / potências, preserva códigos d3/b12/k2; expande "vit." → "vitamina"
CREATE OR REPLACE FUNCTION public.limpar_nome_insumo_match(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          public.norm_texto_ancora(p_nome),
          '(^|[^0-9a-z])vit\.?\s*',
          '\1vitamina ',
          'g'
        ),
        '[0-9]+([.,][0-9]+)?\s*%',
        ' ',
        'g'
      ),
      '[0-9]+([.,][0-9]+)?\s*(ui|ug|mcg|mg|g|kg)([^0-9a-z]|$)',
      ' \3',
      'g'
    ),
    '[^a-z0-9\s]',
    ' ',
    'g'
  ));
$$;

CREATE OR REPLACE FUNCTION public.extrair_ancora_constituinte(p_nome text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n text := public.limpar_nome_insumo_match(p_nome);
BEGIN
  IF n IS NULL OR length(n) < 2 THEN
    RETURN NULL;
  END IF;

  -- Metabolitos de D — ANTES de calcio / D3
  IF n ~ '(calcidiol|25[\s-]?hidroxi|25\(oh\)|hidroxicolecalciferol)' THEN
    RETURN 'calcidiol';
  END IF;
  IF n ~ '(calcitriol|1[\s,]?25[\s-]?di)' THEN
    RETURN 'calcitriol';
  END IF;

  -- D3 ≠ D2 (usar [^0-9a-z], não \b)
  IF n ~ '(colecalciferol|vitamina\s*d3|(^|[^0-9a-z])d3([^0-9a-z]|$))' THEN
    RETURN 'colecalciferol';
  END IF;
  IF n ~ '(ergocalciferol|vitamina\s*d2|(^|[^0-9a-z])d2([^0-9a-z]|$))' THEN
    RETURN 'ergocalciferol';
  END IF;
  IF n ~ 'vitamina\s*d([^0-9a-z]|$)' THEN
    RETURN 'colecalciferol';
  END IF;

  IF n ~ '(retinol|vitamina\s*a([^0-9a-z]|$)|acetato\s*de\s*retinol|palmitato\s*de\s*retinol)' THEN
    RETURN 'retinol';
  END IF;

  IF n ~ '(tiamina|vitamina\s*b1|(^|[^0-9a-z])b1([^0-9a-z]|$))' THEN RETURN 'tiamina'; END IF;
  IF n ~ '(riboflavina|vitamina\s*b2|(^|[^0-9a-z])b2([^0-9a-z]|$))' THEN RETURN 'riboflavina'; END IF;
  IF n ~ '(niacina|nicotinamida|vitamina\s*b3|(^|[^0-9a-z])b3([^0-9a-z]|$))' THEN RETURN 'niacina'; END IF;
  IF n ~ '(pantoten|vitamina\s*b5|(^|[^0-9a-z])b5([^0-9a-z]|$))' THEN RETURN 'pantoten'; END IF;
  IF n ~ '(piridox|vitamina\s*b6|(^|[^0-9a-z])b6([^0-9a-z]|$))' THEN RETURN 'piridox'; END IF;
  IF n ~ '(biotina|vitamina\s*b7|vitamina\s*h|(^|[^0-9a-z])b7([^0-9a-z]|$))' THEN RETURN 'biotina'; END IF;
  IF n ~ '(folic|folato|metilfolato|vitamina\s*b9|(^|[^0-9a-z])b9([^0-9a-z]|$))' THEN RETURN 'folic'; END IF;
  IF n ~ '(cobalamina|cianocobalamina|metilcobalamina|hidroxocobalamina|vitamina\s*b12|(^|[^0-9a-z])b12([^0-9a-z]|$))' THEN
    RETURN 'cobalamina';
  END IF;
  IF n ~ '(ascorb|vitamina\s*c([^0-9a-z]|$))' THEN RETURN 'ascorb'; END IF;
  IF n ~ '(tocoferol|vitamina\s*e([^0-9a-z]|$))' THEN RETURN 'tocoferol'; END IF;

  -- K1 ≠ K2
  IF n ~ '(filoquinona|vitamina\s*k1|(^|[^0-9a-z])k1([^0-9a-z]|$))' THEN RETURN 'filoquinona'; END IF;
  IF n ~ '(menaquinona|vitamina\s*k2|(^|[^0-9a-z])k2([^0-9a-z]|$))' THEN RETURN 'menaquinona'; END IF;
  IF n ~ 'vitamina\s*k([^0-9a-z]|$)' THEN RETURN 'menaquinona'; END IF;

  -- Minerais (não casar "calci" dentro de calcidiol)
  IF n ~ '(magnesio|(^|[^0-9a-z])magnes([^0-9a-z]|$))' THEN RETURN 'magnes'; END IF;
  IF n ~ '(^|[^0-9a-z])zinco([^0-9a-z]|$)' THEN RETURN 'zinco'; END IF;
  IF n ~ '(^|[^0-9a-z])cromo([^0-9a-z]|$)' THEN RETURN 'cromo'; END IF;
  IF n ~ '(selenio|(^|[^0-9a-z])selen([^0-9a-z]|$))' THEN RETURN 'selen'; END IF;
  IF n ~ '(^|[^0-9a-z])(calcio|calci)([^0-9a-z]|$)' AND n !~ 'calcidiol|calcitriol|colecalciferol' THEN
    RETURN 'calci';
  END IF;
  IF n ~ '(ferroso|ferrico|(^|[^0-9a-z])ferro([^0-9a-z]|$))' THEN RETURN 'ferro'; END IF;
  IF n ~ '(^|[^0-9a-z])cobre([^0-9a-z]|$)' THEN RETURN 'cobre'; END IF;
  IF n ~ '(manganes|(^|[^0-9a-z])mangan([^0-9a-z]|$))' THEN RETURN 'mangan'; END IF;
  IF n ~ '(molibden|(^|[^0-9a-z])molibd([^0-9a-z]|$))' THEN RETURN 'molibd'; END IF;
  IF n ~ '((^|[^0-9a-z])iodo([^0-9a-z]|$)|iodeto)' THEN RETURN 'iodo'; END IF;
  IF n ~ '((^|[^0-9a-z])boro([^0-9a-z]|$)|borato)' THEN RETURN 'boro'; END IF;
  IF n ~ '(fosforo|fosfato)' THEN RETURN 'fosfor'; END IF;
  IF n ~ '(potassio|(^|[^0-9a-z])potass([^0-9a-z]|$))' THEN RETURN 'potass'; END IF;
  IF n ~ '(sodio|(^|[^0-9a-z])sod([^0-9a-z]|$))' THEN RETURN 'sodio'; END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.constituinte_casa_ancora(p_nome_tecnico text, p_ancora text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  n text := public.norm_texto_ancora(p_nome_tecnico);
  a text := public.norm_texto_ancora(p_ancora);
  a_cand text;
BEGIN
  IF a IS NULL OR a = '' OR n IS NULL OR n = '' THEN
    RETURN false;
  END IF;

  a_cand := public.extrair_ancora_constituinte(p_nome_tecnico);

  IF a = 'colecalciferol' THEN
    IF a_cand IN ('ergocalciferol', 'calcidiol', 'calcitriol') THEN RETURN false; END IF;
    IF n ~ '(ergocalciferol|calcidiol|calcitriol|vitamina\s*d2|(^|[^0-9a-z])d2([^0-9a-z]|$))' THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%colecalciferol%'
        OR n ~ 'vitamina\s*d3|(^|[^0-9a-z])d3([^0-9a-z]|$)'
        OR (n ~ 'vitamina\s*d([^0-9a-z]|$)' AND n !~ 'd2|calcidiol|calcitriol')
        OR a_cand = 'colecalciferol';
  END IF;

  IF a = 'ergocalciferol' THEN
    IF a_cand IN ('colecalciferol', 'calcidiol', 'calcitriol') THEN RETURN false; END IF;
    RETURN n LIKE '%ergocalciferol%'
        OR n ~ 'vitamina\s*d2|(^|[^0-9a-z])d2([^0-9a-z]|$)'
        OR a_cand = 'ergocalciferol';
  END IF;

  IF a = 'calcidiol' THEN
    RETURN a_cand = 'calcidiol' OR n ~ 'calcidiol|25[\s-]?hidroxi';
  END IF;

  IF a = 'calcitriol' THEN
    RETURN a_cand = 'calcitriol' OR n ~ 'calcitriol';
  END IF;

  IF a = 'filoquinona' THEN
    IF a_cand = 'menaquinona' OR n ~ 'menaquinona|vitamina\s*k2|(^|[^0-9a-z])k2([^0-9a-z]|$)' THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%filoquinona%'
        OR n ~ 'vitamina\s*k1|(^|[^0-9a-z])k1([^0-9a-z]|$)'
        OR a_cand = 'filoquinona';
  END IF;

  IF a = 'menaquinona' THEN
    IF a_cand = 'filoquinona' OR n ~ 'filoquinona|vitamina\s*k1|(^|[^0-9a-z])k1([^0-9a-z]|$)' THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%menaquinona%'
        OR n ~ 'vitamina\s*k2|(^|[^0-9a-z])k2([^0-9a-z]|$)'
        OR a_cand = 'menaquinona'
        OR (n ~ 'vitamina\s*k([^0-9a-z]|$)' AND n !~ 'k1|filoquinona');
  END IF;

  IF a = 'retinol' THEN
    RETURN n LIKE '%retinol%' OR n ~ 'vitamina\s*a([^0-9a-z]|$)' OR a_cand = 'retinol';
  END IF;

  IF position(a in n) = 0 AND (a_cand IS NULL OR a_cand IS DISTINCT FROM a) THEN
    RETURN false;
  END IF;

  IF a_cand IS NOT NULL AND a_cand IS DISTINCT FROM a THEN
    RETURN false;
  END IF;

  RETURN position(a in n) > 0 OR a_cand = a;
END;
$$;

-- Score: sem corte mínimo agressivo (filtro fino fica na UI / confianca)
CREATE OR REPLACE FUNCTION public.score_match_constituinte(p_insumo text, p_constituinte text)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  i text := public.limpar_nome_insumo_match(p_insumo);
  c text := public.limpar_nome_insumo_match(p_constituinte);
  base numeric;
  bonus numeric := 0;
  forma text;
  formas text[] := ARRAY[
    'bisglicinato', 'glicinato', 'malato', 'picolinato', 'taurato',
    'quelato', 'citrato', 'oxido', 'carbonato', 'sulfato', 'gluconato',
    'ascorbato', 'lactato', 'fumarato', 'succinato', 'pidolato',
    'orotato', 'treonato', 'aspartato', 'histidinato', 'metionina',
    'selenito', 'selenato', 'selenometionina', 'iodeto', 'cloreto'
  ];
  tok text;
  toks_i text[];
  toks_c text[];
  overlap int := 0;
BEGIN
  IF i = '' OR c = '' THEN
    RETURN 0;
  END IF;

  base := similarity(i, c)::numeric;

  FOREACH forma IN ARRAY formas LOOP
    IF position(forma in i) > 0 AND position(forma in c) > 0 THEN
      bonus := bonus + 0.22;
    END IF;
  END LOOP;

  toks_i := regexp_split_to_array(i, '\s+');
  toks_c := regexp_split_to_array(c, '\s+');
  FOREACH tok IN ARRAY toks_i LOOP
    IF length(tok) >= 3 AND tok = ANY (toks_c) THEN
      overlap := overlap + 1;
    END IF;
  END LOOP;
  bonus := bonus + LEAST(overlap, 4) * 0.05;

  RETURN LEAST(1.0, base + bonus);
END;
$$;

CREATE OR REPLACE FUNCTION public.sugerir_constituintes_por_nome(p_nome text)
RETURNS TABLE (
  constituinte_id uuid,
  nome_tecnico text,
  ancora text,
  score numeric,
  confianca text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ancora text;
  v_count int := 0;
  v_top numeric := 0;
  v_second numeric := 0;
  v_conf text;
BEGIN
  v_ancora := public.extrair_ancora_constituinte(p_nome);

  IF v_ancora IS NULL THEN
    RETURN;
  END IF;

  SELECT count(*)::int,
         coalesce(max(s.score), 0),
         coalesce((array_agg(s.score ORDER BY s.score DESC))[2], 0)
    INTO v_count, v_top, v_second
  FROM (
    SELECT public.score_match_constituinte(p_nome, c.nome_tecnico) AS score
    FROM public.anvisa_constituintes c
    WHERE COALESCE(c.ativo, true) IS TRUE
      AND public.constituinte_casa_ancora(c.nome_tecnico, v_ancora)
      AND public.score_match_constituinte(p_nome, c.nome_tecnico) > 0
    ORDER BY 1 DESC
    LIMIT 5
  ) s;

  IF v_count = 0 THEN
    RETURN;
  END IF;

  IF v_count = 1 AND v_top >= 0.28 THEN
    v_conf := 'alta';
  ELSIF v_top >= 0.45 AND (v_top - v_second) >= 0.12 THEN
    v_conf := 'alta';
  ELSIF v_top >= 0.35 AND v_count <= 2 THEN
    v_conf := 'alta';
  ELSE
    v_conf := 'media';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.nome_tecnico,
    v_ancora,
    round(public.score_match_constituinte(p_nome, c.nome_tecnico), 4),
    v_conf
  FROM public.anvisa_constituintes c
  WHERE COALESCE(c.ativo, true) IS TRUE
    AND public.constituinte_casa_ancora(c.nome_tecnico, v_ancora)
    AND public.score_match_constituinte(p_nome, c.nome_tecnico) > 0
  ORDER BY public.score_match_constituinte(p_nome, c.nome_tecnico) DESC, c.nome_tecnico
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.norm_texto_ancora(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.limpar_nome_insumo_match(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extrair_ancora_constituinte(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.constituinte_casa_ancora(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.score_match_constituinte(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sugerir_constituintes_por_nome(text) TO authenticated, service_role;
