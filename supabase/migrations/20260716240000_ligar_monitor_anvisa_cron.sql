-- ============================================================================
-- Ligar monitoramento diário ANVISA (pg_cron 06h)
-- Premissa: só detecta e alerta — NUNCA publica/homologa sozinho.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- status_revisao nos alertas (além de lido) — RT marca "ciente"
ALTER TABLE public.anvisa_alertas_normativos
  ADD COLUMN IF NOT EXISTS status_revisao text
    CHECK (status_revisao IN ('PENDENTE', 'APROVADO', 'DESCARTADO'))
    DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS revisado_por uuid,
  ADD COLUMN IF NOT EXISTS revisado_em timestamptz,
  ADD COLUMN IF NOT EXISTS monitoramento_id uuid;

UPDATE public.anvisa_alertas_normativos
SET status_revisao = 'PENDENTE'
WHERE status_revisao IS NULL;

CREATE INDEX IF NOT EXISTS idx_anvisa_alertas_pendentes
  ON public.anvisa_alertas_normativos (status_revisao, critico DESC, created_at DESC);

-- RT pode marcar alerta como revisado/ciente
DROP POLICY IF EXISTS "Users can update alertas revisao" ON public.anvisa_alertas_normativos;
CREATE POLICY "Users can update alertas revisao" ON public.anvisa_alertas_normativos
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

-- Flag: constituinte homologado precisa reconfirmar após mudança de norma
ALTER TABLE public.anvisa_constituintes
  ADD COLUMN IF NOT EXISTS requer_rehomologacao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS requer_rehomologacao_motivo text,
  ADD COLUMN IF NOT EXISTS requer_rehomologacao_em timestamptz;

COMMENT ON COLUMN public.anvisa_constituintes.requer_rehomologacao IS
  'True quando o monitor detectou possível mudança de limite/norma. RT deve reconfirmar. Nunca auto-homologa.';

CREATE INDEX IF NOT EXISTS idx_anvisa_const_rehomologacao
  ON public.anvisa_constituintes (requer_rehomologacao)
  WHERE requer_rehomologacao IS TRUE;

-- Cron: 06:00 UTC diário (antes do powerbi-sync ~08h)
DO $$
BEGIN
  PERFORM cron.unschedule('anvisa-monitor-diario');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'anvisa-monitor-diario',
  '0 6 * * *',
  $$
  SELECT net.http_post(
    url     := 'https://cqkvekdrifmvedvpjmjr.supabase.co/functions/v1/monitor-anvisa-diario',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body    := jsonb_build_object('trigger', 'cron', 'ts', extract(epoch from now())::text)
  );
  $$
);
