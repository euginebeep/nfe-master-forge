-- ============================================================================
-- VERSIONAMENTO: coa_densidade_scan_pendentes + cron */30
-- Já em produção. Depende de pg_cron + pg_net e da edge coa-densidade-parser.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.coa_densidade_scan_pendentes()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_pendentes int;
  v_req_id bigint;
BEGIN
  SELECT count(DISTINCT ln.id) INTO v_pendentes
  FROM public.laudos_notas ln
  WHERE ln.nota_entrada_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.notas_entrada_itens nei
      JOIN public.estoque_lotes el ON el.nota_entrada_item_id = nei.id
      JOIN public.itens i ON i.id = el.item_id
      WHERE nei.nota_entrada_id = ln.nota_entrada_id
        AND (i.densidade_aparente IS NULL OR i.densidade_aparente = 0)
        AND i.descricao_interna NOT ILIKE 'CAPS%'
        AND NOT EXISTS (
          SELECT 1
          FROM public.qc_analises q
          WHERE q.item_id = i.id
            AND q.tipo_analise = 'COA_DENSIDADE'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM public.coa_densidade_processados p
          WHERE p.item_id = i.id
            AND p.nota_entrada_id = ln.nota_entrada_id
        )
    );

  IF v_pendentes = 0 THEN
    RETURN jsonb_build_object(
      'ok', true,
      'pendentes', 0,
      'acao', 'nada a fazer'
    );
  END IF;

  SELECT net.http_post(
    url := 'https://cqkvekdrifmvedvpjmjr.supabase.co/functions/v1/coa-densidade-parser',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"dry_run": false, "limit": 4, "offset": 0}'::jsonb,
    timeout_milliseconds := 55000
  ) INTO v_req_id;

  RETURN jsonb_build_object(
    'ok', true,
    'pendentes', v_pendentes,
    'acao', 'parser disparado',
    'request_id', v_req_id
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.coa_densidade_scan_pendentes()
  TO service_role;

-- Agendar a cada 30 min (idempotente)
SELECT cron.unschedule('coa-densidade-scan')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'coa-densidade-scan');

SELECT cron.schedule(
  'coa-densidade-scan',
  '*/30 * * * *',
  $$SELECT public.coa_densidade_scan_pendentes();$$
);

NOTIFY pgrst, 'reload schema';
