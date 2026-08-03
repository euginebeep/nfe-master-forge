-- PERGUNTA: descobrir que a NOSSA copia da norma estava incompleta dispara algo
-- para a RT do tenant?
--
-- Teste da fronteira: a cadeia da IN 211 e a mesma para todo mundo -> e regra,
-- logo PLATAFORMA. A RT nao decide e nao e consultada.
--
-- MAS "nao decide" e diferente de "nao e informada". O principio diz que o ERP
-- INFORMA o que mudou. E informar so faz sentido se houver EXPOSICAO — alertar
-- todo tenant sobre toda lacuna nossa vira ruido, e ruido ensina a ignorar.
--
-- Logo: notificar apenas quando a lacuna toca insumo que ESTE tenant usa.
-- Verificado em 02/08/2026: ProLab tem 4 itens de talco e estearato de
-- magnesio cadastrados — exatamente as substancias cuja linha na categoria
-- 14.2 nunca foi lida. Exposicao real.

CREATE OR REPLACE VIEW public.v_anvisa_exposicao_tenant AS
SELECT i.company_id,
       i.id AS item_id,
       i.descricao_interna AS insumo,
       c.categoria,
       c.estado AS estado_ingestao,
       c.linhas_ingeridas,
       c.observacao AS lacuna,
       (SELECT count(*) FROM formula_itens fi WHERE fi.produto_materia_prima_id = i.id) AS usos_em_formula
FROM itens i
CROSS JOIN anvisa_in211_completude c
WHERE i.ativo
  AND c.estado <> 'COMPLETA'
  AND c.categoria = '14.2'
  -- substancias tipicamente nao-ativas, regidas pela IN 211
  AND (i.descricao_interna ILIKE '%talco%'
    OR i.descricao_interna ILIKE '%estearato%'
    OR i.descricao_interna ILIKE '%silic%' OR i.descricao_interna ILIKE '%silíc%'
    OR i.descricao_interna ILIKE '%dioxido%' OR i.descricao_interna ILIKE '%dióxido%'
    OR i.descricao_interna ILIKE '%celulose%' OR i.descricao_interna ILIKE '%lecitin%'
    OR i.descricao_interna ILIKE '%croscarmelose%' OR i.descricao_interna ILIKE '%povidona%');

COMMENT ON VIEW public.v_anvisa_exposicao_tenant IS
  'Insumos do tenant sujeitos a categoria da IN 211 cuja ingestao esta '
  'incompleta. Base para CIENCIA da RT — nunca para tarefa: completar a '
  'ingestao e obrigacao da plataforma.';

CREATE OR REPLACE FUNCTION public.anvisa_ciencia_lacuna_normativa(p_company_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_itens jsonb; v_n int; v_normas int;
BEGIN
  SELECT jsonb_agg(jsonb_build_object('insumo', insumo, 'usos_em_formula', usos_em_formula)),
         count(*)
    INTO v_itens, v_n
    FROM v_anvisa_exposicao_tenant WHERE company_id = p_company_id;

  SELECT count(*) INTO v_normas FROM legislacao_fontes
   WHERE categoria = 'ATUALIZACAO_IN211' AND texto_completo IS NULL;

  IF COALESCE(v_n,0) = 0 THEN
    RETURN jsonb_build_object('notificar_rt', false,
      'motivo','Nenhum insumo deste tenant cai em categoria da IN 211 com '
        || 'ingestao incompleta. Lacuna existe, mas nao ha exposicao — '
        || 'notificar seria ruido.');
  END IF;

  RETURN jsonb_build_object(
    'notificar_rt', true,
    'tipo','CIENCIA',
    'nao_e_tarefa_da_rt', true,
    'titulo','Insumos sujeitos a norma que o ERP ainda nao verifica integralmente',
    'corpo','A lista de aditivos e coadjuvantes da IN 211/2023 para a categoria '
      || '14.2 (suplementos solidos) NAO esta integralmente ingerida no ERP. '
      || v_n || ' insumo(s) desta empresa caem nessa categoria. Ate a ingestao '
      || 'ser concluida, o sistema NAO afirma conformidade desses itens — '
      || 'registra que nao verificou. Ha ainda ' || v_normas || ' normas '
      || 'alteradoras da IN 211 cadastradas sem texto.',
    'insumos_expostos', v_itens,
    'responsavel_pela_correcao','plataforma',
    'o_que_a_rt_faz','Nada alem de tomar ciencia. A RT NAO deve pesquisar a '
      || 'norma nem preencher a lacuna: parsear a norma e trabalho da '
      || 'plataforma. Se preferir conferir por conta propria no painel de '
      || 'aditivos da ANVISA, e escolha dela, nao exigencia do sistema.',
    'o_que_a_rt_NAO_deve_concluir','Que os insumos estao irregulares. Ausencia '
      || 'na nossa copia parcial nao prova ausencia na norma.');
END; $$;

COMMENT ON FUNCTION public.anvisa_ciencia_lacuna_normativa(uuid) IS
  'Decide se a lacuna de ingestao gera CIENCIA para a RT. Notifica so quando ha '
  'exposicao real do tenant. Sempre tipo CIENCIA, nunca tarefa — a correcao e '
  'da plataforma.';