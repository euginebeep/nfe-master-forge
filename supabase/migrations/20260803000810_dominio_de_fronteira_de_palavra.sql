-- A v1 casava o nome da coluna com ILIKE '%coluna%' dentro do texto do CHECK.
-- Resultado: a coluna "id" casava dentro do literal 'CONSTITUINTE_REMOVIDO'
-- (REMOV-ID-O) e herdava o dominio da coluna "tipo".
-- Mesmo erro de substring que causou "Mel" dentro de "Bromelina" — desta vez
-- dentro da funcao criada justamente para evitar erro. Fronteira de palavra.

CREATE OR REPLACE FUNCTION public.dominio_de(p_tabela text, p_coluna text)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_def text; v_vals text[]; v_enum text;
BEGIN
  SELECT t.typname INTO v_enum
    FROM information_schema.columns c
    JOIN pg_type t ON t.typname = c.udt_name
   WHERE c.table_schema='public' AND c.table_name=p_tabela AND c.column_name=p_coluna
     AND t.typtype='e';
  IF v_enum IS NOT NULL THEN
    SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder) INTO v_vals
      FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=v_enum;
    RETURN v_vals;
  END IF;

  -- Casa o nome da coluna como IDENTIFICADOR, nao como substring: o CHECK
  -- referencia a coluna na forma  (coluna = ANY  ou  ((coluna)::text = ANY
  SELECT pg_get_constraintdef(con.oid) INTO v_def
    FROM pg_constraint con
   WHERE con.conrelid = (quote_ident(p_tabela))::regclass
     AND con.contype = 'c'
     AND con.conkey = ARRAY[(SELECT a.attnum FROM pg_attribute a
                              WHERE a.attrelid = con.conrelid
                                AND a.attname = p_coluna)]
     AND pg_get_constraintdef(con.oid) ILIKE '%ANY%'
   LIMIT 1;
  IF v_def IS NULL THEN RETURN NULL; END IF;

  SELECT array_agg(m[1]) INTO v_vals
    FROM regexp_matches(v_def, '''([^'']+)''::text', 'g') AS m;
  RETURN v_vals;
END; $$;

COMMENT ON FUNCTION public.dominio_de(text,text) IS
  'Valores aceitos por coluna enumerada (ENUM ou CHECK ... IN). Casa a coluna '
  'por conkey, nao por substring do texto do CHECK: a v1 fazia ILIKE e a coluna '
  '"id" herdava dominio de "tipo" por casar dentro de CONSTITUINTE_REMOV-ID-O. '
  'Consultar SEMPRE antes de escrever literal de status.';