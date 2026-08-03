-- min(uuid) nao existe em Postgres. Trocar por agregacao em array.
CREATE OR REPLACE FUNCTION public.anvisa_casar_constituinte(p_nome text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_n text; v_toks text[]; v_ids uuid[];
BEGIN
  v_n := lower(unaccent(COALESCE(p_nome,'')));
  IF length(btrim(v_n)) < 3 THEN RETURN NULL; END IF;

  SELECT c.id INTO v_id FROM anvisa_constituintes c
   WHERE c.ativo AND lower(unaccent(c.nome_tecnico)) = v_n LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  SELECT c.id INTO v_id FROM anvisa_constituintes c
   WHERE c.ativo AND (
        lower(unaccent(c.nome_tecnico)) ~ ('\m'||regexp_replace(v_n,'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
     OR v_n ~ ('\m'||regexp_replace(lower(unaccent(c.nome_tecnico)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.nome_popular,'{}')) x WHERE length(x)>=4
                 AND (lower(unaccent(x)) ~ ('\m'||regexp_replace(v_n,'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
                   OR v_n ~ ('\m'||regexp_replace(lower(unaccent(x)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')))
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.sinonimos,'{}')) x WHERE length(x)>=4
                 AND (lower(unaccent(x)) ~ ('\m'||regexp_replace(v_n,'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
                   OR v_n ~ ('\m'||regexp_replace(lower(unaccent(x)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M'))))
   ORDER BY length(c.nome_tecnico) DESC LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  v_toks := anvisa_tokens_insumo(p_nome);
  IF v_toks IS NULL OR array_length(v_toks,1) = 0 THEN RETURN NULL; END IF;

  SELECT array_agg(c.id) INTO v_ids
    FROM anvisa_constituintes c
   WHERE c.ativo
     AND NOT EXISTS (
       SELECT 1 FROM unnest(v_toks) t
        WHERE lower(unaccent(c.nome_tecnico || ' ' ||
              COALESCE(array_to_string(c.nome_popular,' '),'') || ' ' ||
              COALESCE(array_to_string(c.sinonimos,' '),''))) NOT LIKE '%'||t||'%');

  IF v_ids IS NULL OR array_length(v_ids,1) <> 1 THEN RETURN NULL; END IF;
  RETURN v_ids[1];
END; $$;

COMMENT ON FUNCTION public.anvisa_casar_constituinte(text) IS
  'Casamento do MOTOR: exato -> palavra inteira -> todos os tokens com resultado '
  'UNICO. Ambiguo devolve NULL de proposito: melhor exigir vinculo da RT do que '
  'escolher um sal entre 36. Criterio mais restritivo que anvisa_buscar_candidatos, '
  'que LISTA para a RT escolher. As duas usam anvisa_tokens_insumo.';