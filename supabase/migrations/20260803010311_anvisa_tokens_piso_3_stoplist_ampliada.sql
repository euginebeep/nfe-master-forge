-- "CHA VERDE" tokenizava para ["verde"] — "cha" caia no piso de 4 caracteres.
-- Sobrava um ADJETIVO, que casava com "Cafe verde em po", "Cafe verde moido" e
-- "Extrato de cafe verde". Ambiguidade espuria: nenhum candidato e cha verde,
-- e a RT com pressa poderia vincular cha verde a cafe verde — erro grave em
-- produto notificado, e exatamente a armadilha ja sinalizada.
--
-- Correcao: piso 3 (entra "cha", entra "MSM") + stoplist ampliada com
-- preposicoes, unidades e qualificadores comerciais. Com "cha" no conjunto,
-- exigir TODOS os tokens faz chá verde voltar a AUSENTE — que e a verdade.

CREATE OR REPLACE FUNCTION public.anvisa_tokens_insumo(p_nome text)
RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT array_agg(tok) FROM (
    SELECT DISTINCT tok FROM unnest(
      regexp_split_to_array(
        regexp_replace(lower(unaccent(COALESCE(p_nome,''))),
                       '[^a-z ]', ' ', 'g'), '\s+')) AS tok
     WHERE length(tok) >= 3
       AND tok NOT IN (
         -- preposicoes e conectivos
         'de','da','do','das','dos','com','sem','por','para','pra','nos','nas',
         -- forma fisica e apresentacao
         'ext','extr','seco','seca','sec','pos','puro','pura','tipo','food',
         'grade','anidro','anidra','micronizado','micronizada','liofilizado',
         'padronizado','padronizada','instantaneo','instantanea',
         -- qualificadores comerciais
         'quelato','quelatos','quelado','quelada','marca','linha','premium',
         'std','max','plus','forte','ultra','nano','bio',
         -- unidades
         'mcg','kcal','ppm','uig'
       )
  ) z;
$$;

COMMENT ON FUNCTION public.anvisa_tokens_insumo(text) IS
  'Tokens significativos do nome comercial, piso 3 caracteres. NAO remover '
  '"hcl", "citrato", "bisglicinato": o sal faz parte da identidade e do teor. '
  'Piso 4 descartava "cha" e fazia CHA VERDE casar com CAFE verde.';