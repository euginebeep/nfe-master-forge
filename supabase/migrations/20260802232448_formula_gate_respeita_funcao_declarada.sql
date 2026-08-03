-- Gate passa a respeitar a funcao declarada. NULL continua sendo tratado como
-- ATIVO — omissao falha para o lado estrito.

CREATE OR REPLACE FUNCTION public.formula_gate_anvisa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_lei text[] := ARRAY[]::text[]; v_sem_vinculo text[] := ARRAY[]::text[];
  v_nao_verificado text[] := ARRAY[]::text[];
  r RECORD; v_a jsonb;
BEGIN
  IF NEW.status::text <> 'APROVADA' OR COALESCE(OLD.status::text,'') = 'APROVADA' THEN
    RETURN NEW;
  END IF;

  FOR r IN SELECT fi.nome_insumo, fi.produto_materia_prima_id AS item_id,
                  fi.quantidade_convertida_mg AS dose,
                  COALESCE(fi.funcao_no_produto,'ATIVO') AS funcao
             FROM formula_itens fi WHERE fi.formula_id = NEW.id
  LOOP
    v_a := anvisa_avaliar_insumo(r.item_id, NEW.company_id, r.dose, 'mg',
             COALESCE(NEW.grupo_populacional_alvo,'19_mais'), r.funcao);

    IF r.funcao <> 'ATIVO' THEN
      v_nao_verificado := array_append(v_nao_verificado, r.nome_insumo||' ('||r.funcao||')');
    ELSIF v_a->>'via' = 'sem_vinculo' THEN
      v_sem_vinculo := array_append(v_sem_vinculo, r.nome_insumo);
    ELSIF v_a->>'status' = 'NAO_AUTORIZADO' THEN
      v_lei := array_append(v_lei, r.nome_insumo || ' — ' || (v_a->>'motivo'));
    END IF;
  END LOOP;

  -- BLOQUEIA: violacao de limite legal
  IF array_length(v_lei,1) > 0 THEN
    RAISE EXCEPTION E'formula_gate_anvisa: APROVACAO BLOQUEADA — violacao da IN 28/2018.\n%\n'
      'Nao ha aprovacao interna que dispense limite legal.',
      array_to_string(v_lei, E'\n');
  END IF;

  -- BLOQUEIA: ativo que ninguem identificou
  IF array_length(v_sem_vinculo,1) > 0 THEN
    RAISE EXCEPTION E'formula_gate_anvisa: APROVACAO BLOQUEADA — ativo sem vinculo '
      'confirmado a constituinte autorizado: %.\n'
      'A RT deve confirmar em item_anvisa_vinculo QUAL constituinte cada insumo '
      'representa, com teor. Se o insumo entra como excipiente, declare '
      'formula_itens.funcao_no_produto com funcao tecnologica e justificativa. '
      'Confirmar vinculo IDENTIFICA — nao autoriza.',
      array_to_string(v_sem_vinculo, ', ');
  END IF;

  -- NAO BLOQUEIA, mas carimba: excipiente que o ERP ainda nao sabe verificar
  IF array_length(v_nao_verificado,1) > 0 THEN
    NEW.observacoes_tecnicas := COALESCE(NEW.observacoes_tecnicas || E'\n','')
      || '[ANVISA ' || to_char(now(),'DD/MM/YYYY') || '] Nao-ativos declarados, '
      || 'NAO verificados contra a IN 211/2023 (lista nao ingerida no ERP): '
      || array_to_string(v_nao_verificado, ', ')
      || '. Pendencia da plataforma, nao do cliente.';
  END IF;

  RETURN NEW;
END; $$;