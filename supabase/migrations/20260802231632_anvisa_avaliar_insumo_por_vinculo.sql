-- PRINCIPIO: a lei nao negocia. Confirmacao da RT identifica QUAL constituinte
-- o insumo e — nunca cria autorizacao. A FK item_anvisa_vinculo -> 
-- anvisa_constituintes ja garante isso no schema: nao existe vinculo para
-- constituinte inexistente.
--
-- Esta funcao avalia pelo VINCULO, nao por nome. Casamento por nome foi o que
-- fez Ashwagandha receber a chave omega3_epa_dha e passar como aprovada.
-- Aplica o TEOR: 500 mg de um quelato a 18% entregam 90 mg do constituinte.

CREATE OR REPLACE FUNCTION public.anvisa_avaliar_insumo(
  p_item_id uuid, p_company_id uuid, p_dose numeric DEFAULT NULL,
  p_unidade text DEFAULT 'mg', p_grupo text DEFAULT '19_mais')
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_v RECORD; v_c anvisa_constituintes%ROWTYPE; v_desc text;
  v_dose_const numeric; v_base jsonb;
BEGIN
  SELECT descricao_interna INTO v_desc FROM itens WHERE id = p_item_id;

  SELECT * INTO v_v FROM item_anvisa_vinculo
   WHERE item_id = p_item_id AND company_id = p_company_id
     AND status = 'confirmado' AND constituinte_id IS NOT NULL
   ORDER BY confirmado_em DESC LIMIT 1;

  -- Sem vinculo confirmado: ninguem identificou o que este po e.
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'status','PENDENTE_VERIFICACAO', 'insumo', v_desc, 'item_id', p_item_id,
      'via','sem_vinculo',
      'motivo','Insumo sem vinculo confirmado a constituinte autorizado. Nao e '
        || 'possivel afirmar que corresponde a algum item da IN 28/2018. '
        || 'Avaliacao por semelhanca de nome NAO substitui identificacao.',
      'responsavel','rt_do_tenant_confirma_vinculo',
      'acao_da_rt','Confirmar em item_anvisa_vinculo qual constituinte autorizado '
        || 'este insumo representa, com teor. Se nenhum representa, o insumo nao '
        || 'serve para suplemento alimentar — a confirmacao da RT nao cria '
        || 'autorizacao, apenas identifica.',
      'avaliacao_por_nome_apenas_informativa',
        anvisa_avaliar_ativo(v_desc, p_dose, p_unidade, p_grupo));
  END IF;

  SELECT * INTO v_c FROM anvisa_constituintes WHERE id = v_v.constituinte_id;

  -- Constituinte vinculado saiu da lista de ativos: a lei mudou, o vinculo nao salva.
  IF NOT COALESCE(v_c.ativo,false) THEN
    RETURN jsonb_build_object('status','NAO_AUTORIZADO','insumo',v_desc,
      'constituinte', v_c.nome_tecnico, 'via','vinculo_confirmado',
      'motivo','O constituinte vinculado nao consta mais como ativo na base '
        || 'oficial. Vinculo confirmado pela RT nao mantem autorizacao revogada.',
      'responsavel','regra_da_anvisa_nao_negociavel');
  END IF;

  -- TEOR: 500 mg de quelato a 18% entregam 90 mg do constituinte.
  v_dose_const := CASE
    WHEN p_dose IS NULL THEN NULL
    WHEN v_v.teor_nominal_pct IS NOT NULL THEN p_dose * v_v.teor_nominal_pct / 100.0
    ELSE p_dose END;

  v_base := anvisa_avaliar_ativo(v_c.nome_tecnico, v_dose_const, p_unidade, p_grupo);

  RETURN v_base
      || jsonb_build_object(
           'insumo', v_desc, 'item_id', p_item_id, 'via','vinculo_confirmado',
           'confirmado_por', v_v.confirmado_por, 'confirmado_em', v_v.confirmado_em,
           'dose_insumo', p_dose, 'teor_nominal_pct', v_v.teor_nominal_pct,
           'dose_constituinte_calculada', v_dose_const,
           'observacao_teor', CASE WHEN v_v.teor_nominal_pct IS NULL
             THEN 'Teor nao informado no vinculo: dose tratada como 100% do '
               || 'constituinte. Se o insumo for quelato ou extrato padronizado, '
               || 'isto SUPERESTIMA a entrega e pode mascarar subdose.'
             ELSE NULL END);
END; $$;

COMMENT ON FUNCTION public.anvisa_avaliar_insumo(uuid,uuid,numeric,text,text) IS
  'Avalia insumo pelo VINCULO confirmado, aplicando teor. Preferir sempre a '
  'anvisa_avaliar_ativo(nome) quando houver item_id: nome nao identifica insumo.';