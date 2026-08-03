CREATE OR REPLACE FUNCTION public.anvisa_avaliar_ativo(
  p_nome text, p_dose numeric DEFAULT NULL, p_unidade text DEFAULT NULL,
  p_grupo text DEFAULT '19_mais')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_c anvisa_constituintes%ROWTYPE;
  v_txt text; v_sub RECORD; v_vetado RECORD;
  v_comparavel boolean; v_status text; v_motivo text; v_col text;
  v_orfao boolean; v_dias int;
BEGIN
  IF COALESCE(btrim(p_nome),'') = '' THEN
    RETURN jsonb_build_object('status','PENDENTE_VERIFICACAO','motivo','Ativo sem nome.');
  END IF;

  SELECT * INTO v_vetado FROM anvisa_ingredientes_nao_autorizados
   WHERE ativo AND lower(unaccent(nome)) = lower(unaccent(p_nome)) LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status','NAO_AUTORIZADO','ativo',p_nome,
      'motivo', COALESCE(v_vetado.explicacao,'Consta da lista de nao autorizados.'),
      'norma_referencia', v_vetado.base_legal, 'fonte','anvisa_ingredientes_nao_autorizados');
  END IF;

  SELECT c.* INTO v_c FROM anvisa_constituintes c
   WHERE c.ativo AND (
        lower(unaccent(c.nome_tecnico)) = lower(unaccent(p_nome))
     OR lower(unaccent(c.nome_tecnico)) LIKE '%'||lower(unaccent(p_nome))||'%'
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.nome_popular,'{}')) x
                 WHERE length(x)>=4 AND lower(unaccent(x)) LIKE '%'||lower(unaccent(p_nome))||'%')
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.sinonimos,'{}')) x
                 WHERE length(x)>=4 AND lower(unaccent(x)) LIKE '%'||lower(unaccent(p_nome))||'%'))
   ORDER BY (lower(unaccent(c.nome_tecnico)) = lower(unaccent(p_nome))) DESC,
            length(c.nome_tecnico) ASC
   LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_sub FROM anvisa_substituicoes
     WHERE ativo AND lower(unaccent(p_nome)) LIKE '%'||lower(unaccent(ativo_reprovado))||'%' LIMIT 1;
    RETURN jsonb_build_object(
      'status','NAO_AUTORIZADO', 'ativo', p_nome,
      'motivo','Nao localizado na lista de constituintes autorizados para suplemento '
        || 'alimentar apos varredura em anvisa_constituintes, '
        || 'anvisa_ingredientes_nao_autorizados, anvisa_limites e regras_anvisa. '
        || 'A lista da IN 28/2018 e taxativa: ausencia nao autoriza uso.',
      'norma_referencia','IN 28/2018, Anexo I',
      'proxima_via','Se botanico com uso medicinal ou alegacao terapeutica, avaliar '
        || 'como fitoterapico, produto tradicional fitoterapico ou novo ingrediente.',
      'substituicao_sugerida', v_sub.substitutos,
      'proposta_funcional',    v_sub.proposta_funcional,
      'observacao_substituicao', v_sub.observacao,
      'fonte','varredura_completa_sem_resultado');
  END IF;

  -- NOVO: sumiu do painel? Nao e regular ate a RT decidir.
  SELECT true, o.dias_sem_aparecer_no_painel INTO v_orfao, v_dias
    FROM v_anvisa_constituintes_orfaos o WHERE o.id = v_c.id;
  IF COALESCE(v_orfao,false) THEN
    RETURN jsonb_build_object(
      'status','PENDENTE_VERIFICACAO','ativo',p_nome,
      'constituinte', v_c.nome_tecnico, 'constituinte_id', v_c.id,
      'motivo','Constituinte deixou de aparecer no painel oficial da ANVISA ha '
        || v_dias || ' dia(s). Pode ter sido renomeado, ter a cepa redesignada ou '
        || 'ter sido desautorizado. Exige decisao da RT antes de usar em formula.',
      'orfao_do_painel', true, 'dias_sem_aparecer', v_dias,
      'ultima_vez_no_painel', v_c.sincronizado_em,
      'norma_referencia', COALESCE(v_c.norma_ultima_alteracao, v_c.norma_inclusao, 'IN 28/2018'),
      'fonte','v_anvisa_constituintes_orfaos');
  END IF;

  v_col := CASE p_grupo
    WHEN '0_6_meses' THEN 'limites_0_6_meses'  WHEN '7_11_meses' THEN 'limites_7_11_meses'
    WHEN '1_3_anos'  THEN 'limites_1_3_anos'   WHEN '4_8_anos'   THEN 'limites_4_8_anos'
    WHEN '9_18_anos' THEN 'limites_9_18_anos'  WHEN 'gestantes'  THEN 'limites_gestantes'
    WHEN 'lactantes' THEN 'limites_lactantes'  ELSE 'limites_19_mais' END;
  EXECUTE format('SELECT ($1.%I)->>''texto''', v_col) INTO v_txt USING v_c;

  IF v_txt IS NULL OR v_txt ILIKE '%nao autorizado%' OR (v_txt ILIKE '%NA%' AND v_txt !~ '[0-9]') THEN
    RETURN jsonb_build_object('status','NAO_AUTORIZADO','ativo',p_nome,
      'constituinte', v_c.nome_tecnico, 'constituinte_id', v_c.id,
      'motivo','Constituinte existe, mas nao autorizado para o grupo populacional '||p_grupo||'.',
      'limite_texto', v_txt,
      'norma_referencia', COALESCE(v_c.norma_ultima_alteracao, v_c.norma_inclusao, 'IN 28/2018'));
  END IF;

  v_comparavel := CASE
    WHEN p_unidade IS NULL THEN NULL
    WHEN v_txt ~* '(U\.?FCC|PPI|UFC)' AND p_unidade !~* '(U\.?FCC|PPI|UFC)' THEN false
    ELSE true END;

  IF v_c.limite_parse_status IS DISTINCT FROM 'ok' THEN
    v_status := 'PENDENTE_VERIFICACAO';
    v_motivo := 'Limite oficial nao parseado ('||COALESCE(v_c.limite_parse_status,'null')
             || '). Texto original: "'||v_txt||'". Nao e possivel afirmar conformidade.';
  ELSIF v_comparavel IS FALSE THEN
    v_status := 'PENDENTE_VERIFICACAO';
    v_motivo := 'Limite oficial expresso em unidade de atividade ("'||v_txt||'") e a formula '
             || 'declara '||COALESCE(p_unidade,'?')||'. Informe a atividade do lote.';
  ELSIF p_dose IS NULL THEN
    v_status := 'PENDENTE_VERIFICACAO';
    v_motivo := 'Dose nao informada. Limite oficial: "'||v_txt||'".';
  ELSIF v_c.limite_max_num IS NOT NULL AND p_dose > v_c.limite_max_num THEN
    v_status := 'NAO_AUTORIZADO';
    v_motivo := 'Dose '||p_dose||' '||COALESCE(p_unidade,'')||' excede o maximo de '
             || v_c.limite_max_num||' '||COALESCE(v_c.limite_unidade,'');
  ELSIF v_c.limite_min_num IS NOT NULL AND p_dose < v_c.limite_min_num THEN
    v_status := 'APROVAVEL_COM_CORRECAO';
    v_motivo := 'Dose '||p_dose||' abaixo do minimo de '||v_c.limite_min_num||' '
             || COALESCE(v_c.limite_unidade,'')||'. Ajustar para alegar o nutriente.';
  ELSE
    v_status := 'APROVADO';
    v_motivo := 'Consta da lista de autorizados e dose dentro do limite. Oficial: "'||v_txt||'".';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status, 'ativo', p_nome,
    'constituinte', v_c.nome_tecnico, 'constituinte_id', v_c.id,
    'categoria', v_c.categoria, 'grupo', p_grupo,
    'limite_min_oficial', v_c.limite_min_num, 'limite_max_oficial', v_c.limite_max_num,
    'unidade_oficial', v_c.limite_unidade, 'limite_texto', v_txt,
    'unidade_comparavel', v_comparavel, 'orfao_do_painel', false,
    'motivo', v_motivo,
    'norma_referencia', COALESCE(v_c.norma_ultima_alteracao, v_c.norma_inclusao, 'IN 28/2018'),
    'advertencias', v_c.advertencias, 'alegacoes', v_c.alegacoes,
    'sincronizado_em', v_c.sincronizado_em, 'fonte','anvisa_constituintes');
END; $$;