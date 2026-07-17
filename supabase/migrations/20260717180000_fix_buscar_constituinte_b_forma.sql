-- ============================================================================
-- Fix: buscar_constituinte_por_nome_popular
-- - SECURITY DEFINER (leitura regulatória pública autenticada / service_role)
-- - extensions.unaccent (search_path restrito)
-- Relacionado ao bug B12: frontend filtrava por regex b1 ⊂ b12; RPC também
-- precisa ser estável sob search_path = public.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.buscar_constituinte_por_nome_popular(termo_busca text)
 RETURNS SETOF anvisa_constituintes
 LANGUAGE plpgsql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  RETURN QUERY
  SELECT c.*
  FROM public.anvisa_constituintes c
  WHERE c.ativo = TRUE AND (
    EXISTS (
      SELECT 1 FROM unnest(c.nome_popular) AS np
      WHERE lower(extensions.unaccent(np)) LIKE '%' || lower(extensions.unaccent(termo_busca)) || '%'
    )
    OR EXISTS (
      SELECT 1 FROM unnest(c.sinonimos) AS s
      WHERE lower(extensions.unaccent(s)) LIKE '%' || lower(extensions.unaccent(termo_busca)) || '%'
    )
  )
  LIMIT 20;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.buscar_constituinte_por_nome_popular(text)
  TO anon, authenticated, service_role;
