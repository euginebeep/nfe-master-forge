-- Endurecimento: aprovar formula passa a exigir que TODO ativo tenha vinculo
-- confirmado a constituinte autorizado. Motivo: a lei nao negocia — insumo que
-- ninguem identificou nao pode entrar em produto notificado.
--
-- Nao trava excipiente: verificado em 02/08/2026 que formula_itens contem
-- apenas ativos; os QSP (dioxido de silicio, estearato de magnesio, talco)
-- entram em outro ponto do fluxo e sao coadjuvantes, nao constituintes.

CREATE OR REPLACE FUNCTION public.formula_gate_anvisa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_lei text[] := ARRAY[]::text[]; v_sem_vinculo text[] := ARRAY[]::text[];
  r RECORD; v_a jsonb;
BEGIN
  IF NEW.status::text <> 'APROVADA' OR COALESCE(OLD.status::text,'') = 'APROVADA' THEN
    RETURN NEW;
  END IF;

  FOR r IN SELECT fi.nome_insumo, fi.produto_materia_prima_id AS item_id,
                  fi.quantidade_convertida_mg AS dose
             FROM formula_itens fi WHERE fi.formula_id = NEW.id
  LOOP
    v_a := anvisa_avaliar_insumo(r.item_id, NEW.company_id, r.dose, 'mg',
             COALESCE(NEW.grupo_populacional_alvo,'19_mais'));

    IF v_a->>'via' = 'sem_vinculo' THEN
      v_sem_vinculo := array_append(v_sem_vinculo, r.nome_insumo);
    ELSIF v_a->>'status' = 'NAO_AUTORIZADO' THEN
      v_lei := array_append(v_lei, r.nome_insumo || ' — ' || (v_a->>'motivo'));
    END IF;
  END LOOP;

  IF array_length(v_lei,1) > 0 THEN
    RAISE EXCEPTION E'formula_gate_anvisa: APROVACAO BLOQUEADA — violacao da IN 28/2018.\n%\n'
      'Nao ha aprovacao interna que dispense limite legal.',
      array_to_string(v_lei, E'\n');
  END IF;

  IF array_length(v_sem_vinculo,1) > 0 THEN
    RAISE EXCEPTION E'formula_gate_anvisa: APROVACAO BLOQUEADA — insumo sem vinculo '
      'confirmado a constituinte autorizado: %.\n'
      'A RT deve confirmar em item_anvisa_vinculo QUAL constituinte cada insumo '
      'representa, com teor. Se nenhum representa, o insumo nao serve para '
      'suplemento alimentar. Confirmar vinculo identifica — nao autoriza.',
      array_to_string(v_sem_vinculo, ', ');
  END IF;

  RETURN NEW;
END; $$;