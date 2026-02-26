
-- Expandir notas_saida com campos necessários para emissão via Nuvem Fiscal
ALTER TABLE public.notas_saida 
  ADD COLUMN IF NOT EXISTS modelo TEXT DEFAULT '55',
  ADD COLUMN IF NOT EXISTS finalidade TEXT DEFAULT '1',
  ADD COLUMN IF NOT EXISTS tipo_operacao TEXT DEFAULT '1',
  ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT,
  ADD COLUMN IF NOT EXISTS nuvem_fiscal_id TEXT,
  ADD COLUMN IF NOT EXISTS nuvem_fiscal_status TEXT,
  ADD COLUMN IF NOT EXISTS ambiente TEXT DEFAULT 'homologacao',
  ADD COLUMN IF NOT EXISTS motivo_cancelamento TEXT,
  ADD COLUMN IF NOT EXISTS data_cancelamento TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS danfe_url TEXT,
  ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_frete NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_seguro NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_outras_despesas NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_produtos NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modalidade_frete TEXT DEFAULT '9',
  ADD COLUMN IF NOT EXISTS transportadora_id UUID REFERENCES entidades(id),
  ADD COLUMN IF NOT EXISTS placa_veiculo TEXT,
  ADD COLUMN IF NOT EXISTS volumes_quantidade INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volumes_especie TEXT,
  ADD COLUMN IF NOT EXISTS volumes_peso_bruto NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS volumes_peso_liquido NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS forma_pagamento TEXT DEFAULT '0',
  ADD COLUMN IF NOT EXISTS meio_pagamento TEXT DEFAULT '01',
  ADD COLUMN IF NOT EXISTS condicao_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Expandir notas_saida_itens com campos fiscais completos
ALTER TABLE public.notas_saida_itens
  ADD COLUMN IF NOT EXISTS numero_item INTEGER,
  ADD COLUMN IF NOT EXISTS ean TEXT,
  ADD COLUMN IF NOT EXISTS cest TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT '0',
  ADD COLUMN IF NOT EXISTS cst_icms TEXT DEFAULT '00',
  ADD COLUMN IF NOT EXISTS base_icms NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cst_pis TEXT DEFAULT '01',
  ADD COLUMN IF NOT EXISTS base_pis NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cst_cofins TEXT DEFAULT '01',
  ADD COLUMN IF NOT EXISTS base_cofins NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ipi_aliquota NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ipi_valor NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS valor_desconto NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS informacoes_adicionais TEXT;

-- Trigger updated_at
CREATE OR REPLACE TRIGGER update_notas_saida_updated_at
  BEFORE UPDATE ON public.notas_saida
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
