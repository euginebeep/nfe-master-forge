-- MIGRATION DE DADOS. As alteracoes abaixo foram aplicadas em 02/08/2026 por
-- execute_sql avulso e NAO estavam em migration nenhuma — sumiriam num db reset.
-- Tudo idempotente: pode rodar de novo sem efeito colateral.

-- ── 1. Invalidacao dos laudos historicos ──────────────────────────────
UPDATE public.anvisa_laudos
   SET status_validacao  = 'INVALIDADO',
       invalidado_em     = COALESCE(invalidado_em, now()),
       invalidado_por    = COALESCE(invalidado_por,'auditoria_conformidade_02ago2026'),
       invalidado_motivo = COALESCE(invalidado_motivo,
         'Emitido sem RT nominada e sem conferencia registrada em '
         || 'anvisa_conferencias_rt. Ativos nao casados com a base de constituintes '
         || '(campo key vazio) e alegacoes sem origem em anvisa_alegacoes_detalhadas '
         || '(tabela vazia). Documento nao tem valor probatorio. Reemitir apos correcao.')
 WHERE criado_em < '2026-08-02'::date
   AND status_validacao <> 'INVALIDADO';

-- ── 2. Cadeia completa de alteracoes da IN 211 ────────────────────────
-- Descoberta importante: a lista "Vigente com Alteracoes" do cabecalho do
-- DataLegis mostra so as 3-4 mais recentes. A cadeia real tem 12 normas.
-- Ver doutrina/02-fontes.md e 06-erros-e-padroes.md do brainx-anvisa-mcp.
INSERT INTO public.legislacao_fontes (tipo, numero, ano, titulo, categoria, status, data_publicacao, url_oficial)
SELECT v.tipo, v.numero, v.ano, v.titulo, 'ATUALIZACAO_IN211', 'VIGENTE', v.dt,
  'https://anvisalegis.datalegis.net/action/ActionDatalegis.php?acao=detalharAto&tipo=INM&numeroAto='
  || lpad(v.numero,8,'0') || '&seqAto=000&valorAno=' || v.ano
  || '&orgao=DC%2FANVISA%2FMS&nomeTitulo=codigos&cod_modulo=310&cod_menu=8542'
FROM (VALUES
 ('IN','407',2025,'Altera IN 211/2023 — Anexo IV, coadjuvantes','2025-11-21'::date),
 ('IN','395',2025,'Altera IN 211/2023 — Anexo III; internaliza GMC/MERCOSUL 14/2025','2025-08-26'::date),
 ('IN','393',2025,'Altera IN 211/2023 — Anexo III; internaliza GMC/MERCOSUL 15/2025','2025-08-15'::date),
 ('IN','356',2025,'Altera IN 211/2023 — dioxido de silicio INS 551 antiumectante em 22.0, max 20000 ppm','2025-04-01'::date),
 ('IN','306',2024,'Altera IN 211/2023 — internaliza GMC 47/2023','2024-01-01'::date),
 ('IN','297',2024,'Altera IN 211/2023 — funcao aromatizante/aroma','2024-05-02'::date),
 ('IN','295',2024,'Altera IN 211/2023 — funcao antiumectante/antiaglutinante','2024-05-02'::date),
 ('IN','286',2024,'Altera IN 211/2023 — sais emulsionantes; reestrutura categoria 01.2','2024-03-08'::date),
 ('IN','267',2023,'Altera IN 211/2023 — fosfatos na categoria 01.1.1','2023-12-11'::date)
) AS v(tipo,numero,ano,titulo,dt)
WHERE NOT EXISTS (SELECT 1 FROM public.legislacao_fontes f
  WHERE f.tipo=v.tipo AND f.numero=v.numero AND f.ano=v.ano);

-- ── 3. Vinculos sugeridos ─────────────────────────────────────────────
-- Nao inserimos linhas fixas: reexecutamos o gerador, que ja e idempotente
-- (ON CONFLICT DO NOTHING) e nunca grava status confirmado.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT company_id FROM public.formula_itens WHERE company_id IS NOT NULL
  LOOP
    PERFORM public.anvisa_sugerir_vinculos(r.company_id);
  END LOOP;
END $$;