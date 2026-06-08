-- Corrigir parâmetros do V-Mixer 100L seedado 
-- e alinhar defaults da tabela com os valores industriais corretos

-- 1. Atualizar defaults da tabela 
ALTER TABLE public.equipamentos 
  ALTER COLUMN fator_enchimento_padrao SET DEFAULT 0.60, 
  ALTER COLUMN fator_enchimento_minimo SET DEFAULT 0.15, 
  ALTER COLUMN fator_enchimento_maximo SET DEFAULT 0.65, 
  ALTER COLUMN densidade_padrao_kg_l   SET DEFAULT 0.65;

-- 2. Corrigir o equipamento seedado (company_id IS NULL = global ou conforme o seed anterior)
UPDATE public.equipamentos 
SET 
  fator_enchimento_padrao            = 0.60, 
  fator_enchimento_minimo            = 0.15, 
  fator_enchimento_maximo            = 0.65, 
  capacidade_padrao_kg               = 39, 
  capacidade_minima_kg               = 10, 
  capacidade_maxima_kg               = 42, 
  capacidade_maxima_com_aprovacao_kg = 50, 
  densidade_padrao_kg_l              = 0.65, 
  observacoes                        = 'Misturador em V 100L. Fator enchimento 60% padrão (60L úteis). Limite máximo 65% (65L). Mínimo 15% (15L) para garantir homogeneidade da mistura. Densidade padrão de pós de suplementos: 0,65 kg/L.' 
WHERE nome = 'Misturador em V 100L';

-- 3. Comentários explicativos nas colunas 
COMMENT ON COLUMN public.equipamentos.fator_enchimento_padrao IS 'Fração do volume nominal usada no cálculo de bateladas. Ex: 0.60 = 60% de 100L = 60L úteis.'; 
COMMENT ON COLUMN public.equipamentos.fator_enchimento_maximo IS 'Limite máximo de segurança. Acima disso o sistema bloqueia a OP.'; 
COMMENT ON COLUMN public.equipamentos.fator_enchimento_minimo IS 'Abaixo deste volume há risco de heterogeneidade na mistura.'; 
COMMENT ON COLUMN public.equipamentos.densidade_padrao_kg_l IS 'Densidade aparente do pó em kg/L. Usado para converter peso → volume. Pós de suplementos: 0.50-0.80 kg/L.';