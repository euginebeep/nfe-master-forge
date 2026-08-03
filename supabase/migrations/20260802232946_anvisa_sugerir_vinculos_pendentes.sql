-- Gera vinculos SUGERIDOS com status 'pendente'. NUNCA 'confirmado'.
--
-- Por que nao confirma automaticamente: medido em 02/08/2026, dos 27 insumos
-- com casamento "nao ambiguo", pelo menos 5 estavam errados —
--   Bromelina -> Mel (bug de substring, corrigido)
--   N-acetil-L-cisteina -> L-Cisteina (derivado, nao e o mesmo)
--   Magnesio citrato -> Magnesio citrato malato (constituintes distintos)
--   Astaxantina -> Esteres de astaxantina de Haematococcus (a fonte importa)
--   L-arginina HCl -> L-Arginina (o sal muda o teor)
-- ~18% de erro. Em produto notificado, vinculo errado e subdose ou superdose.
--
-- E por que nao temos o teor: 5 de 70 itens tem potencia_compra, 1 lote tem
-- potencia. Sem teor, a dose do constituinte e chute.

CREATE OR REPLACE FUNCTION public.anvisa_sugerir_vinculos(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  r RECORD; v_cid uuid; v_n_cand int; v_teor numeric;
  v_criados int := 0; v_ambiguos int := 0; v_sem int := 0; v_ja int := 0;
  v_lista_sem text[] := ARRAY[]::text[];
BEGIN
  FOR r IN
    SELECT DISTINCT i.id, i.descricao_interna AS nome
      FROM formula_itens fi
      JOIN itens i ON i.id = fi.produto_materia_prima_id
     WHERE fi.company_id = p_company_id
  LOOP
    IF EXISTS (SELECT 1 FROM item_anvisa_vinculo v
                WHERE v.item_id=r.id AND v.company_id=p_company_id) THEN
      v_ja := v_ja + 1; CONTINUE;
    END IF;

    SELECT count(*) INTO v_n_cand FROM anvisa_constituintes c
     WHERE c.ativo AND (
        lower(unaccent(c.nome_tecnico)) = lower(unaccent(r.nome))
     OR lower(unaccent(c.nome_tecnico)) ~ ('\m'||regexp_replace(lower(unaccent(r.nome)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
     OR lower(unaccent(r.nome)) ~ ('\m'||regexp_replace(lower(unaccent(c.nome_tecnico)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M'));

    IF v_n_cand = 0 THEN
      v_sem := v_sem + 1;
      v_lista_sem := array_append(v_lista_sem, r.nome);
      CONTINUE;
    END IF;

    IF v_n_cand > 1 THEN v_ambiguos := v_ambiguos + 1; END IF;

    v_cid := anvisa_casar_constituinte(r.nome);
    IF v_cid IS NULL THEN CONTINUE; END IF;

    -- teor no proprio nome: "BISGLICINATO DE MAGNESIO 10%"
    v_teor := NULLIF(replace((regexp_match(r.nome,'([0-9]+(?:[.,][0-9]+)?)\s*%'))[1],',','.'),'')::numeric;
    IF v_teor IS NULL THEN
      SELECT potencia_compra INTO v_teor FROM itens WHERE id=r.id;
    END IF;

    INSERT INTO item_anvisa_vinculo
      (company_id, item_id, constituinte_id, status, teor_nominal_pct, observacao)
    VALUES (p_company_id, r.id, v_cid, 'pendente', v_teor,
      'SUGESTAO AUTOMATICA ' || to_char(now(),'DD/MM/YYYY')
      || ' — casamento por nome (' || v_n_cand || ' candidato(s)). '
      || CASE WHEN v_n_cand > 1 THEN 'AMBIGUO: escolheu o nome mais especifico; conferir os outros. ' ELSE '' END
      || CASE WHEN v_teor IS NULL
              THEN 'TEOR DESCONHECIDO — a RT precisa informar, senao a dose do '
                || 'constituinte fica superestimada.'
              ELSE 'Teor ' || v_teor || '% lido do nome/cadastro — confirmar contra o CoA.' END
      || ' Nome NAO identifica insumo: confirmar so apos conferir ficha tecnica.')
    ON CONFLICT (item_id, constituinte_id) DO NOTHING;

    v_criados := v_criados + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'sugestoes_criadas', v_criados,
    'destas_ambiguas', v_ambiguos,
    'sem_candidato', v_sem,
    'ja_tinham_vinculo', v_ja,
    'sem_candidato_lista', to_jsonb(v_lista_sem),
    'aviso','Todas gravadas como PENDENTE. Nenhuma confirma nada. A RT confirma '
      || 'uma a uma apos conferir ficha tecnica e teor — 18% do casamento por '
      || 'nome estava errado na medicao de 02/08/2026.');
END; $$;

COMMENT ON FUNCTION public.anvisa_sugerir_vinculos(uuid) IS
  'Cria vinculos PENDENTES por casamento de nome, com a evidencia registrada em '
  'observacao. NUNCA gravar status confirmado aqui: confirmacao e ato da RT, e '
  'casamento por nome erra ~18%.';