CREATE TABLE IF NOT EXISTS public.pops (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE NOT NULL,
  codigo text NOT NULL,
  titulo text NOT NULL,
  categoria text NOT NULL CHECK (categoria IN (
    'A_HIGIENIZACAO','B_PRAGAS','C_AGUA','D_MANIPULADORES',
    'E_CALIBRACAO','F_TEMPERATURA','G_RECOLHIMENTO','H_MATERIAS_PRIMAS',
    'I_PESAGEM','J_CONTROLE_QUALIDADE','K_ROTULAGEM','L_AMOSTRA_RETENCAO','OUTRO'
  )),
  versao text NOT NULL DEFAULT '1.0',
  status text NOT NULL DEFAULT 'ATIVO'
    CHECK (status IN ('RASCUNHO','ATIVO','REVISAO','OBSOLETO')),
  frequencia text,
  responsavel_elaboracao text,
  responsavel_aprovacao text,
  data_elaboracao date,
  data_aprovacao date,
  data_proxima_revisao date,
  documento_url text,
  observacoes text,
  rt_id uuid REFERENCES public.responsaveis_tecnicos(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, codigo)
);

CREATE TABLE IF NOT EXISTS public.pop_registros_execucao (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.company(id) ON DELETE CASCADE NOT NULL,
  pop_id uuid REFERENCES public.pops(id) ON DELETE CASCADE NOT NULL,
  data_execucao timestamptz NOT NULL DEFAULT now(),
  executado_por text NOT NULL,
  resultado text NOT NULL CHECK (resultado IN ('CONFORME','NAO_CONFORME','PARCIALMENTE_CONFORME')),
  observacoes text,
  evidencia_url text,
  proxima_execucao date,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.pops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pop_registros_execucao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_pops" ON public.pops 
  FOR ALL TO authenticated 
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

CREATE POLICY "tenant_pop_registros" ON public.pop_registros_execucao 
  FOR ALL TO authenticated 
  USING (company_id = get_user_company_id())
  WITH CHECK (company_id = get_user_company_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pops TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pop_registros_execucao TO authenticated;

-- Inserir POPs padrão para o tenant que executar a migration (ou todos que não tiverem)
INSERT INTO public.pops (company_id, codigo, titulo, categoria, versao, frequencia, responsavel_elaboracao)
SELECT 
  c.id,
  v.codigo, v.titulo, v.categoria, '1.0', v.frequencia, 'RT'
FROM (VALUES
  ('POP-A-001','Higienização de equipamentos e utensílios','A_HIGIENIZACAO','Diária / a cada uso'),
  ('POP-B-001','Controle integrado de pragas','B_PRAGAS','Trimestral'),
  ('POP-C-001','Limpeza e análise do reservatório de água','C_AGUA','Semestral'),
  ('POP-D-001','Higiene e saúde dos manipuladores','D_MANIPULADORES','Anual / admissional'),
  ('POP-E-001','Calibração de balanças e equipamentos','E_CALIBRACAO','Conforme prazo INMETRO'),
  ('POP-F-001','Monitoramento de temperatura e umidade','F_TEMPERATURA','Contínuo'),
  ('POP-G-001','Recolhimento de produtos (recall)','G_RECOLHIMENTO','Quando necessário'),
  ('POP-H-001','Recebimento e aprovação de matérias-primas','H_MATERIAS_PRIMAS','A cada entrada'),
  ('POP-I-001','Pesagem e manipulação de ativos','I_PESAGEM','A cada OP'),
  ('POP-J-001','Controle de qualidade por lote','J_CONTROLE_QUALIDADE','A cada lote'),
  ('POP-K-001','Conferência de rotulagem','K_ROTULAGEM','A cada embalagem'),
  ('POP-L-001','Amostra de retenção por lote','L_AMOSTRA_RETENCAO','A cada lote')
) AS v(codigo, titulo, categoria, frequencia),
public.company c
ON CONFLICT (company_id, codigo) DO NOTHING;

CREATE TRIGGER update_pops_updated_at BEFORE UPDATE ON public.pops FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();