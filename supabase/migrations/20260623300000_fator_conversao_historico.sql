-- ============================================================
-- Migração: Histórico de Fator de Conversão Global
-- Data: 2026-06-23
-- Objetivo: Rastrear todas as conversões de unidades por fornecedor/item
--           e sugerir automaticamente na próxima importação
-- ============================================================

-- 1. Tabela principal: fator_conversao_historico
-- Registra cada conversão usada durante importação de NF-e
CREATE TABLE IF NOT EXISTS public.fator_conversao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  fornecedor_id uuid NOT NULL REFERENCES public.entidades(id),
  item_id uuid NOT NULL REFERENCES public.itens(id),
  
  -- Conversão utilizada
  unidade_origem varchar(20) NOT NULL,        -- kg, L, unidade, etc (do XML)
  unidade_destino varchar(20) NOT NULL,       -- g, ml, unidade, etc (seu sistema)
  fator_conversao numeric(12,4) NOT NULL,     -- 1000, 0.001, etc
  
  -- Contexto da importação
  nfe_numero varchar(50),                     -- Número da NF-e
  nfe_serie varchar(10),                      -- Série da NF-e
  quantidade_xml numeric(12,4),               -- Qtd do XML
  quantidade_interna numeric(12,4),           -- Qtd convertida
  
  -- Custo e financeiro
  custo_unitario_xml numeric(12,4),           -- Custo/un do XML
  custo_unitario_convertido numeric(12,4),    -- Custo/un após conversão
  
  -- Origem da sugestão
  origem varchar(50) NOT NULL DEFAULT 'manual',  -- 'sugestao' ou 'manual' ou 'ajustado'
  usuario_id uuid REFERENCES auth.users(id),
  
  -- Auditoria
  criado_em timestamp with time zone DEFAULT now(),
  atualizado_em timestamp with time zone DEFAULT now(),
  
  CONSTRAINT fk_fator_conversao_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES public.entidades(id),
  CONSTRAINT fk_fator_conversao_item FOREIGN KEY (item_id) REFERENCES public.itens(id)
);

-- 2. Tabela de desvios: fator_conversao_desvios
-- Registra mudanças no fator de conversão (fornecedor mudou embalagem, etc)
CREATE TABLE IF NOT EXISTS public.fator_conversao_desvios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  fornecedor_id uuid NOT NULL REFERENCES public.entidades(id),
  item_id uuid NOT NULL REFERENCES public.itens(id),
  
  -- Valores anterior e novo
  fator_anterior numeric(12,4) NOT NULL,
  fator_novo numeric(12,4) NOT NULL,
  variacao_percentual numeric(6,2),           -- Calculado: ((novo-anterior)/anterior)*100
  
  -- Motivo do desvio
  motivo_desvio text,                         -- "Fornecedor mudou embalagem", etc
  usuario_id uuid REFERENCES auth.users(id),
  
  -- Auditoria
  detectado_em timestamp with time zone DEFAULT now(),
  confirmado_em timestamp with time zone,
  confirmado_por uuid REFERENCES auth.users(id),
  
  CONSTRAINT fk_desvio_fornecedor FOREIGN KEY (fornecedor_id) REFERENCES public.entidades(id),
  CONSTRAINT fk_desvio_item FOREIGN KEY (item_id) REFERENCES public.itens(id)
);

-- 3. Tabela de padrões: fator_conversao_padrao
-- Armazena o fator "padrão" para cada fornecedor/item (para sugestões)
CREATE TABLE IF NOT EXISTS public.fator_conversao_padrao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  fornecedor_id uuid NOT NULL REFERENCES public.entidades(id),
  item_id uuid NOT NULL REFERENCES public.itens(id),
  
  -- Fator padrão (mais usado historicamente)
  fator_conversao numeric(12,4) NOT NULL,
  unidade_origem varchar(20) NOT NULL,
  unidade_destino varchar(20) NOT NULL,
  
  -- Confiança da sugestão
  vezes_usado integer DEFAULT 1,              -- Quantas vezes foi usado
  taxa_aceitacao numeric(5,2) DEFAULT 100,   -- % de aceitação (0-100)
  
  -- Auditoria
  criado_em timestamp with time zone DEFAULT now(),
  atualizado_em timestamp with time zone DEFAULT now(),
  
  UNIQUE(company_id, fornecedor_id, item_id)
);

-- 4. Índices para performance
CREATE INDEX IF NOT EXISTS idx_fator_historico_company_id
  ON public.fator_conversao_historico(company_id);

CREATE INDEX IF NOT EXISTS idx_fator_historico_fornecedor_id
  ON public.fator_conversao_historico(fornecedor_id);

CREATE INDEX IF NOT EXISTS idx_fator_historico_item_id
  ON public.fator_conversao_historico(item_id);

CREATE INDEX IF NOT EXISTS idx_fator_historico_criado_em
  ON public.fator_conversao_historico(criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_fator_desvios_company_id
  ON public.fator_conversao_desvios(company_id);

CREATE INDEX IF NOT EXISTS idx_fator_desvios_fornecedor_id
  ON public.fator_conversao_desvios(fornecedor_id);

CREATE INDEX IF NOT EXISTS idx_fator_desvios_detectado_em
  ON public.fator_conversao_desvios(detectado_em DESC);

CREATE INDEX IF NOT EXISTS idx_fator_padrao_company_id
  ON public.fator_conversao_padrao(company_id);

CREATE INDEX IF NOT EXISTS idx_fator_padrao_fornecedor_item
  ON public.fator_conversao_padrao(fornecedor_id, item_id);

-- 5. RLS: fator_conversao_historico
ALTER TABLE public.fator_conversao_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t_fator_conversao_historico" ON public.fator_conversao_historico;
CREATE POLICY "t_fator_conversao_historico" ON public.fator_conversao_historico
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 6. RLS: fator_conversao_desvios
ALTER TABLE public.fator_conversao_desvios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t_fator_conversao_desvios" ON public.fator_conversao_desvios;
CREATE POLICY "t_fator_conversao_desvios" ON public.fator_conversao_desvios
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 7. RLS: fator_conversao_padrao
ALTER TABLE public.fator_conversao_padrao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t_fator_conversao_padrao" ON public.fator_conversao_padrao;
CREATE POLICY "t_fator_conversao_padrao" ON public.fator_conversao_padrao
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

-- 8. Função para calcular variação percentual em desvios
CREATE OR REPLACE FUNCTION public.calcular_variacao_desvio()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.fator_anterior > 0 THEN
    NEW.variacao_percentual := ((NEW.fator_novo - NEW.fator_anterior) / NEW.fator_anterior) * 100;
  END IF;
  RETURN NEW;
END;
$$;

-- 9. Trigger para calcular variação
DROP TRIGGER IF EXISTS trg_calcular_variacao_desvio ON public.fator_conversao_desvios;
CREATE TRIGGER trg_calcular_variacao_desvio
  BEFORE INSERT OR UPDATE ON public.fator_conversao_desvios
  FOR EACH ROW EXECUTE FUNCTION public.calcular_variacao_desvio();

-- 10. Função para atualizar timestamp
CREATE OR REPLACE FUNCTION public.atualizar_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em := now();
  RETURN NEW;
END;
$$;

-- 11. Triggers para timestamp
DROP TRIGGER IF EXISTS trg_atualizar_timestamp_historico ON public.fator_conversao_historico;
CREATE TRIGGER trg_atualizar_timestamp_historico
  BEFORE UPDATE ON public.fator_conversao_historico
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_timestamp();

DROP TRIGGER IF EXISTS trg_atualizar_timestamp_padrao ON public.fator_conversao_padrao;
CREATE TRIGGER trg_atualizar_timestamp_padrao
  BEFORE UPDATE ON public.fator_conversao_padrao
  FOR EACH ROW EXECUTE FUNCTION public.atualizar_timestamp();
