-- Portao de emissao: um laudo nao pode nascer APROVADO se algum ativo nao foi
-- casado com a base de constituintes. Em vez de bloquear a emissao (o que
-- derrubaria o checker inteiro), rebaixa para VERIFICAR e grava o motivo.

CREATE OR REPLACE FUNCTION public.anvisa_ativo_reconhecido(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT lower(unaccent(nome_tecnico)) AS n FROM anvisa_constituintes WHERE ativo
      UNION ALL SELECT lower(unaccent(x)) FROM anvisa_constituintes, unnest(COALESCE(nome_popular,'{}')) x WHERE ativo
      UNION ALL SELECT lower(unaccent(x)) FROM anvisa_constituintes, unnest(COALESCE(sinonimos,'{}'))   x WHERE ativo
    ) b
    WHERE length(b.n) >= 4
      AND length(COALESCE(p_nome,'')) >= 3
      AND (b.n LIKE '%'||lower(unaccent(p_nome))||'%'
        OR lower(unaccent(p_nome)) LIKE '%'||b.n||'%')
  );
$$;

COMMENT ON FUNCTION public.anvisa_ativo_reconhecido(text) IS
  'Heuristica de nome com piso de 4 caracteres. Sinonimo curto ou vazio casa com '
  'tudo — por isso o piso. Retorno true NAO prova identidade: prova que ha candidato.';

CREATE OR REPLACE FUNCTION public.anvisa_laudo_gate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_sem_key int := 0; v_ausentes text[] := ARRAY[]::text[];
  v_ativo jsonb; v_motivos text[] := ARRAY[]::text[];
BEGIN
  IF jsonb_typeof(NEW.resultado_ia->'ativos') = 'array' THEN
    FOR v_ativo IN SELECT jsonb_array_elements(NEW.resultado_ia->'ativos') LOOP
      IF COALESCE(v_ativo->>'key','') = '' THEN v_sem_key := v_sem_key + 1; END IF;
      IF NOT anvisa_ativo_reconhecido(v_ativo->>'nome') THEN
        v_ausentes := array_append(v_ausentes, v_ativo->>'nome');
      END IF;
    END LOOP;
  END IF;

  IF v_sem_key > 0 THEN
    v_motivos := array_append(v_motivos,
      v_sem_key || ' ativo(s) sem vinculo a constituinte (key vazia)');
  END IF;
  IF array_length(v_ausentes,1) > 0 THEN
    v_motivos := array_append(v_motivos,
      'nao localizado(s) na base de autorizados: ' || array_to_string(v_ausentes,', '));
  END IF;
  IF NEW.rt_nome IS NULL OR btrim(NEW.rt_nome) = '' THEN
    v_motivos := array_append(v_motivos, 'sem RT nominada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM anvisa_alegacoes_detalhadas LIMIT 1)
     AND jsonb_typeof(NEW.resultado_ia->'alegacoes_permitidas') = 'array'
     AND jsonb_array_length(NEW.resultado_ia->'alegacoes_permitidas') > 0 THEN
    v_motivos := array_append(v_motivos,
      'alegacoes declaradas sem origem em anvisa_alegacoes_detalhadas (base vazia)');
  END IF;

  IF array_length(v_motivos,1) > 0 THEN
    IF NEW.status_geral ILIKE 'APROVADO%' THEN
      NEW.status_geral := 'VERIFICAR';
    END IF;
    NEW.status_validacao   := 'PRELIMINAR';
    NEW.invalidado_motivo  := 'Rebaixado automaticamente na emissao: '
                              || array_to_string(v_motivos, ' ; ');
  END IF;

  NEW.emitido_em := COALESCE(NEW.emitido_em, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anvisa_laudo_gate ON public.anvisa_laudos;
CREATE TRIGGER trg_anvisa_laudo_gate
  BEFORE INSERT ON public.anvisa_laudos
  FOR EACH ROW EXECUTE FUNCTION public.anvisa_laudo_gate();