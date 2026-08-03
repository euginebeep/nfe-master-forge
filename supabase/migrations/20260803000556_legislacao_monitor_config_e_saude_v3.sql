CREATE TABLE IF NOT EXISTS public.legislacao_monitor_config (
  fonte text PRIMARY KEY, url text NOT NULL,
  metodo text NOT NULL DEFAULT 'hash_html', alvo text NOT NULL,
  ativo boolean NOT NULL DEFAULT true, motivo_inativa text,
  deve_variar boolean NOT NULL DEFAULT true, dias_max_congelado int NOT NULL DEFAULT 7,
  observacao text, criado_em timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.legislacao_monitor_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS monitor_config_select ON public.legislacao_monitor_config;
CREATE POLICY monitor_config_select ON public.legislacao_monitor_config FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS monitor_config_write ON public.legislacao_monitor_config;
CREATE POLICY monitor_config_write ON public.legislacao_monitor_config FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.legislacao_monitor_config IS
  'Fontes monitoradas. A edge function DEVE ler daqui em vez de lista fixa no '
  'codigo. Auditoria 02/08/2026: /leiturajornal e casca JS (falso negativo); '
  '/consulta/-/buscar/dou?q= devolve server-side e funciona.';

INSERT INTO public.legislacao_monitor_config
 (fonte, url, metodo, alvo, ativo, motivo_inativa, deve_variar, dias_max_congelado, observacao)
VALUES
 ('PAINEL_CONSTITUINTES','https://www.gov.br/anvisa/pt-br/assuntos/alimentos/paineis-de-consulta-de-alimentos','hash_html','Painel de constituintes (IN 28 + REs)', true, NULL, true, 30,'FUNCIONA. Detectou a saida do Lactobacillus rhamnosus GG em 01/08.'),
 ('DOU_RESOLUCOES_RE','https://www.in.gov.br/consulta/-/buscar/dou?q=suplemento+alimentar+resolucao+RE&s=do1','hash_html','REs que autorizam constituintes antes da IN 28', true, NULL, true, 7,'FUNCIONA. Usa /consulta/-/buscar — server-side. Padrao a replicar.'),
 ('NOTICIAS_ANVISA','https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa','hash_html','Noticias', true, NULL, true, 14,'Funciona, mas e noticia e nao norma: nao deve gerar alerta critico.'),
 ('INGREDIENTES_ANVISA','https://www.gov.br/anvisa/pt-br/assuntos/alimentos/ingredientes','hash_html','Pagina de ingredientes/REs — fecha a janela cega', true, NULL, true, 30,'Hash congelado em 3 dias. Pode ser pagina estavel ou casca JS. Confirmar.'),
 ('DOU_SECAO1','https://www.in.gov.br/leiturajornal?data=hoje&secao=do1','hash_html','DOU Secao 1', false,'FALSO NEGATIVO CONFIRMADO: hash identico em 31/07, 01/08 e 02/08. /leiturajornal e renderizado por JavaScript — o hash pega a casca. Migrar para /consulta/-/buscar/dou?q=', true, 3, 'DESLIGADA ate migrar de endpoint.'),
 ('DOU_SECAO1_V4_HTML','https://www.in.gov.br/leiturajornal?data=hoje&secao=do1','hash_html','DOU Secao 1 (duplicata)', false,'Duplicata com o mesmo defeito. Sem execucao desde 31/07.', true, 3, NULL),
 ('ANVISALEGIS_IN28','https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=abrirTextoAto&tipo=INM&numeroAto=00000028&seqAto=000&valorAno=2018&orgao=DC%2FANVISA%2FMS&cod_menu=1696&cod_modulo=134&pesquisa=true','hash_html','IN 28 consolidada', false,'FALSO POSITIVO: falha de encoding (Datalegis serve ISO-8859-1) e grava mudanca_detectada=true com hash NULL. Erro de infra virando alerta normativo. Corrigir decode antes de reativar.', true, 7, NULL),
 ('ANVISALEGIS_IN28_V4_HTML','https://anvisalegis.datalegis.net/action/UrlPublicasAction.php?acao=abrirAtoPublico&num_ato=00000028&sgl_tipo=INS&sgl_orgao=ANVS&ano_ato=2018','hash_html','IN 28 consolidada (duplicata)', false,'Hash congelado 15 dias, sem execucao desde 31/07.', true, 7, NULL),
 ('DOU_IN211','https://www.in.gov.br/consulta/-/buscar/dou?q=%22Instru%C3%A7%C3%A3o+Normativa%22+%22IN+n%C2%BA+211%22+aditivos&s=do1','hash_html','Alteradoras da IN 211 (aditivos e coadjuvantes)', true, NULL, true, 7,'NOVA. Nenhuma fonte cobria IN 211 — por isso a IN 452/2026 passou e a cadeia ficou 9 normas atrasada.'),
 ('DOU_RDC_SUPLEMENTOS','https://www.in.gov.br/consulta/-/buscar/dou?q=%22Resolu%C3%A7%C3%A3o+da+Diretoria+Colegiada%22+suplemento+alimentar&s=do1','hash_html','RDCs de suplemento (243/2018, 843/2024, 727/2022)', true, NULL, true, 7,'NOVA. Nenhuma fonte cobria RDC.'),
 ('DOU_CONSULTAS_PUBLICAS','https://www.in.gov.br/consulta/-/buscar/dou?q=%22Consulta+P%C3%BAblica%22+anvisa+suplemento&s=do1','hash_html','Consultas Publicas — aviso previo de 3 a 12 meses', true, NULL, true, 14,'NOVA. CP 1.400/2026 so foi descoberta por busca manual.')
ON CONFLICT (fonte) DO UPDATE SET url=EXCLUDED.url, ativo=EXCLUDED.ativo,
  motivo_inativa=EXCLUDED.motivo_inativa, observacao=EXCLUDED.observacao;

CREATE OR REPLACE VIEW public.v_legislacao_monitor_saude AS
WITH ult AS (
  SELECT fonte_monitorada, count(DISTINCT created_at::date) AS dias,
         count(DISTINCT hash_novo) FILTER (WHERE hash_novo IS NOT NULL) AS hashes,
         count(*) FILTER (WHERE hash_novo IS NULL) AS sem_hash,
         count(*) AS execucoes, max(created_at) AS ultima_execucao
    FROM legislacao_monitoramento GROUP BY fonte_monitorada
)
SELECT c.fonte, c.alvo, c.ativo, COALESCE(u.execucoes,0) AS execucoes,
       COALESCE(u.hashes,0) AS hashes_distintos, u.ultima_execucao,
       round(extract(epoch FROM (now()-u.ultima_execucao))/86400.0,1) AS dias_sem_rodar,
       CASE
         WHEN NOT c.ativo THEN 'DESLIGADA: '||COALESCE(c.motivo_inativa,'sem motivo')
         WHEN u.fonte_monitorada IS NULL THEN 'NUNCA EXECUTOU'
         WHEN u.sem_hash = u.execucoes THEN 'FALHA TOTAL — hash sempre NULL'
         WHEN now() - u.ultima_execucao > interval '3 days' THEN 'PAROU DE RODAR'
         WHEN c.deve_variar AND u.hashes <= 1 AND u.dias >= c.dias_max_congelado
           THEN 'HASH CONGELADO — provavel casca de JavaScript'
         ELSE 'OK' END AS diagnostico,
       c.observacao
FROM legislacao_monitor_config c
LEFT JOIN ult u ON u.fonte_monitorada = c.fonte;

COMMENT ON VIEW public.v_legislacao_monitor_saude IS
  'Saude por fonte. HASH CONGELADO e o defeito mais perigoso: reporta sucesso '
  'sem verificar nada. Falso negativo nao aparece na fila — so quando alguem '
  'descobre a norma por fora.';

-- Vocabulario de status_revisao e PENDENTE|APROVADO|DESCARTADO. Nao existe
-- 'revisado' — filtros por <> 'revisado' contavam tudo como pendente.
COMMENT ON COLUMN public.anvisa_alertas_normativos.status_revisao IS
  'PENDENTE | APROVADO | DESCARTADO. NAO existe "revisado": filtrar por '
  '<> ''revisado'' retorna a tabela inteira e infla a fila.';

UPDATE public.anvisa_alertas_normativos
   SET status_revisao='DESCARTADO', revisado_em=now(),
       descricao = descricao || E'\n\n[DESCARTADO 02/08/2026] FALSO POSITIVO: erro '
         || 'de encoding do Datalegis (ISO-8859-1 nao decodificado) registrado '
         || 'como mudanca normativa. Nao houve alteracao de norma. Fonte '
         || 'desligada em legislacao_monitor_config ate o decode ser corrigido.'
 WHERE titulo ILIKE '%Fonte inacess%' AND status_revisao='PENDENTE';