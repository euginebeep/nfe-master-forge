-- ORFAO = constituinte que a sincronizacao deixou de tocar porque sumiu do
-- painel do Power BI. Nao e o mesmo que desautorizado — pode ter sido renomeado
-- ou ter a cepa redesignada. Mas TAMBEM nao e "regular": ninguem confirmou.
-- Caso real: Lactobacillus rhamnosus GG (DSM 33156) sumiu do painel em 01/08 e
-- continuou ativo=true, status_normativo='regular'.

CREATE OR REPLACE VIEW public.v_anvisa_constituintes_orfaos AS
SELECT c.id, c.nome_tecnico, c.categoria, c.ativo, c.status_normativo,
       c.sincronizado_em,
       (SELECT max(sincronizado_em) FROM anvisa_constituintes) AS ultima_sync_global,
       date_part('day', (SELECT max(sincronizado_em) FROM anvisa_constituintes) - c.sincronizado_em)::int
         AS dias_sem_aparecer_no_painel
FROM anvisa_constituintes c
WHERE c.ativo
  AND c.sincronizado_em < (SELECT max(sincronizado_em) FROM anvisa_constituintes) - interval '2 days';

COMMENT ON VIEW public.v_anvisa_constituintes_orfaos IS
  'Constituintes que a sync parou de tocar: sumiram do painel do Power BI. '
  'Exigem decisao da RT — renomeado, cepa redesignada ou desautorizado? '
  'Ate a decisao, o motor os trata como PENDENTE_VERIFICACAO, nunca APROVADO.';

CREATE OR REPLACE FUNCTION public.anvisa_constituinte_orfao(p_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM v_anvisa_constituintes_orfaos o WHERE o.id = p_id);
$$;