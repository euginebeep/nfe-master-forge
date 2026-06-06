ALTER TABLE ordens_producao_industrial
  ADD COLUMN IF NOT EXISTS volume_total_po_l numeric,
  ADD COLUMN IF NOT EXISTS volume_por_batelada_l numeric,
  ADD COLUMN IF NOT EXISTS fator_enchimento_real numeric;