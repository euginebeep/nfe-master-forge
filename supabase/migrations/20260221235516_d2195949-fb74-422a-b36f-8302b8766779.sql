
-- Adicionar colunas de workflow de contrato na tabela orcamentos
ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS contrato_status text DEFAULT 'PENDENTE',
ADD COLUMN IF NOT EXISTS contrato_enviado_em timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contrato_enviado_via text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comprovante_pagamento_em timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS comprovante_pagamento_obs text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gerencia_aprovado_por uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gerencia_aprovado_em timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS gerencia_observacoes text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contrato_assinado_em timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contrato_conferido_por uuid DEFAULT NULL,
ADD COLUMN IF NOT EXISTS contrato_conferido_em timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS valor_limite_aprovacao_simples numeric DEFAULT 5000;
