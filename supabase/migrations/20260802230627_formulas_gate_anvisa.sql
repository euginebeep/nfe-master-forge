-- Impede aprovar formula com violacao CERTA. Nao bloqueia por ignorancia:
-- "nao localizado" hoje significa, na maioria dos casos, insumo sem vinculo
-- confirmado (cobertura de vinculo ~3%), nao ilegalidade. Bloquear os dois
-- juntos pararia a fabrica e ensinaria o usuario a ignorar o sistema.

CREATE OR REPLACE VIEW public.v_formulas_conformidade AS
SELECT f.id AS formula_id, f.company_id, f.codigo_formula, f.nome_formula, f.status,
       fi.id AS item_id, fi.nome_insumo, fi.quantidade_convertida_mg AS dose_mg,
       (anvisa_avaliar_ativo(fi.nome_insumo, fi.quantidade_convertida_mg, 'mg',
          COALESCE(f.grupo_populacional_alvo,'19_mais'))) AS avaliacao,
       (SELECT v.constituinte_id FROM item_anvisa_vinculo v
         WHERE v.item_id = fi.produto_materia_prima_id AND v.company_id = f.company_id
         LIMIT 1) AS vinculo_rt
FROM formulas f JOIN formula_itens fi ON fi.formula_id = f.id;

COMMENT ON VIEW public.v_formulas_conformidade IS
  'Avaliacao ANVISA por item de formula. vinculo_rt NULL = insumo sem vinculo '
  'confirmado pela RT: o veredito do motor e por nome e pode ser falso negativo.';

CREATE OR REPLACE FUNCTION public.formula_gate_anvisa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_dur text[] := ARRAY[]::text[]; v_desc text[] := ARRAY[]::text[]; r RECORD;
BEGIN
  IF NEW.status::text <> 'APROVADA' OR COALESCE(OLD.status::text,'') = 'APROVADA' THEN
    RETURN NEW;
  END IF;

  FOR r IN
    SELECT fi.nome_insumo, (anvisa_avaliar_ativo(fi.nome_insumo, fi.quantidade_convertida_mg,'mg',
             COALESCE(NEW.grupo_populacional_alvo,'19_mais'))) AS a
      FROM formula_itens fi WHERE fi.formula_id = NEW.id
  LOOP
    -- Violacao CERTA: dose acima do maximo, veto explicito ou grupo nao autorizado.
    IF r.a->>'status' = 'NAO_AUTORIZADO'
       AND r.a->>'fonte' <> 'varredura_completa_sem_resultado' THEN
      v_dur := array_append(v_dur, r.nome_insumo || ': ' || (r.a->>'motivo'));
    ELSIF r.a->>'status' = 'NAO_AUTORIZADO' THEN
      v_desc := array_append(v_desc, r.nome_insumo);
    END IF;
  END LOOP;

  IF array_length(v_dur,1) > 0 THEN
    RAISE EXCEPTION 'formula_gate_anvisa: nao e possivel aprovar. Violacao de limite '
      'ou veto expresso: %', array_to_string(v_dur, ' | ');
  END IF;

  IF array_length(v_desc,1) > 0 THEN
    NEW.observacoes_tecnicas := COALESCE(NEW.observacoes_tecnicas || E'\n', '')
      || '[ANVISA ' || to_char(now(),'DD/MM/YYYY') || '] Sem correspondencia na base '
      || 'oficial, exige vinculo confirmado pela RT antes de produzir: '
      || array_to_string(v_desc, ', ');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_formula_gate_anvisa ON public.formulas;
CREATE TRIGGER trg_formula_gate_anvisa
  BEFORE UPDATE ON public.formulas
  FOR EACH ROW EXECUTE FUNCTION public.formula_gate_anvisa();