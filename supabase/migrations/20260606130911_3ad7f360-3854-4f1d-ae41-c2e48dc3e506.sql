ALTER TABLE public.itens
  ADD COLUMN IF NOT EXISTS numero_notificacao_anvisa text,
  ADD COLUMN IF NOT EXISTS data_notificacao_anvisa date,
  ADD COLUMN IF NOT EXISTS status_regulatorio text DEFAULT 'PENDENTE'
    CHECK (status_regulatorio IN ('NOTIFICADO','DISPENSADO','REGISTRADO','PENDENTE'));

COMMENT ON COLUMN public.itens.numero_notificacao_anvisa IS 'Número de notificação ANVISA conforme RDC 843/2024';
COMMENT ON COLUMN public.itens.data_notificacao_anvisa IS 'Data em que a notificação foi realizada';
COMMENT ON COLUMN public.itens.status_regulatorio IS 'Status regulatório do item frente à ANVISA';