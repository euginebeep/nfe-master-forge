-- BUG CRITICO CORRIGIDO 02/08/2026.
-- O casamento por contencao usava LIKE '%X%' sem fronteira de palavra.
-- "Mel" (constituinte de 3 letras) casava dentro de "broMELina" e de
-- "MELatonina". Resultado verificado: anvisa_avaliar_ativo('Bromelina')
-- devolvia APROVADO citando o limite do MEL — enzima nao autorizada passando
-- como mel. Mesmo erro do Ashwagandha -> omega3_epa_dha, agora no motor.
--
-- Piso de tamanho nao resolve: eliminaria "Mel", "Iodo", "Zinco" legitimos.
-- A correcao certa e exigir PALAVRA INTEIRA (\m \M), nao substring.

CREATE OR REPLACE FUNCTION public.anvisa_casar_constituinte(p_nome text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_n text;
BEGIN
  v_n := lower(unaccent(COALESCE(p_nome,'')));
  IF length(btrim(v_n)) < 3 THEN RETURN NULL; END IF;

  SELECT c.id INTO v_id FROM anvisa_constituintes c
   WHERE c.ativo AND (
        lower(unaccent(c.nome_tecnico)) = v_n
     -- termo contido no constituinte, como PALAVRA INTEIRA
     OR lower(unaccent(c.nome_tecnico)) ~ ('\m'||regexp_replace(v_n,'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
     -- constituinte contido no termo, como PALAVRA INTEIRA
     OR v_n ~ ('\m'||regexp_replace(lower(unaccent(c.nome_tecnico)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.nome_popular,'{}')) x WHERE length(x)>=4
                 AND (lower(unaccent(x)) ~ ('\m'||regexp_replace(v_n,'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
                   OR v_n ~ ('\m'||regexp_replace(lower(unaccent(x)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')))
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.sinonimos,'{}')) x WHERE length(x)>=4
                 AND (lower(unaccent(x)) ~ ('\m'||regexp_replace(v_n,'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
                   OR v_n ~ ('\m'||regexp_replace(lower(unaccent(x)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')))
   )
   ORDER BY (lower(unaccent(c.nome_tecnico)) = v_n) DESC,
            length(c.nome_tecnico) DESC
   LIMIT 1;
  RETURN v_id;
END; $$;

COMMENT ON FUNCTION public.anvisa_casar_constituinte(text) IS
  'UNICA logica de casamento nome->constituinte. Exige PALAVRA INTEIRA: '
  'substring casava "Mel" dentro de "Bromelina" e aprovava enzima nao '
  'autorizada. NAO trocar \m\M por LIKE. Retorno NAO prova identidade — '
  'prova que ha candidato. Identidade so por item_anvisa_vinculo.';