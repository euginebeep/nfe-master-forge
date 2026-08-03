ALTER TABLE public.legislacao_fontes DROP CONSTRAINT IF EXISTS legislacao_fontes_categoria_check;
ALTER TABLE public.legislacao_fontes ADD CONSTRAINT legislacao_fontes_categoria_check
  CHECK (categoria = ANY (ARRAY[
    'NUCLEO_SUPLEMENTO','ATUALIZACAO_IN28','ROTULAGEM','BPF_GERAL',
    'APOIO_PERGUNTAS_RESPOSTAS','REFERENCIA_MEDICAMENTO_NAO_APLICAVEL',
    'ADITIVOS_COADJUVANTES','ATUALIZACAO_IN211']));

CREATE UNIQUE INDEX IF NOT EXISTS uq_legislacao_fontes_norma
  ON public.legislacao_fontes (tipo, numero, ano) WHERE numero <> '—';

-- URL do DataLegis para IN (padrao verificado em 02/08/2026); busca no DOU
-- para os tipos cujo codigo de tipo nao foi verificado.
INSERT INTO public.legislacao_fontes (tipo, numero, ano, titulo, categoria, status, data_publicacao, url_oficial)
SELECT v.tipo, v.numero, v.ano, v.titulo, v.categoria, v.status, v.data_publicacao,
       CASE WHEN v.tipo = 'IN' THEN
         'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=detalharAto&tipo=INM&numeroAto='
         || lpad(v.numero, 8, '0') || '&seqAto=000&valorAno=' || v.ano
         || '&orgao=DC%2FANVISA%2FMS&nomeTitulo=codigos&cod_modulo=310&cod_menu=8542'
       ELSE
         'https://www.in.gov.br/consulta/-/buscar/dou?q='
         || replace(v.tipo || '+' || v.numero || '+' || v.ano || '+Anvisa', ' ', '+')
       END
FROM (VALUES
  ('IN','211',2023,'Funcoes tecnologicas, limites maximos e condicoes de uso para aditivos alimentares e coadjuvantes de tecnologia','ADITIVOS_COADJUVANTES','VIGENTE','2023-03-08'::date),
  ('IN','452',2026,'Altera IN 211/2023 — Anexos III e IV; edulcorante e reguladores de acidez em 14.2; lecitina como coadjuvante em 22.0','ATUALIZACAO_IN211','VIGENTE','2026-06-12'::date),
  ('IN','432',2026,'Altera IN 211/2023','ATUALIZACAO_IN211','VIGENTE','2026-04-01'::date),
  ('IN','415',2025,'Altera IN 211/2023','ATUALIZACAO_IN211','VIGENTE','2025-12-17'::date),
  ('RDC','727',2022,'Rotulagem geral de alimentos embalados (arts. 11 e 12) — CP 1.400/2026 propoe alteracao','ROTULAGEM','VIGENTE','2022-07-01'::date),
  ('IN','318',2024,'Altera IN 28/2018 — alegacoes de vitaminas do complexo B; 24 meses de adequacao','ATUALIZACAO_IN28','VIGENTE','2024-09-20'::date),
  ('IN','361',2025,'Altera IN 28/2018','ATUALIZACAO_IN28','VIGENTE','2025-05-15'::date),
  ('IN','336',2024,'Altera IN 28/2018','ATUALIZACAO_IN28','VIGENTE','2024-11-28'::date),
  ('IN','304',2024,'Altera IN 28/2018','ATUALIZACAO_IN28','VIGENTE','2024-06-26'::date),
  ('IN','284',2024,'Altera IN 28/2018','ATUALIZACAO_IN28','VIGENTE','2024-03-07'::date),
  ('IN','275',2024,'Altera IN 28/2018','ATUALIZACAO_IN28','VIGENTE','2024-02-21'::date),
  ('IN','102',2021,'Altera IN 28/2018','ATUALIZACAO_IN28','VIGENTE','2021-10-20'::date),
  ('GUIA','16',2018,'Guia para determinacao de prazos de validade de alimentos','NUCLEO_SUPLEMENTO','VIGENTE','2018-01-01'::date)
) AS v(tipo,numero,ano,titulo,categoria,status,data_publicacao)
WHERE NOT EXISTS (
  SELECT 1 FROM public.legislacao_fontes f
   WHERE f.tipo=v.tipo AND f.numero=v.numero AND f.ano=v.ano);