CREATE TABLE IF NOT EXISTS public.amostras_retencao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE NOT NULL,
  op_id uuid REFERENCES public.ordens_producao_industrial(id) ON DELETE SET NULL,
  lote_produto_acabado_id uuid REFERENCES public.lotes_produto_acabado(id) ON DELETE SET NULL,
  numero_lote text NOT NULL,
  produto_nome text NOT NULL,
  quantidade_retida integer NOT NULL DEFAULT 1,
  unidade text NOT NULL DEFAULT 'frasco',
  localizacao_fisica text,
  data_coleta date NOT NULL DEFAULT CURRENT_DATE,
  data_validade_produto date,
  data_descarte date,
  status text NOT NULL DEFAULT 'GUARDADA'
    CHECK (status IN ('GUARDADA','UTILIZADA_ANALISE','DESCARTADA')),
  responsavel_coleta text,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.amostras_retencao TO authenticated;
GRANT ALL ON public.amostras_retencao TO service_role;

ALTER TABLE public.amostras_retencao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_amostras" ON public.amostras_retencao
  FOR ALL
  TO authenticated
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE TRIGGER update_amostras_retencao_updated_at BEFORE UPDATE ON public.amostras_retencao FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();