-- Tabela de equipamentos da fábrica
CREATE TABLE IF NOT EXISTS public.equipamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.company(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'MISTURADOR_V',
  volume_nominal_litros NUMERIC(10,2),
  capacidade_padrao_kg NUMERIC(10,2) DEFAULT 40,
  capacidade_minima_kg NUMERIC(10,2) DEFAULT 15,
  capacidade_maxima_kg NUMERIC(10,2) DEFAULT 50,
  capacidade_maxima_com_aprovacao_kg NUMERIC(10,2) DEFAULT 50,
  fator_enchimento_padrao NUMERIC(5,4) DEFAULT 0.60,
  fator_enchimento_minimo NUMERIC(5,4) DEFAULT 0.50,
  fator_enchimento_maximo NUMERIC(5,4) DEFAULT 0.70,
  densidade_padrao_kg_l NUMERIC(6,4) DEFAULT 0.65,
  ativo BOOLEAN DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos TO authenticated;
GRANT ALL ON public.equipamentos TO service_role;

ALTER TABLE public.equipamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant select equipamentos"
  ON public.equipamentos FOR SELECT TO authenticated
  USING (company_id IS NULL OR company_id = public.get_user_company_id());

CREATE POLICY "Tenant insert equipamentos"
  ON public.equipamentos FOR INSERT TO authenticated
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

CREATE POLICY "Tenant update equipamentos"
  ON public.equipamentos FOR UPDATE TO authenticated
  USING (company_id IS NULL OR company_id = public.get_user_company_id())
  WITH CHECK (company_id IS NULL OR company_id = public.get_user_company_id());

CREATE POLICY "Tenant delete equipamentos"
  ON public.equipamentos FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE TRIGGER trg_equipamentos_updated_at
  BEFORE UPDATE ON public.equipamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: Misturador em V 100L padrão (global, sem company_id)
INSERT INTO public.equipamentos (nome, tipo, volume_nominal_litros, capacidade_padrao_kg, capacidade_minima_kg, capacidade_maxima_kg, fator_enchimento_padrao, densidade_padrao_kg_l)
SELECT 'Misturador em V 100L', 'MISTURADOR_V', 100, 40, 15, 50, 0.60, 0.65
WHERE NOT EXISTS (SELECT 1 FROM public.equipamentos WHERE nome = 'Misturador em V 100L' AND company_id IS NULL);

-- Colunas de batelada na OP
ALTER TABLE public.ordens_producao_industrial
  ADD COLUMN IF NOT EXISTS peso_total_mistura_kg NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS numero_bateladas INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS peso_por_batelada_kg NUMERIC(10,3),
  ADD COLUMN IF NOT EXISTS equipamento_id UUID REFERENCES public.equipamentos(id),
  ADD COLUMN IF NOT EXISTS alerta_batelada TEXT,
  ADD COLUMN IF NOT EXISTS white_label BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS rotulo_cliente_url TEXT,
  ADD COLUMN IF NOT EXISTS marca_cliente TEXT;

-- Colunas de densidade/enchimento na fórmula
ALTER TABLE public.formulas
  ADD COLUMN IF NOT EXISTS densidade_aparente_kg_l NUMERIC(6,4) DEFAULT 0.65,
  ADD COLUMN IF NOT EXISTS peso_enchimento_mg NUMERIC(10,2) DEFAULT 500;