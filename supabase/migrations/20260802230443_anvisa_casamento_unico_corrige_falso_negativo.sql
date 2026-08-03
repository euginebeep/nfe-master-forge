-- BUG CORRIGIDO 02/08/2026: anvisa_avaliar_ativo e anvisa_ativo_reconhecido
-- tinham logicas de casamento DIFERENTES. A primeira so procurava
-- "nome_tecnico contem o termo", faltando a direcao inversa. Efeito:
-- "BISGLICINATO DE MAGNESIO 10%" dava NAO_AUTORIZADO enquanto
-- "BISGLICINATO DE MAGNESIO" dava APROVAVEL_COM_CORRECAO — o nome comercial
-- do insumo (com teor, marca ou grau) reprovava constituinte autorizado.
-- Alem disso o '%' de "10%" virava curinga de LIKE.
-- A partir daqui existe UMA funcao de casamento. As duas a chamam.

CREATE OR REPLACE FUNCTION public.anvisa_casar_constituinte(p_nome text)
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid; v_n text;
BEGIN
  -- Escapa curingas de LIKE: '%' em "10%" e '_' em nomes tecnicos
  v_n := replace(replace(lower(unaccent(COALESCE(p_nome,''))), '%', '\%'), '_', '\_');
  IF length(v_n) < 3 THEN RETURN NULL; END IF;

  SELECT c.id INTO v_id FROM anvisa_constituintes c
   WHERE c.ativo AND (
        lower(unaccent(c.nome_tecnico)) = lower(unaccent(p_nome))
     -- constituinte contem o termo  ("Bisglicinato de magnesio" ~ "magnesio")
     OR lower(unaccent(c.nome_tecnico)) LIKE '%'||v_n||'%'
     -- termo contem o constituinte  ("BISGLICINATO DE MAGNESIO 10%" ~ "Bisglicinato de magnesio")
     OR v_n LIKE '%'||replace(replace(lower(unaccent(c.nome_tecnico)),'%','\%'),'_','\_')||'%'
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.nome_popular,'{}')) x WHERE length(x)>=4
                 AND (lower(unaccent(x)) LIKE '%'||v_n||'%'
                   OR v_n LIKE '%'||replace(replace(lower(unaccent(x)),'%','\%'),'_','\_')||'%'))
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(c.sinonimos,'{}')) x WHERE length(x)>=4
                 AND (lower(unaccent(x)) LIKE '%'||v_n||'%'
                   OR v_n LIKE '%'||replace(replace(lower(unaccent(x)),'%','\%'),'_','\_')||'%')))
   ORDER BY (lower(unaccent(c.nome_tecnico)) = lower(unaccent(p_nome))) DESC,
            length(c.nome_tecnico) DESC   -- prefere o nome mais especifico
   LIMIT 1;
  RETURN v_id;
END; $$;

COMMENT ON FUNCTION public.anvisa_casar_constituinte(text) IS
  'UNICA logica de casamento nome->constituinte. anvisa_avaliar_ativo e '
  'anvisa_ativo_reconhecido chamam esta. NAO duplicar a regra em outro lugar: '
  'foi exatamente a divergencia entre as duas que gerou falso NAO_AUTORIZADO.';

CREATE OR REPLACE FUNCTION public.anvisa_ativo_reconhecido(p_nome text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT anvisa_casar_constituinte(p_nome) IS NOT NULL;
$$;