ALTER TABLE public.ordens_producao_industrial 
  ADD COLUMN IF NOT EXISTS volume_util_max_l numeric,
  ADD COLUMN IF NOT EXISTS fator_enchimento_alvo numeric,
  ADD COLUMN IF NOT EXISTS densidade_utilizada_kg_l numeric,
  ADD COLUMN IF NOT EXISTS volume_total_po_l numeric,
  ADD COLUMN IF NOT EXISTS volume_por_batelada_l numeric,
  ADD COLUMN IF NOT EXISTS fator_enchimento_real numeric;

COMMENT ON COLUMN public.ordens_producao_industrial.volume_util_max_l IS 'Capacidade útil máxima do equipamento em litros no momento da criação';
COMMENT ON COLUMN public.ordens_producao_industrial.fator_enchimento_alvo IS 'Fator de enchimento definido pelo usuário ou padrão do equipamento';
COMMENT ON COLUMN public.ordens_producao_industrial.densidade_utilizada_kg_l IS 'Densidade aparente da fórmula (kg/L) usada no cálculo';