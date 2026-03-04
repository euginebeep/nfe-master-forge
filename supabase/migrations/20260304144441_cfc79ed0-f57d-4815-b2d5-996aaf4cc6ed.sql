-- Add columns for 7-tab CAPA workflow
ALTER TABLE public.qc_desvios 
  ADD COLUMN IF NOT EXISTS fase_atual TEXT NOT NULL DEFAULT 'IDENTIFICACAO',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
  -- Contenção (Tab 2)
  ADD COLUMN IF NOT EXISTS contencao_descricao TEXT,
  ADD COLUMN IF NOT EXISTS contencao_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS contencao_data_inicio DATE,
  ADD COLUMN IF NOT EXISTS contencao_data_fim DATE,
  ADD COLUMN IF NOT EXISTS contencao_eficaz BOOLEAN,
  ADD COLUMN IF NOT EXISTS contencao_evidencias TEXT,
  -- RCA (Tab 3)
  ADD COLUMN IF NOT EXISTS rca_metodo TEXT DEFAULT 'ISHIKAWA',
  ADD COLUMN IF NOT EXISTS rca_descricao TEXT,
  ADD COLUMN IF NOT EXISTS rca_por_que_1 TEXT,
  ADD COLUMN IF NOT EXISTS rca_por_que_2 TEXT,
  ADD COLUMN IF NOT EXISTS rca_por_que_3 TEXT,
  ADD COLUMN IF NOT EXISTS rca_por_que_4 TEXT,
  ADD COLUMN IF NOT EXISTS rca_por_que_5 TEXT,
  ADD COLUMN IF NOT EXISTS rca_conclusao TEXT,
  -- Plano de Ação (Tab 4)
  ADD COLUMN IF NOT EXISTS plano_acoes JSONB DEFAULT '[]'::jsonb,
  -- Implementação (Tab 5)
  ADD COLUMN IF NOT EXISTS impl_observacoes TEXT,
  ADD COLUMN IF NOT EXISTS impl_data_inicio DATE,
  ADD COLUMN IF NOT EXISTS impl_data_fim DATE,
  ADD COLUMN IF NOT EXISTS impl_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS impl_evidencias TEXT,
  -- Verificação (Tab 6)
  ADD COLUMN IF NOT EXISTS verif_eficaz BOOLEAN,
  ADD COLUMN IF NOT EXISTS verif_metodo TEXT,
  ADD COLUMN IF NOT EXISTS verif_resultado TEXT,
  ADD COLUMN IF NOT EXISTS verif_data DATE,
  ADD COLUMN IF NOT EXISTS verif_responsavel TEXT,
  ADD COLUMN IF NOT EXISTS verif_evidencias TEXT,
  -- Encerramento (Tab 7)
  ADD COLUMN IF NOT EXISTS encerramento_aprovado_por TEXT,
  ADD COLUMN IF NOT EXISTS encerramento_data DATE,
  ADD COLUMN IF NOT EXISTS encerramento_observacoes TEXT,
  ADD COLUMN IF NOT EXISTS encerramento_licoes_aprendidas TEXT;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_qc_desvios_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS trg_qc_desvios_updated_at ON public.qc_desvios;
CREATE TRIGGER trg_qc_desvios_updated_at BEFORE UPDATE ON public.qc_desvios FOR EACH ROW EXECUTE FUNCTION public.update_qc_desvios_updated_at();