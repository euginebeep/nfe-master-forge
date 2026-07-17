-- ============================================================================
-- VERSIONAMENTO: match_legislacao_chunks (RAG Copilot)
-- Já existe em produção (cqkvekdrifmvedvpjmjr). NÃO reaplicar se já estiver lá —
-- CREATE OR REPLACE é idempotente. Objetivo: git = banco.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_legislacao_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  fonte_id uuid,
  referencia text,
  texto text,
  similaridade float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    lc.id,
    lc.fonte_id,
    lc.referencia,
    lc.texto,
    (1 - (lc.embedding <=> query_embedding))::float AS similaridade
  FROM public.legislacao_chunks lc
  WHERE lc.embedding IS NOT NULL
    AND 1 - (lc.embedding <=> query_embedding) > match_threshold
  ORDER BY lc.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_legislacao_chunks(vector, float, int)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.match_legislacao_chunks(vector, float, int) IS
  'Busca vetorial RAG sobre legislacao_chunks (cosine). Usada por legislacao-rag-search.';
