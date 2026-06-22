-- ============================================================
-- BRAINX ERP — eWeLink Auto-Sync Cron Job
-- Executa a cada 5 minutos para:
--   1. Auto-descobrir novos sensores adicionados na conta eWeLink
--   2. Coletar leituras de temperatura e umidade de todos os sensores
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remover job anterior se existir
DO $$
BEGIN
  PERFORM cron.unschedule('ewelink-auto-sync');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Registrar novo cron job: a cada 5 minutos
SELECT cron.schedule(
  'ewelink-auto-sync',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://cqkvekdrifmvedvpjmjr.supabase.co/functions/v1/ewelink-cron',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := jsonb_build_object('trigger', 'cron', 'ts', extract(epoch from now())::text)
  );
  $$
);
