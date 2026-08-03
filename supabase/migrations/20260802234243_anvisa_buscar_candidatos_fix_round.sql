-- similarity() devolve real; round(double,int) nao existe. Cast para numeric.
CREATE OR REPLACE FUNCTION public.anvisa_buscar_candidatos(
  p_nome text, p_limite int DEFAULT 8)
RETURNS TABLE(constituinte_id uuid, nome_tecnico text, categoria text,
              fonte_de text, limite_19_mais text, limite_parse_status text,
              tokens_casados int, tokens_total int, score numeric, evidencia text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_toks text[];
BEGIN
  v_toks := anvisa_tokens_insumo(p_nome);
  IF v_toks IS NULL OR array_length(v_toks,1) = 0 THEN RETURN; END IF;

  RETURN QUERY
  WITH campos AS (
    SELECT c.id, c.nome_tecnico, c.categoria, c.fonte_de,
           c.limites_19_mais->>'texto' AS lim, c.limite_parse_status,
           lower(unaccent(c.nome_tecnico || ' ' ||
                 COALESCE(array_to_string(c.nome_popular,' '),'') || ' ' ||
                 COALESCE(array_to_string(c.sinonimos,' '),''))) AS campo_nome,
           lower(unaccent(COALESCE(c.fonte_de,''))) AS campo_fonte
      FROM anvisa_constituintes c WHERE c.ativo
  ), pont AS (
    SELECT f.*,
      (SELECT count(*) FROM unnest(v_toks) t WHERE f.campo_nome  LIKE '%'||t||'%') AS hit_nome,
      (SELECT count(*) FROM unnest(v_toks) t WHERE f.campo_fonte LIKE '%'||t||'%') AS hit_fonte,
      similarity(lower(unaccent(p_nome)), lower(unaccent(f.nome_tecnico)))::numeric AS trg
    FROM campos f
  )
  SELECT p.id, p.nome_tecnico, p.categoria, p.fonte_de, p.lim, p.limite_parse_status,
         GREATEST(p.hit_nome, p.hit_fonte)::int,
         array_length(v_toks,1),
         round((GREATEST(p.hit_nome,p.hit_fonte)::numeric / array_length(v_toks,1)) * 0.7
               + p.trg * 0.3, 3),
         CASE WHEN p.hit_nome > 0 AND p.hit_fonte > 0 THEN 'nome+fonte_de'
              WHEN p.hit_nome > 0 THEN 'nome/sinonimo'
              WHEN p.hit_fonte > 0 THEN 'fonte_de'
              ELSE 'similaridade' END
  FROM pont p
  WHERE p.hit_nome > 0 OR p.hit_fonte > 0 OR p.trg > 0.45
  ORDER BY 9 DESC, length(p.nome_tecnico)
  LIMIT p_limite;
END; $$;