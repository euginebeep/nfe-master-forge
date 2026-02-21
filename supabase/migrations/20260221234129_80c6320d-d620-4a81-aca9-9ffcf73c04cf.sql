ALTER TABLE public.orcamentos 
ADD COLUMN IF NOT EXISTS forma_pagamento text DEFAULT NULL,
ADD COLUMN IF NOT EXISTS desconto_percentual numeric DEFAULT 0;