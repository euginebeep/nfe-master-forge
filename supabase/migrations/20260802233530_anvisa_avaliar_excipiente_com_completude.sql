-- Avalia nao-ativo contra a IN 211, RESPEITANDO a completude da categoria.
-- Regra que evita o pior erro possivel aqui: em categoria PARCIAL, ausencia
-- NAO vira "nao autorizado". Uma copia incompleta reprovando aditivo legitimo
-- ensinaria o usuario a ignorar o alerta — e ai o alerta verdadeiro morre junto.

CREATE OR REPLACE FUNCTION public.anvisa_avaliar_excipiente(
  p_nome text, p_categoria text DEFAULT '14.2', p_ins text DEFAULT NULL,
  p_dose_mg_kg numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_comp RECORD; v_a RECORD; v_n int := 0; v_hits jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO v_comp FROM anvisa_in211_completude WHERE categoria = p_categoria;

  FOR v_a IN
    SELECT * FROM anvisa_aditivos
     WHERE ativo AND categoria = p_categoria
       AND ( (p_ins IS NOT NULL AND ins = p_ins)
          OR lower(unaccent(nome)) = lower(unaccent(p_nome))
          OR lower(unaccent(nome)) ~ ('\m'||lower(unaccent(COALESCE(p_nome,'')))||'\M')
          OR lower(unaccent(COALESCE(p_nome,''))) ~ ('\m'||lower(unaccent(nome))||'\M') )
  LOOP
    v_n := v_n + 1;
    v_hits := v_hits || jsonb_build_array(jsonb_build_object(
      'tipo', v_a.tipo, 'funcao', v_a.funcao, 'ins', v_a.ins, 'nome', v_a.nome,
      'limite', v_a.limite_texto, 'unidade', v_a.limite_unidade,
      'notas', v_a.notas, 'norma', v_a.norma_origem, 'anexo', v_a.anexo_origem,
      'excede', CASE WHEN p_dose_mg_kg IS NULL OR v_a.limite_num IS NULL THEN NULL
                     ELSE p_dose_mg_kg > v_a.limite_num END));
  END LOOP;

  -- Encontrado e dose acima do limite: violacao certa
  IF v_n > 0 AND EXISTS (SELECT 1 FROM jsonb_array_elements(v_hits) h
                          WHERE (h->>'excede')::boolean IS TRUE) THEN
    RETURN jsonb_build_object('status','NAO_AUTORIZADO','substancia',p_nome,
      'categoria',p_categoria,'motivo','Dose acima do limite maximo da IN 211/2023.',
      'responsavel','regra_da_anvisa_nao_negociavel','ocorrencias',v_hits);
  END IF;

  IF v_n > 0 THEN
    RETURN jsonb_build_object('status','APROVADO','substancia',p_nome,
      'categoria',p_categoria,
      'motivo','Consta da lista de autorizados da IN 211/2023 para a categoria '
        || p_categoria || CASE WHEN p_dose_mg_kg IS NULL
             THEN '. Dose nao informada: limite nao conferido.' ELSE ', dentro do limite.' END,
      'responsavel', CASE WHEN p_dose_mg_kg IS NULL THEN 'formulador_informa_dose' ELSE 'nenhum' END,
      'ocorrencias',v_hits);
  END IF;

  -- Nao encontrado: o que isso significa depende da completude
  IF v_comp.estado = 'COMPLETA' THEN
    RETURN jsonb_build_object('status','NAO_AUTORIZADO','substancia',p_nome,
      'categoria',p_categoria,
      'motivo','Nao consta da lista de aditivos e coadjuvantes autorizados para a '
        || 'categoria '||p_categoria||'. A lista da IN 211/2023 e taxativa e esta '
        || 'integralmente ingerida ('||v_comp.linhas_ingeridas||' linhas).',
      'responsavel','regra_da_anvisa_nao_negociavel');
  END IF;

  RETURN jsonb_build_object('status','PENDENTE_VERIFICACAO','substancia',p_nome,
    'categoria',p_categoria,
    'motivo','Nao consta da NOSSA copia da IN 211/2023, que esta '
      || COALESCE(v_comp.estado,'NAO_INGERIDA') || ' para a categoria '||p_categoria
      || ' ('||COALESCE(v_comp.linhas_ingeridas,0)||' linhas ingeridas). '
      || 'Ausencia aqui NAO prova ausencia na norma.',
    'responsavel','plataforma',
    'acao','Completar a ingestao do Anexo III e IV da IN 211/2023 para esta '
      || 'categoria e marcar estado=COMPLETA. So entao o ERP pode afirmar '
      || '"nao autorizado" por ausencia.',
    'completude', to_jsonb(v_comp));
END; $$;

COMMENT ON FUNCTION public.anvisa_avaliar_excipiente(text,text,text,numeric) IS
  'Avalia nao-ativo contra a IN 211. Em categoria PARCIAL, ausencia devolve '
  'PENDENTE (nao NAO_AUTORIZADO): copia incompleta nao pode reprovar aditivo '
  'legitimo. Marcar COMPLETA so apos ingerir o anexo inteiro da categoria.';