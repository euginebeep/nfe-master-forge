-- 🔴 BUG CRITICO DE PRODUCAO, visto na tela em 03/08/2026.
-- Busca "Bromelina" na Consulta ANVISA -> devolvia D-BIOTINA com selo
-- AUTORIZADO e a frase "consta na base ANVISA (IN 28/2018)".
-- Causa: aceitava trigram com similaridade 0,2 como status 'encontrado'.
-- 0,2 casa quase qualquer par de palavras. Enzima nao autorizada exibida
-- como autorizada, com limites e alegacoes de outra substancia.
--
-- Correcao: similaridade vira SUGESTAO, nunca 'encontrado'.
--   exato / palavra inteira / token unico -> encontrado
--   varios candidatos                     -> ambiguo
--   so similaridade >= 0,55               -> sugestao  (NAO afirma autorizacao)
--   nada                                  -> nao_encontrado
-- Usa anvisa_casar_diagnostico: a mesma logica do motor. Duas telas nao podem
-- responder diferente para o mesmo termo.

CREATE OR REPLACE FUNCTION public.anvisa_consultar(
  p_termo text, p_grupo text DEFAULT NULL, p_dose_mg numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_diag jsonb; v_c anvisa_constituintes%ROWTYPE; v_sug RECORD;
  v_lim jsonb; v_txt text; v_col text;
BEGIN
  IF COALESCE(btrim(p_termo),'') = '' THEN
    RETURN jsonb_build_object('ok', false, 'status','nao_encontrado',
      'mensagem','Informe um termo para consultar.');
  END IF;

  v_diag := anvisa_casar_diagnostico(p_termo);

  -- ── ambiguo ───────────────────────────────────────────────────────────
  IF v_diag->>'resultado' = 'ambiguo' THEN
    RETURN jsonb_build_object('ok', true, 'status','ambiguo',
      'termo', p_termo,
      'n_candidatos', (v_diag->>'n_candidatos')::int,
      'candidatos', v_diag->'candidatos',
      'mensagem','"'||p_termo||'" corresponde a '||(v_diag->>'n_candidatos')
        ||' constituintes distintos na base oficial, com limites proprios. '
        ||'Escolha qual antes de usar — NAO ha resposta unica.');
  END IF;

  -- ── nao encontrado: oferecer sugestao, sem afirmar autorizacao ────────
  IF v_diag->>'resultado' = 'ausente' THEN
    SELECT c.nome_tecnico, c.categoria,
           round(similarity(lower(unaccent(p_termo)), lower(unaccent(c.nome_tecnico)))::numeric,2) AS sim
      INTO v_sug
      FROM anvisa_constituintes c
     WHERE c.ativo
       AND similarity(lower(unaccent(p_termo)), lower(unaccent(c.nome_tecnico))) >= 0.55
     ORDER BY similarity(lower(unaccent(p_termo)), lower(unaccent(c.nome_tecnico))) DESC
     LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object('ok', true, 'status','sugestao',
        'termo', p_termo,
        'sugestao_nome', v_sug.nome_tecnico, 'sugestao_categoria', v_sug.categoria,
        'similaridade', v_sug.sim,
        'mensagem','"'||p_termo||'" NAO consta na base oficial da ANVISA. '
          ||'Existe um nome parecido — "'||v_sug.nome_tecnico||'" — mas '
          ||'semelhanca de nome NAO e identidade. Confirme antes de usar.');
    END IF;

    RETURN jsonb_build_object('ok', true, 'status','nao_encontrado',
      'termo', p_termo,
      'mensagem','"'||p_termo||'" NAO consta na base oficial sincronizada do '
        ||'painel da ANVISA. A lista e positiva: ausencia NAO autoriza uso em '
        ||'suplemento alimentar.',
      'base', anvisa_base_contexto());
  END IF;

  -- ── encontrado ────────────────────────────────────────────────────────
  SELECT * INTO v_c FROM anvisa_constituintes
   WHERE id = (v_diag->>'constituinte_id')::uuid;

  v_lim := jsonb_strip_nulls(jsonb_build_object(
    '0_6_meses', v_c.limites_0_6_meses,  '7_11_meses', v_c.limites_7_11_meses,
    '1_3_anos',  v_c.limites_1_3_anos,   '4_8_anos',   v_c.limites_4_8_anos,
    '9_18_anos', v_c.limites_9_18_anos,  '19_mais',    v_c.limites_19_mais,
    'gestantes', v_c.limites_gestantes,  'lactantes',  v_c.limites_lactantes));

  RETURN jsonb_build_object('ok', true, 'status','encontrado',
    'termo', p_termo,
    'constituinte_id', v_c.id, 'nome_tecnico', v_c.nome_tecnico,
    'categoria', v_c.categoria, 'limites', v_lim,
    'alegacoes', v_c.alegacoes, 'advertencias', v_c.advertencias,
    'rotulagem_complementar', v_c.rotulagem_complementar,
    'limite_parse_status', v_c.limite_parse_status,
    'norma_inclusao', anvisa_norma_de(v_c),
    'orfao_do_painel', anvisa_constituinte_orfao(v_c.id),
    'avaliacao_da_dose', CASE WHEN p_dose_mg IS NULL THEN NULL
      ELSE anvisa_avaliar_ativo(v_c.nome_tecnico, p_dose_mg, 'mg',
             COALESCE(p_grupo,'19_mais')) END,
    'mensagem','"'||v_c.nome_tecnico||'" consta na base oficial sincronizada do '
      ||'painel da ANVISA.',
    'base', anvisa_base_contexto());
END; $$;

COMMENT ON FUNCTION public.anvisa_consultar(text,text,numeric) IS
  'Consulta de tela. Usa anvisa_casar_diagnostico — mesma logica do motor: duas '
  'telas nao podem responder diferente para o mesmo termo. Similaridade NUNCA '
  'gera status "encontrado": em 03/08 "Bromelina" devolvia D-biotina AUTORIZADO '
  'com similaridade 0,2.';