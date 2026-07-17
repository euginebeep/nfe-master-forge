-- ============================================================================
-- VERSIONAMENTO: public.anvisa_consultar — FONTE ÚNICA de consulta ANVISA
-- Já aplicada em produção (cqkvekdrifmvedvpjmjr). Idempotente.
-- NÃO remove buscar_constituinte_* / sugerir_constituintes (retrocompat).
-- Toda tela React deve chamar SÓ esta RPC para status de consulta.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.anvisa_consultar(p_termo text, p_grupo text DEFAULT NULL::text, p_dose_mg numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_termo text; v_id uuid; v_nome text; v_proib boolean; v_motivo text;
  v_cat text; v_norma text; v_aleg text[]; v_adv text[]; v_sim real;
  v_l19 jsonb; v_lges jsonb; v_llac jsonb; v_l48 jsonb; v_l918 jsonb;
  v_l06 jsonb; v_l711 jsonb; v_l13 jsonb;
  v_limite jsonb; v_texto_limite text; v_max_mg numeric; v_status text;
BEGIN
  IF p_termo IS NULL OR btrim(p_termo) = '' THEN
    RETURN jsonb_build_object('ok', false, 'status', 'termo_vazio', 'mensagem', 'Informe um termo para consultar.');
  END IF;
  v_termo := lower(unaccent(p_termo));

  SELECT c.id, c.nome_tecnico, c.is_proibido, c.motivo_proibicao, c.categoria, c.norma_inclusao,
         c.alegacoes, c.advertencias,
         c.limites_19_mais, c.limites_gestantes, c.limites_lactantes, c.limites_4_8_anos, c.limites_9_18_anos,
         c.limites_0_6_meses, c.limites_7_11_meses, c.limites_1_3_anos,
    GREATEST(
      similarity(lower(unaccent(c.nome_tecnico)), v_termo),
      similarity(lower(unaccent(COALESCE(c.nome_generico,''))), v_termo),
      similarity(lower(unaccent(COALESCE(c.nome_rotulo,''))), v_termo),
      COALESCE((SELECT max(similarity(lower(unaccent(np)), v_termo)) FROM unnest(c.nome_popular) np), 0),
      COALESCE((SELECT max(similarity(lower(unaccent(s)), v_termo)) FROM unnest(c.sinonimos) s), 0)
    )
  INTO v_id, v_nome, v_proib, v_motivo, v_cat, v_norma, v_aleg, v_adv,
       v_l19, v_lges, v_llac, v_l48, v_l918, v_l06, v_l711, v_l13, v_sim
  FROM public.anvisa_constituintes c
  WHERE similarity(lower(unaccent(c.nome_tecnico)), v_termo) > 0.15
     OR similarity(lower(unaccent(COALESCE(c.nome_generico,''))), v_termo) > 0.15
     OR similarity(lower(unaccent(COALESCE(c.nome_rotulo,''))), v_termo) > 0.15
     OR EXISTS (SELECT 1 FROM unnest(c.nome_popular) np WHERE similarity(lower(unaccent(np)), v_termo) > 0.15 OR lower(unaccent(np))=v_termo)
     OR EXISTS (SELECT 1 FROM unnest(c.sinonimos) s WHERE similarity(lower(unaccent(s)), v_termo) > 0.15 OR lower(unaccent(s))=v_termo)
  ORDER BY 17 DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'status', 'nao_encontrado', 'termo', p_termo,
      'mensagem', format('"%s" não consta na base de constituintes ANVISA (IN 28/2018). Consulte a ANVISA diretamente ou registre como PENDENTE_RT.', p_termo));
  END IF;

  IF COALESCE(v_proib, false) THEN
    RETURN jsonb_build_object('ok', true, 'status', 'proibido', 'constituinte_id', v_id,
      'nome_tecnico', v_nome, 'similaridade', v_sim, 'motivo', v_motivo,
      'mensagem', format('"%s" é PROIBIDO: %s', v_nome, COALESCE(v_motivo,'ver norma')));
  END IF;

  IF p_grupo IS NOT NULL THEN
    v_limite := CASE lower(p_grupo)
      WHEN '19_mais' THEN v_l19 WHEN 'adulto' THEN v_l19
      WHEN 'gestantes' THEN v_lges WHEN 'lactantes' THEN v_llac
      WHEN '0_6_meses' THEN v_l06 WHEN '7_11_meses' THEN v_l711
      WHEN '1_3_anos' THEN v_l13 WHEN '4_8_anos' THEN v_l48 WHEN '9_18_anos' THEN v_l918
      ELSE NULL END;
    IF v_limite IS NOT NULL THEN
      v_texto_limite := v_limite->>'texto';
      IF v_texto_limite ILIKE '%não autorizado%' THEN
        RETURN jsonb_build_object('ok', true, 'status', 'nao_autorizado_grupo', 'constituinte_id', v_id,
          'nome_tecnico', v_nome, 'grupo', p_grupo,
          'mensagem', format('"%s" NÃO é autorizado para o grupo %s.', v_nome, p_grupo));
      END IF;
      v_max_mg := NULLIF(regexp_replace(COALESCE(substring(v_texto_limite from 'M[áa]ximo:\s*([0-9\.\,]+)'), ''), '[^0-9]', '', 'g'), '')::numeric;
      IF p_dose_mg IS NOT NULL AND v_max_mg IS NOT NULL THEN
        v_status := CASE WHEN p_dose_mg > v_max_mg THEN 'acima_limite' ELSE 'conforme' END;
        RETURN jsonb_build_object('ok', true, 'status', v_status, 'constituinte_id', v_id,
          'nome_tecnico', v_nome, 'grupo', p_grupo, 'dose_mg', p_dose_mg, 'limite_maximo_mg', v_max_mg, 'limite_texto', v_texto_limite,
          'mensagem', format('%s: dose %s mg vs máximo %s mg do grupo %s.',
            CASE WHEN v_status='conforme' THEN 'CONFORME' ELSE 'ACIMA DO LIMITE' END, p_dose_mg, v_max_mg, p_grupo));
      END IF;
      RETURN jsonb_build_object('ok', true, 'status', 'encontrado', 'constituinte_id', v_id,
        'nome_tecnico', v_nome, 'grupo', p_grupo, 'limite_texto', v_texto_limite,
        'mensagem', format('"%s" encontrado. Limite do grupo %s: %s', v_nome, p_grupo, v_texto_limite));
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', 'encontrado', 'constituinte_id', v_id,
    'nome_tecnico', v_nome, 'similaridade', v_sim, 'categoria', v_cat, 'norma_inclusao', v_norma,
    'alegacoes', to_jsonb(v_aleg), 'advertencias', to_jsonb(v_adv),
    'limites', jsonb_build_object('19_mais', v_l19, 'gestantes', v_lges, 'lactantes', v_llac, '4_8_anos', v_l48, '9_18_anos', v_l918),
    'mensagem', format('"%s" consta na base ANVISA (%s).', v_nome, COALESCE(v_norma,'IN 28/2018')));
END;
$function$


GRANT EXECUTE ON FUNCTION public.anvisa_consultar(text, text, numeric)
  TO anon, authenticated, service_role;
