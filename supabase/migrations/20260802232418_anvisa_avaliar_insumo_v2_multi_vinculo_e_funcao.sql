-- CORRIGE: a v1 fazia LIMIT 1 nos vinculos. A UNIQUE e (item_id, constituinte_id),
-- entao um insumo PODE representar varios constituintes (premix, extrato
-- multicomponente). Avaliar um so e ignorar o resto em silencio.
-- Agora avalia TODOS e devolve o pior status.

CREATE OR REPLACE FUNCTION public.anvisa_avaliar_insumo(
  p_item_id uuid, p_company_id uuid, p_dose numeric DEFAULT NULL,
  p_unidade text DEFAULT 'mg', p_grupo text DEFAULT '19_mais',
  p_funcao text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_desc text; v_v RECORD; v_c anvisa_constituintes%ROWTYPE;
  v_dose_const numeric; v_uma jsonb;
  v_todas jsonb := '[]'::jsonb; v_pior text := NULL; v_n int := 0;
  v_rank int; v_rank_pior int := -1;
BEGIN
  SELECT descricao_interna INTO v_desc FROM itens WHERE id = p_item_id;

  -- ── Nao e ativo: sai da IN 28 e cai na IN 211 ────────────────────────
  IF p_funcao IS NOT NULL AND p_funcao <> 'ATIVO' THEN
    RETURN jsonb_build_object(
      'status','PENDENTE_VERIFICACAO', 'insumo', v_desc, 'item_id', p_item_id,
      'via','funcao_'||lower(p_funcao),
      'motivo','Declarado como '||p_funcao||'. Nao e constituinte da IN 28/2018 e '
        || 'nao exige vinculo. Regido pela IN 211/2023 (aditivos e coadjuvantes), '
        || 'cuja lista NAO esta ingerida no ERP — nao e possivel confirmar que '
        || 'esta autorizado para a categoria 14.2 nem qual o limite.',
      'responsavel','plataforma',
      'acao','Ingerir os Anexos III e IV da IN 211/2023 (com a IN 452/2026) em '
        || 'legislacao_fontes e criar a lista consultavel. Ate la o ERP nao '
        || 'afirma conformidade de excipiente — apenas registra que nao verificou.',
      'norma_referencia','IN 211/2023, Anexos III e IV');
  END IF;

  -- ── Ativo: percorre TODOS os vinculos confirmados ────────────────────
  FOR v_v IN
    SELECT * FROM item_anvisa_vinculo
     WHERE item_id = p_item_id AND company_id = p_company_id
       AND status = 'confirmado' AND constituinte_id IS NOT NULL
     ORDER BY confirmado_em
  LOOP
    v_n := v_n + 1;
    SELECT * INTO v_c FROM anvisa_constituintes WHERE id = v_v.constituinte_id;

    IF NOT COALESCE(v_c.ativo,false) THEN
      v_uma := jsonb_build_object('status','NAO_AUTORIZADO',
        'constituinte', v_c.nome_tecnico, 'constituinte_id', v_c.id,
        'motivo','O constituinte vinculado nao consta mais como ativo na base '
          || 'oficial. Vinculo confirmado pela RT nao mantem autorizacao revogada.',
        'responsavel','regra_da_anvisa_nao_negociavel');
    ELSE
      v_dose_const := CASE
        WHEN p_dose IS NULL THEN NULL
        WHEN v_v.teor_nominal_pct IS NOT NULL THEN p_dose * v_v.teor_nominal_pct / 100.0
        ELSE p_dose END;

      v_uma := anvisa_avaliar_ativo(v_c.nome_tecnico, v_dose_const, p_unidade, p_grupo)
            || jsonb_build_object(
                 'teor_nominal_pct', v_v.teor_nominal_pct,
                 'dose_constituinte_calculada', v_dose_const,
                 'confirmado_por', v_v.confirmado_por,
                 'observacao_teor', CASE WHEN v_v.teor_nominal_pct IS NULL
                   THEN 'Teor nao informado no vinculo: dose tratada como 100% do '
                     || 'constituinte. Em quelato ou extrato padronizado isto '
                     || 'SUPERESTIMA a entrega e mascara subdose.'
                   ELSE NULL END);
    END IF;

    v_todas := v_todas || jsonb_build_array(v_uma);

    -- pior status vence: NAO_AUTORIZADO > PENDENTE > APROVAVEL_COM_CORRECAO > APROVADO
    v_rank := CASE v_uma->>'status'
      WHEN 'NAO_AUTORIZADO' THEN 3 WHEN 'PENDENTE_VERIFICACAO' THEN 2
      WHEN 'APROVAVEL_COM_CORRECAO' THEN 1 ELSE 0 END;
    IF v_rank > v_rank_pior THEN v_rank_pior := v_rank; v_pior := v_uma->>'status'; END IF;
  END LOOP;

  IF v_n = 0 THEN
    RETURN jsonb_build_object(
      'status','PENDENTE_VERIFICACAO', 'insumo', v_desc, 'item_id', p_item_id,
      'via','sem_vinculo',
      'motivo','Insumo sem vinculo confirmado a constituinte autorizado. Nao e '
        || 'possivel afirmar que corresponde a algum item da IN 28/2018. '
        || 'Avaliacao por semelhanca de nome NAO substitui identificacao.',
      'responsavel','rt_do_tenant_confirma_vinculo',
      'acao_da_rt','Confirmar em item_anvisa_vinculo qual constituinte autorizado '
        || 'este insumo representa, com teor. Se nenhum representa, o insumo nao '
        || 'serve para suplemento alimentar — confirmar vinculo IDENTIFICA, nao '
        || 'autoriza. Se ele entra como excipiente, declare funcao_no_produto.',
      'avaliacao_por_nome_apenas_informativa',
        anvisa_avaliar_ativo(v_desc, p_dose, p_unidade, p_grupo));
  END IF;

  RETURN jsonb_build_object(
    'status', v_pior, 'insumo', v_desc, 'item_id', p_item_id,
    'via','vinculo_confirmado', 'n_constituintes', v_n,
    'dose_insumo', p_dose, 'grupo', p_grupo,
    'constituintes', v_todas,
    'motivo', CASE WHEN v_n = 1 THEN v_todas->0->>'motivo'
                   ELSE v_n||' constituintes vinculados; status pior: '||v_pior END,
    'responsavel', COALESCE(v_todas->0->>'responsavel','nenhum'));
END; $$;

COMMENT ON FUNCTION public.anvisa_avaliar_insumo(uuid,uuid,numeric,text,text,text) IS
  'Avalia insumo pelos vinculos confirmados (TODOS, nao o primeiro), aplicando '
  'teor por constituinte, e devolve o PIOR status. p_funcao <> ATIVO desvia para '
  'a via da IN 211. Preferir sempre a anvisa_avaliar_ativo(nome) quando houver '
  'item_id: nome nao identifica insumo.';