-- ERRO Nº 1 DA LISTA, cometido de novo e por mim: criei anvisa_buscar_candidatos
-- com casamento por TOKEN e nao voltei para atualizar anvisa_casar_constituinte,
-- que e a usada pelo MOTOR. Resultado verificado em 03/08:
--   buscar_candidatos('CURCUMA LONGA 95%')  -> Extrato de rizomas de Curcuma longa
--   casar_constituinte('CURCUMA LONGA 95%') -> NULL
-- O motor reprovava cúrcuma por NAO ENCONTRAR, nao pelo portao botanico.
--
-- Diferenca de criterio, de proposito: buscar_candidatos LISTA para a RT
-- escolher (aceita casamento parcial). casar_constituinte precisa de UM
-- resultado confiavel — exige que TODOS os tokens significativos casem e que
-- o resultado seja UNICO. Ambiguo devolve NULL: melhor exigir vinculo do que
-- escolher errado.

CREATE OR REPLACE FUNCTION public.anvisa_casar_constituinte(p_nome text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_n text; v_toks text[]; v_n_cand int;
BEGIN
  v_n := lower(unaccent(COALESCE(p_nome,'')));
  IF length(btrim(v_n)) < 3 THEN RETURN NULL; END IF;

  -- 1. igualdade exata
  SELECT c.id INTO v_id FROM anvisa_constituintes c
   WHERE c.ativo AND lower(unaccent(c.nome_tecnico)) = v_n LIMIT 1;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;

  -- 2. palavra inteira, bidirecional, em nome/popular/sinonimo
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

  -- 3. TODOS os tokens significativos presentes, e resultado UNICO
  v_toks := anvisa_tokens_insumo(p_nome);
  IF v_toks IS NULL OR array_length(v_toks,1) = 0 THEN RETURN NULL; END IF;

  WITH cand AS (
    SELECT c.id FROM anvisa_constituintes c
     WHERE c.ativo
       AND NOT EXISTS (
         SELECT 1 FROM unnest(v_toks) t
          WHERE lower(unaccent(c.nome_tecnico || ' ' ||
                COALESCE(array_to_string(c.nome_popular,' '),'') || ' ' ||
                COALESCE(array_to_string(c.sinonimos,' '),''))) NOT LIKE '%'||t||'%')
  )
  SELECT count(*), min(id) INTO v_n_cand, v_id FROM cand;

  -- Ambiguo (ex.: "CALCIO QUELATO" casa 36 sais) -> NULL, exige vinculo da RT
  IF v_n_cand <> 1 THEN RETURN NULL; END IF;
  RETURN v_id;
END; $$;

COMMENT ON FUNCTION public.anvisa_casar_constituinte(text) IS
  'Casamento do MOTOR: exato -> palavra inteira -> todos os tokens com resultado '
  'UNICO. Ambiguo devolve NULL de proposito: melhor exigir vinculo da RT do que '
  'escolher um sal entre 36. Criterio mais restritivo que anvisa_buscar_candidatos, '
  'que LISTA para a RT escolher. As duas usam anvisa_tokens_insumo — nao duplicar '
  'a tokenizacao.';