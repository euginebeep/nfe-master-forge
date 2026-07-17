-- ============================================================================
-- VERSIONAMENTO + correção âncora (git alinhado à intenção produtiva)
--
-- Sem acesso a pg_get_functiondef neste ambiente; comportamento em produção foi
-- sondado via RPC. Esta migration:
-- 1) preserva o contrato das funções do match por âncora;
-- 2) corrige regressões conhecidas: calcidiol≠calcio, D metabolitos, K1≠K2,
--    e códigos d3/b12 que perdiam o dígito em limpar_nome_insumo_match.
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

-- Remove % / ruído comercial, mas PRESERVA códigos de vitamina (d3, b12, k2…)
CREATE OR REPLACE FUNCTION public.limpar_nome_insumo_match(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        public.norm_texto_ancora(p_nome),
        -- percentuais / potências (mantém d3/b12: só remove nº seguido de % ou UI/ug/mg/g isolados)
        '[0-9]+([.,][0-9]+)?\s*%',
        ' ',
        'g'
      ),
      '[0-9]+([.,][0-9]+)?\s*(ui|ug|mcg|mg|g|kg)\b',
      ' ',
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

  -- Metabolitos / formas de D — ANTES de calcio e D3 genérico
  IF n ~ '(calcidiol|25[\s-]?hidroxi|25\(oh\)|hidroxicolecalciferol)' THEN
    RETURN 'calcidiol';
  END IF;
  IF n ~ '(calcitriol|1[\s,]?25[\s-]?di)' THEN
    RETURN 'calcitriol';
  END IF;

  -- Vitaminas D (hard rule: D3 ≠ D2)
  IF n ~ '(colecalciferol|vitamina\s*d3|\bd3\b)' THEN
    RETURN 'colecalciferol';
  END IF;
  IF n ~ '(ergocalciferol|vitamina\s*d2|\bd2\b)' THEN
    RETURN 'ergocalciferol';
  END IF;
  IF n ~ 'vitamina\s*d\b' THEN
    RETURN 'colecalciferol';
  END IF;

  -- Vitamina A
  IF n ~ '(retinol|vitamina\s*a\b|acetato\s*de\s*retinol|palmitato\s*de\s*retinol)' THEN
    RETURN 'retinol';
  END IF;

  -- Demais vitaminas
  IF n ~ '(tiamina|vitamina\s*b1\b|\bb1\b)' THEN RETURN 'tiamina'; END IF;
  IF n ~ '(riboflavina|vitamina\s*b2\b|\bb2\b)' THEN RETURN 'riboflavina'; END IF;
  IF n ~ '(niacina|nicotinamida|vitamina\s*b3\b|\bb3\b)' THEN RETURN 'niacina'; END IF;
  IF n ~ '(pantoten|vitamina\s*b5\b|\bb5\b)' THEN RETURN 'pantoten'; END IF;
  IF n ~ '(piridox|vitamina\s*b6\b|\bb6\b)' THEN RETURN 'piridox'; END IF;
  IF n ~ '(biotina|vitamina\s*b7\b|vitamina\s*h\b|\bb7\b)' THEN RETURN 'biotina'; END IF;
  IF n ~ '(folic|folato|metilfolato|vitamina\s*b9\b|\bb9\b)' THEN RETURN 'folic'; END IF;
  IF n ~ '(cobalamina|cianocobalamina|metilcobalamina|hidroxocobalamina|vitamina\s*b12\b|\bb12\b)' THEN
    RETURN 'cobalamina';
  END IF;
  IF n ~ '(ascorb|vitamina\s*c\b)' THEN RETURN 'ascorb'; END IF;
  IF n ~ '(tocoferol|vitamina\s*e\b)' THEN RETURN 'tocoferol'; END IF;

  -- K1 ≠ K2
  IF n ~ '(filoquinona|vitamina\s*k1\b|\bk1\b)' THEN RETURN 'filoquinona'; END IF;
  IF n ~ '(menaquinona|vitamina\s*k2\b|\bk2\b)' THEN RETURN 'menaquinona'; END IF;
  IF n ~ 'vitamina\s*k\b' THEN RETURN 'menaquinona'; END IF;

  -- Minerais (word-boundary / stem — NÃO casar "calci" em "calcidiol")
  IF n ~ '(magnesio|\bmagnes\b)' THEN RETURN 'magnes'; END IF;
  IF n ~ '\bzinco\b' THEN RETURN 'zinco'; END IF;
  IF n ~ '\bcromo\b' THEN RETURN 'cromo'; END IF;
  IF n ~ '(selenio|\bselen\b)' THEN RETURN 'selen'; END IF;
  IF n ~ '(^|[^a-z])(calcio|calci)([^a-z]|$)' AND n !~ 'calcidiol|calcitriol|colecalciferol' THEN
    RETURN 'calci';
  END IF;
  IF n ~ '(ferroso|ferrico|\bferro\b)' THEN RETURN 'ferro'; END IF;
  IF n ~ '\bcobre\b' THEN RETURN 'cobre'; END IF;
  IF n ~ '(manganes|\bmangan\b)' THEN RETURN 'mangan'; END IF;
  IF n ~ '(molibden|\bmolibd\b)' THEN RETURN 'molibd'; END IF;
  IF n ~ '(\biodo\b|iodeto)' THEN RETURN 'iodo'; END IF;
  IF n ~ '(\bboro\b|borato)' THEN RETURN 'boro'; END IF;
  IF n ~ '(fosforo|fosfato)' THEN RETURN 'fosfor'; END IF;
  IF n ~ '(potassio|\bpotass\b)' THEN RETURN 'potass'; END IF;
  IF n ~ '(sodio|\bsod\b)' THEN RETURN 'sodio'; END IF;

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
    IF a_cand IN ('ergocalciferol', 'calcidiol', 'calcitriol') THEN
      RETURN false;
    END IF;
    IF n ~ '(ergocalciferol|calcidiol|calcitriol|vitamina\s*d2)' THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%colecalciferol%'
        OR n ~ 'vitamina\s*d3'
        OR (n ~ 'vitamina\s*d\b' AND n !~ 'd2|calcidiol|calcitriol')
        OR a_cand = 'colecalciferol';
  END IF;

  IF a = 'ergocalciferol' THEN
    IF a_cand IN ('colecalciferol', 'calcidiol', 'calcitriol') THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%ergocalciferol%' OR n ~ 'vitamina\s*d2' OR a_cand = 'ergocalciferol';
  END IF;

  IF a = 'calcidiol' THEN
    RETURN a_cand = 'calcidiol' OR n ~ 'calcidiol|25[\s-]?hidroxi';
  END IF;

  IF a = 'calcitriol' THEN
    RETURN a_cand = 'calcitriol' OR n ~ 'calcitriol';
  END IF;

  IF a = 'filoquinona' THEN
    IF a_cand = 'menaquinona' OR n ~ 'menaquinona|vitamina\s*k2' THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%filoquinona%' OR n ~ 'vitamina\s*k1' OR a_cand = 'filoquinona';
  END IF;

  IF a = 'menaquinona' THEN
    IF a_cand = 'filoquinona' OR n ~ 'filoquinona|vitamina\s*k1' THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%menaquinona%' OR n ~ 'vitamina\s*k2' OR a_cand = 'menaquinona'
        OR (n ~ 'vitamina\s*k\b' AND n !~ 'k1|filoquinona');
  END IF;

  IF a = 'retinol' THEN
    RETURN n LIKE '%retinol%' OR n ~ 'vitamina\s*a\b' OR a_cand = 'retinol';
  END IF;

  IF position(a in n) = 0 AND a_cand IS DISTINCT FROM a THEN
    RETURN false;
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

-- Mantém sugerir_constituintes_por_nome (mesma lógica; depende das âncoras acimaidas)
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
      AND public.score_match_constituinte(p_nome, c.nome_tecnico) > 0.05
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
    AND public.score_match_constituinte(p_nome, c.nome_tecnico) > 0.05
  ORDER BY public.score_match_constituinte(p_nome, c.nome_tecnico) DESC, c.nome_tecnico
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.norm_texto_ancora(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.limpar_nome_insumo_match(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extrair_ancora_constituinte(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.constituinte_casa_ancora(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sugerir_constituintes_por_nome(text) TO authenticated, service_role;
