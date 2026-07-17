-- ============================================================================
-- VERSIONAMENTO: anvisa_ingredientes_nao_autorizados + buscar_ingrediente_nao_autorizado
-- Já existe em produção. Idempotente. Seed da maca peruana com ON CONFLICT.
-- Match por palavra inteira (não casa "maca" com "macadamia").
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.anvisa_ingredientes_nao_autorizados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  nome_cientifico text,
  sinonimos text[] NOT NULL DEFAULT '{}',
  status text NOT NULL
    CHECK (status IN ('NAO_LISTADO', 'SOB_FISCALIZACAO', 'PROIBIDO_RE')),
  explicacao text NOT NULL,
  base_legal text,
  fonte_url text,
  confirmado_rt boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS anvisa_ingredientes_nao_autorizados_nome_uidx
  ON public.anvisa_ingredientes_nao_autorizados (lower(nome));

CREATE INDEX IF NOT EXISTS anvisa_ingredientes_nao_autorizados_sinonimos_gin
  ON public.anvisa_ingredientes_nao_autorizados USING gin (sinonimos);

ALTER TABLE public.anvisa_ingredientes_nao_autorizados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_ingredientes_nao_autorizados_auth" ON public.anvisa_ingredientes_nao_autorizados;
DROP POLICY IF EXISTS "service_ingredientes_nao_autorizados" ON public.anvisa_ingredientes_nao_autorizados;
-- Leitura direta bloqueada para anon/authenticated; uso via RPC SECURITY DEFINER
CREATE POLICY "service_ingredientes_nao_autorizados"
  ON public.anvisa_ingredientes_nao_autorizados
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.anvisa_ingredientes_nao_autorizados IS
  'Ingredientes NÃO autorizados / sob fiscalização (fora da lista positiva IN 28). Explicação exibida como está — sem reescrita por IA.';

-- Busca: termo casa como palavra inteira no nome, OU igualdade em sinônimo/nome científico
CREATE OR REPLACE FUNCTION public.buscar_ingrediente_nao_autorizado(p_termo text)
RETURNS TABLE (
  nome text,
  nome_cientifico text,
  status text,
  explicacao text,
  base_legal text,
  fonte_url text,
  confirmado_rt boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  t_escaped text;
BEGIN
  t := lower(unaccent(trim(coalesce(p_termo, ''))));
  t := regexp_replace(t, '\s+', ' ', 'g');
  IF t IS NULL OR length(t) < 2 THEN
    RETURN;
  END IF;

  -- Escape para uso em regex de palavra inteira
  t_escaped := regexp_replace(t, '([\.\\\+\*\?\^\$\(\)\[\]\{\}\|])', E'\\\\\\1', 'g');

  RETURN QUERY
  SELECT
    i.nome,
    i.nome_cientifico,
    i.status,
    i.explicacao,
    i.base_legal,
    i.fonte_url,
    i.confirmado_rt
  FROM public.anvisa_ingredientes_nao_autorizados i
  WHERE coalesce(i.ativo, true) IS TRUE
    AND (
      -- palavra inteira no nome (ex.: "maca" ∈ "maca peruana"; NÃO ∈ "macadamia")
      lower(unaccent(i.nome)) ~ ('(^|[^a-z0-9])' || t_escaped || '([^a-z0-9]|$)')
      -- nome científico: igualdade normalizada (termo completo)
      OR lower(unaccent(coalesce(i.nome_cientifico, ''))) = t
      -- sinônimo: igualdade normalizada (não substring solta)
      OR EXISTS (
        SELECT 1
        FROM unnest(coalesce(i.sinonimos, '{}'::text[])) AS s(val)
        WHERE lower(unaccent(s.val)) = t
      )
    )
  ORDER BY
    CASE i.status
      WHEN 'PROIBIDO_RE' THEN 0
      WHEN 'SOB_FISCALIZACAO' THEN 1
      ELSE 2
    END,
    i.nome
  LIMIT 5;
END;
$$;

GRANT EXECUTE ON FUNCTION public.buscar_ingrediente_nao_autorizado(text)
  TO authenticated, service_role, anon;

COMMENT ON FUNCTION public.buscar_ingrediente_nao_autorizado(text) IS
  'Busca ingredientes não autorizados por palavra inteira no nome / igualdade em sinônimo ou nome científico.';

-- Seed maca peruana (já em produção — ON CONFLICT no nome normalizado)
INSERT INTO public.anvisa_ingredientes_nao_autorizados (
  nome,
  nome_cientifico,
  sinonimos,
  status,
  explicacao,
  base_legal,
  fonte_url,
  confirmado_rt,
  ativo
)
VALUES (
  'maca peruana',
  'Lepidium meyenii',
  ARRAY['maca peruana', 'ginseng peruano', 'lepidium meyenii'],
  'SOB_FISCALIZACAO',
  'A maca peruana (Lepidium meyenii) NÃO consta na lista de constituintes autorizados da IN 28/2018 para suplementos alimentares em cápsulas. Ingredientes vegetais só podem ser usados em suplementos se expressamente autorizados pela ANVISA. A ANVISA fiscaliza e já proibiu marcas de maca peruana (2025) por irregularidade. NÃO usar em fórmula de suplemento sem autorização específica. Consulte a RT antes de qualquer uso.',
  'RDC 243/2018 (listas positivas); ausente da IN 28/2018',
  'https://www.colorandinafoods.com.br/blog/maca-peruana-em-capsulas-e-permitida-no-brasil-entendimento-oficial-da-anvisa/',
  false,
  true
)
ON CONFLICT DO NOTHING;

-- Upsert por nome se o unique index impedir o DO NOTHING genérico
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.anvisa_ingredientes_nao_autorizados
    WHERE lower(unaccent(nome)) = lower(unaccent('maca peruana'))
  ) THEN
    INSERT INTO public.anvisa_ingredientes_nao_autorizados (
      nome, nome_cientifico, sinonimos, status, explicacao, base_legal, fonte_url, confirmado_rt
    ) VALUES (
      'maca peruana',
      'Lepidium meyenii',
      ARRAY['maca peruana', 'ginseng peruano', 'lepidium meyenii'],
      'SOB_FISCALIZACAO',
      'A maca peruana (Lepidium meyenii) NÃO consta na lista de constituintes autorizados da IN 28/2018 para suplementos alimentares em cápsulas. Ingredientes vegetais só podem ser usados em suplementos se expressamente autorizados pela ANVISA. A ANVISA fiscaliza e já proibiu marcas de maca peruana (2025) por irregularidade. NÃO usar em fórmula de suplemento sem autorização específica. Consulte a RT antes de qualquer uso.',
      'RDC 243/2018 (listas positivas); ausente da IN 28/2018',
      'https://www.colorandinafoods.com.br/blog/maca-peruana-em-capsulas-e-permitida-no-brasil-entendimento-oficial-da-anvisa/',
      false
    );
  END IF;
END $$;
