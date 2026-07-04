-- RPC para busca de insumos por similaridade (pg_trgm) no fluxo laudo → formulador
CREATE OR REPLACE FUNCTION public.buscar_insumos_similares(termo text, comp uuid)
RETURNS TABLE(id uuid, descricao_interna text, sim real)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    i.id,
    i.descricao_interna,
    similarity(i.descricao_interna, termo) AS sim
  FROM itens i
  WHERE i.company_id = comp
    AND i.ativo = true
    AND similarity(i.descricao_interna, termo) > 0.3
  ORDER BY sim DESC
  LIMIT 5;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_insumos_similares(text, uuid) TO authenticated;
