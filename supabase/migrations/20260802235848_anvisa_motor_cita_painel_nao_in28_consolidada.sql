-- CORRECAO DE ENQUADRAMENTO 02/08/2026.
--
-- O motor dizia: "nao consta da lista da IN 28/2018; a lista e taxativa".
-- Errado por dois motivos:
--
-- 1. A base NAO vem da IN 28 consolidada. Vem do PAINEL da ANVISA, que e MAIS
--    COMPLETO: inclui constituintes autorizados por RESOLUCAO ESPECIFICA (RE),
--    que valem de imediato e so depois sao consolidados na IN 28. Concluir
--    "nao esta na IN 28 logo nao pode" ignora os autorizados por RE.
--
-- 2. norma_inclusao e a constante literal 'IN 28/2018' nas 538 linhas, e
--    origem_proveniencia e NULL em 523. A base nao sabe de onde cada
--    constituinte veio. Citar 'IN 28/2018' como fonte de um limite e afirmar
--    proveniencia NAO VERIFICADA.
--
-- Novo enquadramento: a conclusao e sobre a BASE SINCRONIZADA numa DATA, com a
-- janela cega declarada (RE publicada apos a ultima sync ainda nao aparece).

CREATE OR REPLACE FUNCTION public.anvisa_norma_de(p_c anvisa_constituintes)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_c.norma_ultima_alteracao IS NOT NULL THEN p_c.norma_ultima_alteracao
    -- 'IN 28/2018' e constante em toda a base: nao e proveniencia, e placeholder
    WHEN COALESCE(p_c.norma_inclusao,'') IN ('','IN 28/2018')
      THEN 'Painel oficial ANVISA (proveniencia especifica NAO registrada na sync)'
    ELSE p_c.norma_inclusao END;
$$;

COMMENT ON FUNCTION public.anvisa_norma_de(anvisa_constituintes) IS
  'Norma a citar. NAO devolve "IN 28/2018" quando esse for o placeholder '
  'constante da sync: citar norma nao verificada e pior que admitir a lacuna.';

CREATE OR REPLACE FUNCTION public.anvisa_base_contexto()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'fonte','Painel oficial da ANVISA (Power BI), sincronizado diariamente',
    'abrangencia','Mais completo que o texto consolidado da IN 28: inclui '
      || 'constituintes autorizados por Resolucao Especifica (RE), que valem de '
      || 'imediato e so depois sao consolidados na IN 28.',
    'constituintes_ativos',(SELECT count(*) FROM anvisa_constituintes WHERE ativo),
    'sincronizado_em',(SELECT max(sincronizado_em) FROM anvisa_constituintes),
    'horas_desde_sync', round(extract(epoch FROM (now() -
       (SELECT max(sincronizado_em) FROM anvisa_constituintes)))/3600.0, 1),
    'janela_cega','RE publicada APOS a ultima sincronizacao ainda nao aparece '
      || 'aqui. Antes de concluir definitivamente que um ativo nao e autorizado, '
      || 'conferir a pagina de ingredientes/REs da ANVISA.',
    'monitor_da_janela',(SELECT jsonb_build_object(
        'fonte','INGREDIENTES_ANVISA',
        'deteccoes_nao_revisadas', count(*) FILTER (WHERE status_revisao IS DISTINCT FROM 'revisado'))
      FROM legislacao_monitoramento WHERE fonte_monitorada='INGREDIENTES_ANVISA'));
$$;

COMMENT ON FUNCTION public.anvisa_base_contexto() IS
  'Contexto da base para acompanhar todo veredito: fonte, abrangencia, data e '
  'janela cega. Sem isso o laudo afirma mais do que o dado sustenta.';