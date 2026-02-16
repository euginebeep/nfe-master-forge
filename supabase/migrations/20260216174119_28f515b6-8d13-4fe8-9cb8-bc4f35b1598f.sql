
-- Enable pg_trgm for fuzzy/similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a fuzzy search function using trigram similarity
CREATE OR REPLACE FUNCTION public.buscar_constituinte_fuzzy(termo_busca text)
RETURNS TABLE(
  id uuid,
  nome_tecnico text,
  nome_generico text,
  nome_rotulo text,
  nome_popular text[],
  sinonimos text[],
  categoria text,
  subcategoria text,
  anexo_origem text,
  ativo boolean,
  is_proibido boolean,
  motivo_proibicao text,
  norma_inclusao text,
  norma_ultima_alteracao text,
  alegacoes text[],
  advertencias text[],
  restricoes_uso text,
  grupos_permitidos text[],
  grupos_nao_autorizados text[],
  cas_number text,
  fonte_de text,
  fonte_url text,
  data_inclusao text,
  rotulagem_complementar text[],
  referencias_especificacao text[],
  limites_19_mais jsonb,
  limites_gestantes jsonb,
  limites_lactantes jsonb,
  limites_0_6_meses jsonb,
  limites_7_11_meses jsonb,
  limites_1_3_anos jsonb,
  limites_4_8_anos jsonb,
  limites_9_18_anos jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  verificado_em timestamptz,
  sync_id uuid,
  search_vector tsvector,
  similaridade real
)
LANGUAGE plpgsql
AS $$
DECLARE
  termo_normalizado text;
BEGIN
  termo_normalizado := lower(unaccent(termo_busca));
  
  RETURN QUERY
  SELECT 
    c.id, c.nome_tecnico, c.nome_generico, c.nome_rotulo, c.nome_popular, 
    c.sinonimos, c.categoria, c.subcategoria, c.anexo_origem, c.ativo, 
    c.is_proibido, c.motivo_proibicao, c.norma_inclusao, c.norma_ultima_alteracao,
    c.alegacoes, c.advertencias, c.restricoes_uso, c.grupos_permitidos, 
    c.grupos_nao_autorizados, c.cas_number, c.fonte_de, c.fonte_url, 
    c.data_inclusao, c.rotulagem_complementar, c.referencias_especificacao,
    c.limites_19_mais, c.limites_gestantes, c.limites_lactantes, 
    c.limites_0_6_meses, c.limites_7_11_meses, c.limites_1_3_anos, 
    c.limites_4_8_anos, c.limites_9_18_anos, c.created_at, c.updated_at,
    c.verificado_em, c.sync_id, c.search_vector,
    GREATEST(
      similarity(lower(unaccent(c.nome_tecnico)), termo_normalizado),
      similarity(lower(unaccent(COALESCE(c.nome_generico, ''))), termo_normalizado),
      similarity(lower(unaccent(COALESCE(c.nome_rotulo, ''))), termo_normalizado)
    ) AS similaridade
  FROM public.anvisa_constituintes c
  WHERE 
    similarity(lower(unaccent(c.nome_tecnico)), termo_normalizado) > 0.15
    OR similarity(lower(unaccent(COALESCE(c.nome_generico, ''))), termo_normalizado) > 0.15
    OR similarity(lower(unaccent(COALESCE(c.nome_rotulo, ''))), termo_normalizado) > 0.15
    OR EXISTS (
      SELECT 1 FROM unnest(c.nome_popular) AS np
      WHERE similarity(lower(unaccent(np)), termo_normalizado) > 0.15
    )
    OR EXISTS (
      SELECT 1 FROM unnest(c.sinonimos) AS s
      WHERE similarity(lower(unaccent(s)), termo_normalizado) > 0.15
    )
  ORDER BY similaridade DESC
  LIMIT 20;
END;
$$;
