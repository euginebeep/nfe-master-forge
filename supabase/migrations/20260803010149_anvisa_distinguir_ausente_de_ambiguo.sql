-- "Nao existe" e "existe mais de um" exigem acoes OPOSTAS:
--   ausente  -> NAO_AUTORIZADO, reformular
--   ambiguo  -> PENDENTE, a RT diz QUAL
-- A v3 devolvia NULL nos dois casos e o motor dizia "nao localizado" para
-- ambos. Caso real: "CURCUMA LONGA 95%" casa com "Extrato de rizomas de
-- Curcuma longa" (max 130 mg) E com "Tetraidrocurcuminoides obtidos a partir
-- do extrato de curcuma longa" (max 120 mg) — constituintes distintos que a
-- nota XV da IN 438/2026 proibe associar. Mandar reformular seria errado.

CREATE OR REPLACE FUNCTION public.anvisa_casar_diagnostico(p_nome text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_toks text[]; v_ids uuid[]; v_nomes text[];
BEGIN
  v_id := anvisa_casar_constituinte(p_nome);
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('resultado','unico','constituinte_id',v_id);
  END IF;

  v_toks := anvisa_tokens_insumo(p_nome);
  IF v_toks IS NULL OR array_length(v_toks,1) = 0 THEN
    RETURN jsonb_build_object('resultado','ausente');
  END IF;

  SELECT array_agg(c.id), array_agg(c.nome_tecnico ORDER BY c.nome_tecnico)
    INTO v_ids, v_nomes
    FROM anvisa_constituintes c
   WHERE c.ativo
     AND NOT EXISTS (
       SELECT 1 FROM unnest(v_toks) t
        WHERE lower(unaccent(c.nome_tecnico || ' ' ||
              COALESCE(array_to_string(c.nome_popular,' '),'') || ' ' ||
              COALESCE(array_to_string(c.sinonimos,' '),''))) NOT LIKE '%'||t||'%');

  IF v_ids IS NULL OR array_length(v_ids,1) = 0 THEN
    RETURN jsonb_build_object('resultado','ausente');
  END IF;

  RETURN jsonb_build_object('resultado','ambiguo',
    'n_candidatos', array_length(v_ids,1),
    'candidatos', to_jsonb(v_nomes));
END; $$;

COMMENT ON FUNCTION public.anvisa_casar_diagnostico(text) IS
  'unico | ambiguo | ausente. Ambiguo NAO e ausente: exige que a RT escolha, '
  'nao que o formulador reformule.';

-- Motor passa a distinguir os dois casos
CREATE OR REPLACE FUNCTION public.anvisa_avaliar_ativo(
  p_nome text, p_dose numeric DEFAULT NULL, p_unidade text DEFAULT NULL,
  p_grupo text DEFAULT '19_mais', p_company_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_c anvisa_constituintes%ROWTYPE; v_id uuid; v_diag jsonb;
  v_txt text; v_sub RECORD; v_vetado RECORD;
  v_comparavel boolean; v_status text; v_motivo text; v_col text;
  v_orfao boolean; v_dias int; v_ctx jsonb;
BEGIN
  v_ctx := anvisa_base_contexto();

  IF COALESCE(btrim(p_nome),'') = '' THEN
    RETURN jsonb_build_object('status','PENDENTE_VERIFICACAO','motivo','Ativo sem nome.',
      'responsavel','plataforma','base', v_ctx);
  END IF;

  SELECT * INTO v_vetado FROM anvisa_ingredientes_nao_autorizados
   WHERE ativo AND lower(unaccent(nome)) = lower(unaccent(p_nome)) LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object('status','NAO_AUTORIZADO','ativo',p_nome,
      'motivo', COALESCE(v_vetado.explicacao,'Consta da lista de nao autorizados.'),
      'norma_referencia', v_vetado.base_legal,
      'responsavel','regra_da_anvisa_nao_negociavel',
      'fonte','anvisa_ingredientes_nao_autorizados','base', v_ctx);
  END IF;

  v_diag := anvisa_casar_diagnostico(p_nome);

  -- AMBIGUO: existe, mas em mais de uma forma com limites diferentes
  IF v_diag->>'resultado' = 'ambiguo' THEN
    RETURN jsonb_build_object(
      'status','PENDENTE_VERIFICACAO','ativo',p_nome,
      'motivo','Existe na base oficial em '||(v_diag->>'n_candidatos')||' formas '
        ||'distintas, com limites e condicoes proprios. O nome informado nao '
        ||'identifica qual. NAO e caso de reformular: e caso de identificar.',
      'candidatos', v_diag->'candidatos',
      'responsavel','rt_do_tenant_confirma_vinculo',
      'acao_da_rt','Escolher em v_anvisa_vinculo_candidatos qual constituinte '
        ||'este insumo representa e confirmar em item_anvisa_vinculo, com teor.',
      'fonte','casamento_ambiguo','base', v_ctx);
  END IF;

  IF v_diag->>'resultado' = 'ausente' THEN
    SELECT * INTO v_sub FROM anvisa_substituicoes
     WHERE ativo AND lower(unaccent(p_nome)) LIKE '%'||lower(unaccent(ativo_reprovado))||'%' LIMIT 1;
    RETURN jsonb_build_object(
      'status','NAO_AUTORIZADO','ativo',p_nome,
      'motivo','Nao localizado na base oficial sincronizada do painel da ANVISA '
        ||'('||(v_ctx->>'constituintes_ativos')||' constituintes, sync de '
        ||left(COALESCE(v_ctx->>'sincronizado_em','?'),10)||'). Essa base ja '
        ||'inclui os autorizados por Resolucao Especifica. Lista positiva: '
        ||'ausencia nao autoriza uso.',
      'ressalva_janela_cega', v_ctx->>'janela_cega',
      'responsavel','rt_do_tenant_confirma_vinculo',
      'acao_da_plataforma','Conferir a pagina de ingredientes/REs: RE publicada '
        ||'apos a ultima sync ainda nao esta nesta base.',
      'vias', anvisa_via_fora_da_in28(p_company_id),
      'substituicao_sugerida', v_sub.substitutos,
      'proposta_funcional', v_sub.proposta_funcional,
      'observacao_substituicao', v_sub.observacao,
      'fonte','varredura_completa_sem_resultado','base', v_ctx);
  END IF;

  v_id := (v_diag->>'constituinte_id')::uuid;
  SELECT * INTO v_c FROM anvisa_constituintes WHERE id = v_id;

  SELECT true, o.dias_sem_aparecer_no_painel INTO v_orfao, v_dias
    FROM v_anvisa_constituintes_orfaos o WHERE o.id = v_c.id;
  IF COALESCE(v_orfao,false) THEN
    RETURN jsonb_build_object('status','PENDENTE_VERIFICACAO','ativo',p_nome,
      'constituinte', v_c.nome_tecnico, 'constituinte_id', v_c.id,
      'motivo','Constituinte deixou de aparecer no painel oficial da ANVISA ha '
        ||v_dias||' dia(s). Pode ter sido renomeado, ter a cepa redesignada ou '
        ||'ter sido desautorizado.',
      'responsavel','plataforma',
      'acao','Determinar na fonte oficial o que ocorreu. NAO e decisao de RT.',
      'orfao_do_painel', true, 'dias_sem_aparecer', v_dias,
      'ultima_vez_no_painel', v_c.sincronizado_em,
      'fonte','v_anvisa_constituintes_orfaos','base', v_ctx);
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
      'limite_texto', v_txt, 'responsavel','regra_da_anvisa_nao_negociavel',
      'norma_referencia', anvisa_norma_de(v_c), 'base', v_ctx);
  END IF;

  v_comparavel := CASE
    WHEN p_unidade IS NULL THEN NULL
    WHEN v_txt ~* '(U\.?FCC|PPI|UFC)' AND p_unidade !~* '(U\.?FCC|PPI|UFC)' THEN false
    ELSE true END;

  IF v_c.limite_parse_status IS DISTINCT FROM 'ok' THEN
    v_status := 'PENDENTE_VERIFICACAO';
    v_motivo := 'Limite oficial nao parseado ('||COALESCE(v_c.limite_parse_status,'null')
             ||'). Texto original: "'||v_txt||'". Parsear a norma e trabalho da plataforma.';
  ELSIF v_comparavel IS FALSE THEN
    v_status := 'PENDENTE_VERIFICACAO';
    v_motivo := 'Limite oficial em unidade de atividade ("'||v_txt||'") e a formula declara '
             ||COALESCE(p_unidade,'?')||'. Informe a atividade do lote.';
  ELSIF p_dose IS NULL THEN
    v_status := 'PENDENTE_VERIFICACAO';
    v_motivo := 'Dose nao informada. Limite oficial: "'||v_txt||'".';
  ELSIF v_c.limite_max_num IS NOT NULL AND p_dose > v_c.limite_max_num THEN
    v_status := 'NAO_AUTORIZADO';
    v_motivo := 'Dose '||p_dose||' '||COALESCE(p_unidade,'')||' excede o maximo de '
             ||v_c.limite_max_num||' '||COALESCE(v_c.limite_unidade,'')
             ||'. Limite legal — nao ha aprovacao interna que o dispense.';
  ELSIF v_c.limite_min_num IS NOT NULL AND p_dose < v_c.limite_min_num THEN
    v_status := 'APROVAVEL_COM_CORRECAO';
    v_motivo := 'Dose '||p_dose||' abaixo do minimo de '||v_c.limite_min_num||' '
             ||COALESCE(v_c.limite_unidade,'')||'. Ajustar para alegar o nutriente.';
  ELSE
    v_status := 'APROVADO';
    v_motivo := 'Consta da base oficial sincronizada e dose dentro do limite. Oficial: "'||v_txt||'".';
  END IF;

  RETURN jsonb_build_object(
    'status', v_status, 'ativo', p_nome,
    'constituinte', v_c.nome_tecnico, 'constituinte_id', v_c.id,
    'categoria', v_c.categoria, 'grupo', p_grupo,
    'limite_min_oficial', v_c.limite_min_num, 'limite_max_oficial', v_c.limite_max_num,
    'unidade_oficial', v_c.limite_unidade, 'limite_texto', v_txt,
    'unidade_comparavel', v_comparavel, 'orfao_do_painel', false,
    'motivo', v_motivo,
    'responsavel', CASE
      WHEN v_status='NAO_AUTORIZADO'       THEN 'regra_da_anvisa_nao_negociavel'
      WHEN v_status='PENDENTE_VERIFICACAO' THEN 'plataforma'
      WHEN v_status='APROVAVEL_COM_CORRECAO' THEN 'formulador_ajusta_dose'
      ELSE 'nenhum' END,
    'norma_referencia', anvisa_norma_de(v_c),
    'advertencias', v_c.advertencias, 'alegacoes', v_c.alegacoes,
    'sincronizado_em', v_c.sincronizado_em, 'fonte','anvisa_constituintes','base', v_ctx);
END; $$;