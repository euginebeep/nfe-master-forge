-- Separa o conceito de "ativo para monitoramento" (controlado manualmente
-- pelo usuário no ERP) do status real de conectividade do dispositivo no
-- eWeLink (controlado automaticamente pelo cron de sincronização).
--
-- Antes: o cron sobrescrevia a coluna `ativo` com o status online/offline
-- do eWeLink a cada sincronização, anulando o toggle manual do usuário no
-- ERP (se o usuário desativasse um sensor manualmente, o cron reativava
-- sozinho assim que o dispositivo voltasse a ficar online no eWeLink).

ALTER TABLE public.ambiental_sensores
  ADD COLUMN IF NOT EXISTS ewelink_online BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.ambiental_sensores.ativo IS
  'Controle manual do usuário no ERP: define se o sensor deve ser monitorado. NUNCA sobrescrito automaticamente pelo cron.';

COMMENT ON COLUMN public.ambiental_sensores.ewelink_online IS
  'Status de conectividade reportado pela API do eWeLink (online/offline). Atualizado automaticamente pelo cron, somente leitura no ERP.';

-- Inicializa ewelink_online com o valor atual de ativo (melhor aproximação
-- disponível no momento da migração, será corrigido no próximo ciclo do cron)
UPDATE public.ambiental_sensores
  SET ewelink_online = ativo
  WHERE ewelink_online IS NULL;
