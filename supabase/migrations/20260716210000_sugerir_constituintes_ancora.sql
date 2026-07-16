-- ============================================================================
-- Match inteligente insumo → constituinte por ELEMENTO ÂNCORA
-- Premissa: nunca casar mineral com elemento errado (Mg≠Fe, D3≠D2).
-- O sistema SUGERE; a RT confirma. Em dúvida → lista ranqueada / nenhuma.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Normaliza (minúsculo, sem acento)
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

-- Remove % / números / ruído comercial do nome do insumo
CREATE OR REPLACE FUNCTION public.limpar_nome_insumo_match(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      public.norm_texto_ancora(p_nome),
      '[0-9]+([.,][0-9]+)?\s*%?',
      ' ',
      'g'
    ),
    '[^a-z0-9\s]',
    ' ',
    'g'
  ));
$$;

-- Extrai o elemento âncora (mineral/vitamina) que define o constituinte.
-- Ordem: padrões mais específicos primeiro. D3 ≠ D2 (âncoras distintas).
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

  -- Vitaminas D (hard rule: D3 ≠ D2). calcitriol ≠ cálcio.
  IF n ~ '(colecalciferol|calcitriol|vitamina\s*d3|\bd3\b)' THEN
    RETURN 'colecalciferol';
  END IF;
  IF n ~ '(ergocalciferol|vitamina\s*d2|\bd2\b)' THEN
    RETURN 'ergocalciferol';
  END IF;
  IF n ~ 'vitamina\s*d\b' THEN
    RETURN 'colecalciferol'; -- D genérico → D3 (nunca D2)
  END IF;

  -- Vitamina A
  IF n ~ '(retinol|vitamina\s*a\b|acetato\s*de\s*retinol|palmitato\s*de\s*retinol)' THEN
    RETURN 'retinol';
  END IF;

  -- Demais vitaminas (âncoras fortes)
  IF n ~ '(tiamina|vitamina\s*b1\b)' THEN RETURN 'tiamina'; END IF;
  IF n ~ '(riboflavina|vitamina\s*b2\b)' THEN RETURN 'riboflavina'; END IF;
  IF n ~ '(niacina|nicotinamida|vitamina\s*b3\b)' THEN RETURN 'niacina'; END IF;
  IF n ~ '(pantoten|vitamina\s*b5\b)' THEN RETURN 'pantoten'; END IF;
  IF n ~ '(piridox|vitamina\s*b6\b)' THEN RETURN 'piridox'; END IF;
  IF n ~ '(biotina|vitamina\s*b7\b|vitamina\s*h\b)' THEN RETURN 'biotina'; END IF;
  IF n ~ '(folic|folato|metilfolato|vitamina\s*b9\b)' THEN RETURN 'folic'; END IF;
  IF n ~ '(cobalamina|cianocobalamina|metilcobalamina|vitamina\s*b12\b)' THEN RETURN 'cobalamina'; END IF;
  IF n ~ '(ascorb|vitamina\s*c\b)' THEN RETURN 'ascorb'; END IF;
  IF n ~ '(tocoferol|vitamina\s*e\b)' THEN RETURN 'tocoferol'; END IF;
  IF n ~ '(menaquinona|filoquinona|vitamina\s*k2\b|vitamina\s*k1\b|vitamina\s*k\b)' THEN RETURN 'menaquinona'; END IF;

  -- Minerais (stem curto p/ pegar "dimagnesio", "dicalcio", "ferroso")
  IF n ~ '(magnesio|magnes)' THEN RETURN 'magnes'; END IF;
  IF n ~ '\bzinco\b' THEN RETURN 'zinco'; END IF;
  IF n ~ '\bcromo\b' THEN RETURN 'cromo'; END IF;
  IF n ~ '(selenio|selen)' THEN RETURN 'selen'; END IF;
  IF n ~ '(calcio|calci)' THEN RETURN 'calci'; END IF;
  IF n ~ '(ferroso|ferrico|\bferro\b)' THEN RETURN 'ferro'; END IF;
  IF n ~ '\bcobre\b' THEN RETURN 'cobre'; END IF;
  IF n ~ '(manganes|mangan)' THEN RETURN 'mangan'; END IF;
  IF n ~ '(molibden|molibd)' THEN RETURN 'molibd'; END IF;
  IF n ~ '(\biodo\b|iodeto)' THEN RETURN 'iodo'; END IF;
  IF n ~ '(\bboro\b|borato)' THEN RETURN 'boro'; END IF;
  IF n ~ '(fosforo|fosfato)' THEN RETURN 'fosfor'; END IF;
  IF n ~ '(potassio|potass)' THEN RETURN 'potass'; END IF;
  IF n ~ '(sodio|\bsod\b)' THEN RETURN 'sodio'; END IF;

  RETURN NULL;
END;
$$;

-- Candidato casa com a âncora? (regras extras p/ vitaminas D/A)
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

  -- Hard rule: âncora do candidato deve ser a mesma (evita falso positivo por substring)
  a_cand := public.extrair_ancora_constituinte(p_nome_tecnico);

  IF a = 'colecalciferol' THEN
    IF n LIKE '%ergocalciferol%' OR n ~ 'vitamina\s*d2' OR a_cand = 'ergocalciferol' THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%colecalciferol%'
        OR n ~ 'vitamina\s*d3'
        OR (n ~ 'vitamina\s*d\b' AND n NOT LIKE '%d2%')
        OR a_cand = 'colecalciferol';
  END IF;

  IF a = 'ergocalciferol' THEN
    IF n LIKE '%colecalciferol%' OR n ~ 'vitamina\s*d3' OR a_cand = 'colecalciferol' THEN
      RETURN false;
    END IF;
    RETURN n LIKE '%ergocalciferol%' OR n ~ 'vitamina\s*d2' OR a_cand = 'ergocalciferol';
  END IF;

  IF a = 'retinol' THEN
    RETURN n LIKE '%retinol%' OR n ~ 'vitamina\s*a\b' OR a_cand = 'retinol';
  END IF;

  -- Demais: nome contém o stem E (se candidato tem âncora) ela bate
  IF position(a in n) = 0 THEN
    RETURN false;
  END IF;

  IF a_cand IS NOT NULL AND a_cand IS DISTINCT FROM a THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- Score: similaridade trigram + bônus por forma/sal (bisglicinato, malato…)
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
    IF length(tok) >= 4 AND tok = ANY (toks_c) THEN
      overlap := overlap + 1;
    END IF;
  END LOOP;
  bonus := bonus + LEAST(overlap, 4) * 0.05;

  RETURN LEAST(1.0, base + bonus);
END;
$$;

-- Núcleo por nome (útil p/ teste e p/ item_id)
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
    RETURN; -- confianca='nenhuma' → zero linhas (UI trata)
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

-- Assinatura pedida pelo brief: por item_id
CREATE OR REPLACE FUNCTION public.sugerir_constituintes(p_item_id uuid)
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
  v_company uuid := public.get_user_company_id();
  v_nome text;
BEGIN
  IF p_item_id IS NULL THEN
    RETURN;
  END IF;

  SELECT i.descricao_interna
    INTO v_nome
  FROM public.itens i
  WHERE i.id = p_item_id
    AND (v_company IS NULL OR i.company_id = v_company);

  IF v_nome IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.constituinte_id, s.nome_tecnico, s.ancora, s.score, s.confianca
  FROM public.sugerir_constituintes_por_nome(v_nome) s;
END;
$$;

COMMENT ON FUNCTION public.sugerir_constituintes(uuid) IS
  'Sugere constituintes ANVISA por elemento âncora. Nunca confirma vínculo — só ranqueia.';
COMMENT ON FUNCTION public.sugerir_constituintes_por_nome(text) IS
  'Mesmo match por âncora, a partir do nome do insumo (testes / preview).';

GRANT EXECUTE ON FUNCTION public.norm_texto_ancora(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.limpar_nome_insumo_match(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.extrair_ancora_constituinte(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.constituinte_casa_ancora(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.score_match_constituinte(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sugerir_constituintes_por_nome(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sugerir_constituintes(uuid) TO authenticated, service_role;
