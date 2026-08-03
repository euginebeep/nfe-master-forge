-- Lista de candidatos por insumo, para a RT ESCOLHER. Nao decide.
-- Usa duas evidencias independentes:
--   1. nome do constituinte (palavra inteira)
--   2. fonte_de — campo 100% preenchido pela sync, diz qual nutriente o
--      constituinte fornece. E a ponte que resolve "VITAMINA C" -> os 7 sais.
-- O ganho e transformar "procure entre 538" em "escolha entre 3".

CREATE OR REPLACE VIEW public.v_anvisa_vinculo_candidatos AS
WITH insumos AS (
  SELECT DISTINCT i.id AS item_id, fi.company_id, i.descricao_interna AS insumo,
         lower(unaccent(i.descricao_interna)) AS n
  FROM formula_itens fi JOIN itens i ON i.id = fi.produto_materia_prima_id
),
esc AS (SELECT item_id, company_id, insumo,
        regexp_replace(n,'([.^$*+?()\[\]{}|\\-])','\\\1','g') AS n FROM insumos)
SELECT e.item_id, e.company_id, e.insumo,
       c.id AS constituinte_id, c.nome_tecnico, c.categoria, c.fonte_de,
       c.limites_19_mais->>'texto' AS limite_19_mais,
       c.limite_parse_status,
       CASE
         WHEN lower(unaccent(c.nome_tecnico)) = lower(unaccent(e.insumo)) THEN 'nome_exato'
         WHEN lower(unaccent(c.nome_tecnico)) ~ ('\m'||e.n||'\M')
           OR lower(unaccent(e.insumo)) ~ ('\m'||regexp_replace(lower(unaccent(c.nome_tecnico)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
           THEN 'nome_parcial'
         ELSE 'fonte_de' END AS evidencia,
       (SELECT count(*) FROM item_anvisa_vinculo v
         WHERE v.item_id=e.item_id AND v.constituinte_id=c.id) > 0 AS ja_vinculado
FROM esc e
JOIN anvisa_constituintes c ON c.ativo AND (
      lower(unaccent(c.nome_tecnico)) = lower(unaccent(e.insumo))
   OR lower(unaccent(c.nome_tecnico)) ~ ('\m'||e.n||'\M')
   OR lower(unaccent(e.insumo)) ~ ('\m'||regexp_replace(lower(unaccent(c.nome_tecnico)),'([.^$*+?()\[\]{}|\\-])','\\\1','g')||'\M')
   OR lower(unaccent(COALESCE(c.fonte_de,''))) ~ ('\m'||e.n||'\M'));

COMMENT ON VIEW public.v_anvisa_vinculo_candidatos IS
  'Candidatos a vinculo por insumo, com a evidencia que os trouxe. NAO decide: '
  'a RT escolhe. "VITAMINA C" traz 7 sais com teores diferentes — acido '
  'ascorbico e acerola em po nao sao a mesma coisa.';