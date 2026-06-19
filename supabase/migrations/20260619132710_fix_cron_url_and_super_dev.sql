-- =====================================================
-- FIX 1: Atualizar URL do cron job seed-demo-data
-- para o novo projeto Supabase (cqkvekdrifmvedvpjmjr)
-- =====================================================
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
    url := 'https://cqkvekdrifmvedvpjmjr.supabase.co/functions/v1/seed-demo-data',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := jsonb_build_object('trigger', 'cron')
  );
  $$
);

-- =====================================================
-- FIX 2: Adicionar fabiobr9999@gmail.com como Super Dev
-- (permite usar o Modo Fantasma)
-- =====================================================
INSERT INTO public.saas_super_devs (user_id, notes)
SELECT id, 'Fundador — acesso master'
FROM auth.users
WHERE email = 'fabiobr9999@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
