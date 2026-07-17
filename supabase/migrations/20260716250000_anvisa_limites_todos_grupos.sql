-- RPC para a tela Consulta ANVISA: limites parseados por grupo (fonte única = anvisa_limite_por_grupo)

CREATE OR REPLACE FUNCTION public.anvisa_limites_todos_grupos(p_constituinte_id uuid)
RETURNS TABLE (
  grupo text,
  grupo_label text,
  limite_min numeric,
  limite_max numeric,
  unidade text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    g.grupo,
    g.label,
    l.limite_min,
    l.limite_max,
    l.unidade
  FROM (
    VALUES
      ('lactentes_0_6', '0–6 meses'),
      ('lactentes_7_11', '7–11 meses'),
      ('criancas_1_3', '1–3 anos'),
      ('criancas_4_8', '4–8 anos'),
      ('criancas_9_18', '9–18 anos'),
      ('adultos', '≥19 anos'),
      ('gestantes', 'Gestantes'),
      ('lactantes', 'Lactantes')
  ) AS g(grupo, label)
  LEFT JOIN LATERAL public.anvisa_limite_por_grupo(p_constituinte_id, g.grupo) AS l ON true;
$$;

GRANT EXECUTE ON FUNCTION public.anvisa_limites_todos_grupos(uuid) TO authenticated, service_role;
