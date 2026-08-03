-- ERRO RECORRENTE: escrever literal de status sem ler o dominio da coluna.
-- Caso de 02/08/2026: filtrei status_revisao <> 'revisado' a sessao inteira.
-- O dominio e PENDENTE|APROVADO|DESCARTADO — 'revisado' nunca existiu, entao o
-- filtro NUNCA excluia nada e todos os numeros de "pendentes" sairam inflados.
-- Pior que erro de sintaxe: nao levanta excecao, devolve resultado plausivel.
--
-- Correcao estrutural: catalogo consultavel + funcao de validacao. Literal de
-- coluna enumerada nao se escreve de memoria, se consulta.

CREATE OR REPLACE FUNCTION public.dominio_de(p_tabela text, p_coluna text)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_def text; v_vals text[]; v_enum text;
BEGIN
  -- 1. coluna com tipo ENUM
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

  -- 2. CHECK com lista de literais
  SELECT pg_get_constraintdef(con.oid) INTO v_def
    FROM pg_constraint con
   WHERE con.conrelid = (quote_ident(p_tabela))::regclass
     AND con.contype='c'
     AND pg_get_constraintdef(con.oid) ILIKE '%'||p_coluna||'%'
     AND pg_get_constraintdef(con.oid) ILIKE '%ANY%'
   LIMIT 1;
  IF v_def IS NULL THEN RETURN NULL; END IF;

  SELECT array_agg(m[1]) INTO v_vals
    FROM regexp_matches(v_def, '''([^'']+)''::text', 'g') AS m;
  RETURN v_vals;
END; $$;

COMMENT ON FUNCTION public.dominio_de(text,text) IS
  'Valores aceitos por coluna enumerada (ENUM ou CHECK ... IN). Consultar SEMPRE '
  'antes de escrever literal de status em WHERE, INSERT ou filtro de aplicacao. '
  'Retorno NULL = coluna sem dominio declarado, texto livre.';

CREATE OR REPLACE VIEW public.v_dominios_enumerados AS
SELECT c.table_name AS tabela, c.column_name AS coluna,
       CASE WHEN t.typtype='e' THEN 'enum:'||t.typname ELSE 'check' END AS origem,
       dominio_de(c.table_name, c.column_name) AS valores_aceitos
FROM information_schema.columns c
LEFT JOIN pg_type t ON t.typname = c.udt_name
WHERE c.table_schema='public'
  AND dominio_de(c.table_name, c.column_name) IS NOT NULL;

COMMENT ON VIEW public.v_dominios_enumerados IS
  'Mapa de vocabulario do banco. Antes de filtrar por status/tipo/situacao em '
  'qualquer camada, olhe aqui. Literal inventado nao levanta erro: devolve '
  'resultado plausivel e errado.';

-- Guarda ativa: falha alto se alguem usar valor fora do dominio.
CREATE OR REPLACE FUNCTION public.exigir_dominio(p_tabela text, p_coluna text, p_valor text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_vals text[];
BEGIN
  v_vals := dominio_de(p_tabela, p_coluna);
  IF v_vals IS NULL THEN RETURN p_valor; END IF;
  IF NOT (p_valor = ANY(v_vals)) THEN
    RAISE EXCEPTION 'dominio: "%" nao e valor valido de %.%. Aceitos: %',
      p_valor, p_tabela, p_coluna, array_to_string(v_vals, ', ');
  END IF;
  RETURN p_valor;
END; $$;

COMMENT ON FUNCTION public.exigir_dominio(text,text,text) IS
  'Envolver literal de status em consulta critica: exigir_dominio(''t'',''c'',''X''). '
  'Transforma filtro silenciosamente vazio em excecao com a lista de aceitos.';