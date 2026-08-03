-- CORRIGE erro de logica: quando a mesma substancia tem VARIAS linhas na mesma
-- categoria, os limites sao ALTERNATIVAS CONDICIONAIS (dependem da forma
-- farmaceutica), nao cumulativas. Ex.: neohesperidina em 14.2 tem 400 mg/kg
-- para mastigaveis e 100 mg/kg para os demais solidos.
-- A v1 reprovava se a dose excedesse ALGUMA linha: 300 mg/kg dava
-- NAO_AUTORIZADO mesmo sendo valido para mastigaveis.
--
-- Regra correta:
--   excede TODAS as linhas  -> NAO_AUTORIZADO (nenhuma forma comporta)
--   excede ALGUMAS          -> PENDENTE, exige a forma farmaceutica
--   excede NENHUMA          -> APROVADO

CREATE OR REPLACE FUNCTION public.anvisa_avaliar_excipiente(
  p_nome text, p_categoria text DEFAULT '14.2', p_ins text DEFAULT NULL,
  p_dose_mg_kg numeric DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_comp RECORD; v_a RECORD; v_n int := 0; v_hits jsonb := '[]'::jsonb;
  v_excede int := 0; v_comparaveis int := 0;
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
    IF p_dose_mg_kg IS NOT NULL AND v_a.limite_num IS NOT NULL THEN
      v_comparaveis := v_comparaveis + 1;
      IF p_dose_mg_kg > v_a.limite_num THEN v_excede := v_excede + 1; END IF;
    END IF;
    v_hits := v_hits || jsonb_build_array(jsonb_build_object(
      'tipo',v_a.tipo,'funcao',v_a.funcao,'ins',v_a.ins,'nome',v_a.nome,
      'limite',v_a.limite_texto,'unidade',v_a.limite_unidade,'notas',v_a.notas,
      'norma',v_a.norma_origem,'anexo',v_a.anexo_origem,
      'dose_cabe_nesta_linha', CASE WHEN p_dose_mg_kg IS NULL OR v_a.limite_num IS NULL
                                    THEN NULL ELSE p_dose_mg_kg <= v_a.limite_num END));
  END LOOP;

  IF v_n = 0 THEN
    IF v_comp.estado = 'COMPLETA' THEN
      RETURN jsonb_build_object('status','NAO_AUTORIZADO','substancia',p_nome,
        'categoria',p_categoria,
        'motivo','Nao consta da lista de aditivos e coadjuvantes autorizados para a '
          ||'categoria '||p_categoria||'. A lista da IN 211/2023 e taxativa e esta '
          ||'integralmente ingerida ('||v_comp.linhas_ingeridas||' linhas).',
        'responsavel','regra_da_anvisa_nao_negociavel');
    END IF;
    RETURN jsonb_build_object('status','PENDENTE_VERIFICACAO','substancia',p_nome,
      'categoria',p_categoria,
      'motivo','Nao consta da NOSSA copia da IN 211/2023, que esta '
        ||COALESCE(v_comp.estado,'NAO_INGERIDA')||' para a categoria '||p_categoria
        ||' ('||COALESCE(v_comp.linhas_ingeridas,0)||' linhas). Ausencia aqui NAO '
        ||'prova ausencia na norma.',
      'responsavel','plataforma',
      'acao','Completar a ingestao do Anexo III e IV da IN 211 para esta categoria '
        ||'e marcar estado=COMPLETA. So entao o ERP pode afirmar "nao autorizado" '
        ||'por ausencia.',
      'completude', to_jsonb(v_comp));
  END IF;

  IF v_comparaveis > 0 AND v_excede = v_comparaveis THEN
    RETURN jsonb_build_object('status','NAO_AUTORIZADO','substancia',p_nome,
      'categoria',p_categoria,
      'motivo','Dose '||p_dose_mg_kg||' mg/kg excede o limite em TODAS as '
        ||v_comparaveis||' condicao(oes) previstas na IN 211/2023.',
      'responsavel','regra_da_anvisa_nao_negociavel','ocorrencias',v_hits);
  END IF;

  IF v_excede > 0 THEN
    RETURN jsonb_build_object('status','PENDENTE_VERIFICACAO','substancia',p_nome,
      'categoria',p_categoria,
      'motivo','Dose '||p_dose_mg_kg||' mg/kg cabe em '||(v_comparaveis-v_excede)
        ||' de '||v_comparaveis||' condicoes previstas. Os limites dependem da FORMA '
        ||'(mastigavel, capsula, comprimido...). Informe a forma para decidir.',
      'responsavel','formulador_informa_forma','ocorrencias',v_hits);
  END IF;

  RETURN jsonb_build_object('status','APROVADO','substancia',p_nome,
    'categoria',p_categoria,
    'motivo','Consta da lista de autorizados da IN 211/2023 para a categoria '
      ||p_categoria||CASE WHEN p_dose_mg_kg IS NULL
          THEN '. Dose nao informada: limite nao conferido.'
          ELSE ', dentro do limite em todas as condicoes comparaveis.' END,
    'responsavel', CASE WHEN p_dose_mg_kg IS NULL THEN 'formulador_informa_dose' ELSE 'nenhum' END,
    'ocorrencias',v_hits);
END; $$;