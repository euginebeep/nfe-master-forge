CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('demo-daily-reset');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'demo-daily-reset',
  '0 7 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lvptvswvqjhvobdvgfws.supabase.co/functions/v1/seed-demo-data',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);