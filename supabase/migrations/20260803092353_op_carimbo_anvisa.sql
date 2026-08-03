-- CARIMBO ANVISA NA ORDEM DE PRODUCAO.
--
-- Decisao do Fabio em 03/08: CARIMBAR, nao bloquear. Bloquear a producao e
-- mais duro que bloquear a aprovacao de formula, e hoje 65 insumos estao sem
-- vinculo confirmado — travaria a fabrica por divida nossa e da fila da RT.
--
-- Mas carimbar de verdade: colunas proprias (nao 'observacoes', que e campo
-- livre e some no meio de texto), snapshot congelado no momento da abertura, e
-- imutavel depois. O carimbo E a prova de que o sistema avisou.
--
-- A OP e o que vira LOTE no galpao. Formula aprovada e papel.

ALTER TABLE public.ordens_producao_industrial
  ADD COLUMN IF NOT EXISTS anvisa_status         text,
  ADD COLUMN IF NOT EXISTS anvisa_carimbo        jsonb,
  ADD COLUMN IF NOT EXISTS anvisa_resumo         text,
  ADD COLUMN IF NOT EXISTS anvisa_carimbado_em   timestamptz;

ALTER TABLE public.ordens_producao_industrial DROP CONSTRAINT IF EXISTS chk_op_anvisa_status;
ALTER TABLE public.ordens_producao_industrial ADD CONSTRAINT chk_op_anvisa_status
  CHECK (anvisa_status IS NULL OR anvisa_status IN
    ('CONFORME','COM_RESSALVA','NAO_CONFORME','SEM_FORMULA'));

COMMENT ON COLUMN public.ordens_producao_industrial.anvisa_status IS
  'CONFORME | COM_RESSALVA | NAO_CONFORME | SEM_FORMULA. Carimbo, NAO bloqueio: '
  'a OP abre mesmo NAO_CONFORME. O carimbo e a prova de que o sistema avisou '
  'antes do lote existir.';
COMMENT ON COLUMN public.ordens_producao_industrial.anvisa_carimbo IS
  'Snapshot por insumo no momento da abertura: status, motivo, constituinte, '
  'limites. Congelado — a base muda, o carimbo nao. E o que responde na '
  'fiscalizacao "o que o sistema sabia quando este lote foi produzido".';

CREATE OR REPLACE FUNCTION public.op_carimbo_anvisa()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r RECORD; v_a jsonb; v_itens jsonb := '[]'::jsonb;
  v_nao int := 0; v_pend int := 0; v_ok int := 0; v_sem_vinc int := 0;
BEGIN
  IF NEW.formula_id IS NULL THEN
    NEW.anvisa_status := 'SEM_FORMULA';
    NEW.anvisa_resumo := 'OP sem formula vinculada: nao ha o que avaliar.';
    NEW.anvisa_carimbado_em := now();
    RETURN NEW;
  END IF;

  FOR r IN SELECT fi.nome_insumo, fi.produto_materia_prima_id AS item_id,
                  fi.quantidade_convertida_mg AS dose,
                  COALESCE(fi.funcao_no_produto,'ATIVO') AS funcao
             FROM formula_itens fi WHERE fi.formula_id = NEW.formula_id
  LOOP
    v_a := anvisa_avaliar_insumo(r.item_id, NEW.company_id, r.dose, 'mg',
             '19_mais', r.funcao);

    IF v_a->>'via' = 'sem_vinculo' THEN v_sem_vinc := v_sem_vinc + 1; END IF;
    CASE v_a->>'status'
      WHEN 'NAO_AUTORIZADO'       THEN v_nao  := v_nao  + 1;
      WHEN 'PENDENTE_VERIFICACAO' THEN v_pend := v_pend + 1;
      ELSE v_ok := v_ok + 1;
    END CASE;

    v_itens := v_itens || jsonb_build_array(jsonb_build_object(
      'insumo', r.nome_insumo, 'funcao', r.funcao, 'dose_mg', r.dose,
      'status', v_a->>'status', 'via', v_a->>'via',
      'constituinte', v_a->>'constituinte',
      'responsavel', v_a->>'responsavel',
      'motivo', left(COALESCE(v_a->>'motivo',''), 400)));
  END LOOP;

  NEW.anvisa_status := CASE
    WHEN v_nao  > 0 THEN 'NAO_CONFORME'
    WHEN v_pend > 0 THEN 'COM_RESSALVA'
    ELSE 'CONFORME' END;

  NEW.anvisa_resumo := CASE NEW.anvisa_status
    WHEN 'CONFORME' THEN 'Todos os ' || v_ok || ' insumos conformes na data da abertura.'
    WHEN 'COM_RESSALVA' THEN v_pend || ' insumo(s) que o sistema NAO conseguiu '
      || 'verificar' || CASE WHEN v_sem_vinc > 0 THEN ' ('||v_sem_vinc||' sem vinculo '
      || 'confirmado pela RT)' ELSE '' END || '. Produzir sob responsabilidade da RT.'
    ELSE v_nao || ' insumo(s) NAO AUTORIZADOS pela IN 28/2018' ||
      CASE WHEN v_pend > 0 THEN ' e '||v_pend||' nao verificados' ELSE '' END
      || '. A OP foi aberta assim mesmo — o sistema NAO bloqueia producao, mas '
      || 'registra. Este carimbo e prova de ciencia previa ao lote.' END;

  NEW.anvisa_carimbo := jsonb_build_object(
    'avaliado_em', now(),
    'formula_id', NEW.formula_id, 'formula_codigo', NEW.formula_codigo,
    'total_insumos', v_ok + v_pend + v_nao,
    'conformes', v_ok, 'nao_verificados', v_pend, 'nao_autorizados', v_nao,
    'sem_vinculo_rt', v_sem_vinc,
    'base_sincronizada_em', (SELECT max(sincronizado_em) FROM anvisa_constituintes),
    'itens', v_itens);
  NEW.anvisa_carimbado_em := now();
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_op_carimbo_anvisa ON public.ordens_producao_industrial;
CREATE TRIGGER trg_op_carimbo_anvisa
  BEFORE INSERT ON public.ordens_producao_industrial
  FOR EACH ROW EXECUTE FUNCTION public.op_carimbo_anvisa();

-- Carimbo e prova: nao se reescreve depois que a OP existe.
CREATE OR REPLACE FUNCTION public.op_carimbo_imutavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF OLD.anvisa_carimbado_em IS NOT NULL
     AND (NEW.anvisa_carimbo      IS DISTINCT FROM OLD.anvisa_carimbo
       OR NEW.anvisa_status       IS DISTINCT FROM OLD.anvisa_status
       OR NEW.anvisa_carimbado_em IS DISTINCT FROM OLD.anvisa_carimbado_em) THEN
    RAISE EXCEPTION 'op_carimbo: o carimbo ANVISA e o retrato do que o sistema '
      'sabia na abertura da OP % e nao pode ser reescrito. Para reavaliar, '
      'abra nova OP.', OLD.codigo;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_op_carimbo_imutavel ON public.ordens_producao_industrial;
CREATE TRIGGER trg_op_carimbo_imutavel
  BEFORE UPDATE ON public.ordens_producao_industrial
  FOR EACH ROW EXECUTE FUNCTION public.op_carimbo_imutavel();