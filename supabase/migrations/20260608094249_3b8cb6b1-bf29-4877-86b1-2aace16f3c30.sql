-- ── ANUNCIANTES / PARCEIROS ──
CREATE TABLE IF NOT EXISTS public.brainx_parceiros (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nome         TEXT NOT NULL,
  segmento     TEXT NOT NULL
               CHECK (segmento IN (
                 'MATERIAS_PRIMAS','EMBALAGENS','LABORATORIO',
                 'CONSULTORIA_ANVISA','EQUIPAMENTOS','FINANCEIRO',
                 'LOGISTICA','OUTRO'
               )),
  site_url     TEXT,
  logo_url     TEXT,
  contato_nome TEXT,
  contato_email TEXT,
  contato_tel  TEXT,
  ativo        BOOLEAN DEFAULT true,
  criado_por   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- ── CRIATIVOS (imagens ou vídeos) ──
CREATE TABLE IF NOT EXISTS public.brainx_criativos (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parceiro_id   UUID REFERENCES public.brainx_parceiros(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  tipo          TEXT NOT NULL CHECK (tipo IN ('IMAGEM','VIDEO','GIF')),
  arquivo_url   TEXT NOT NULL,     -- URL do Storage Supabase
  url_destino   TEXT NOT NULL,     -- Link ao clicar
  largura       INTEGER,           -- px
  altura        INTEGER,           -- px
  ativo         BOOLEAN DEFAULT true,
  data_inicio   DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim      DATE,
  criado_por    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── CAMPANHAS (agrupa criativos + define segmentação) ──
CREATE TABLE IF NOT EXISTS public.brainx_campanhas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parceiro_id UUID REFERENCES public.brainx_parceiros(id) ON DELETE CASCADE,
  criativo_id UUID REFERENCES public.brainx_criativos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  posicao TEXT NOT NULL DEFAULT 'DASHBOARD_LATERAL' CHECK (posicao IN (
    'DASHBOARD_LATERAL',
    'DASHBOARD_INFERIOR',
    'ANVISA_CHECKER',
    'PRODUCAO',
    'FORNECEDORES',
    'GLOBAL'
  )),
  segmentacao TEXT DEFAULT 'TODOS' CHECK (segmentacao IN (
    'TODOS','PLANO_MENSAL','PLANO_SEMESTRAL','PLANO_ANUAL','TRIAL'
  )),
  excluir_tenants UUID[],
  valor_mensal DECIMAL(10,2) DEFAULT 0,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  aprovado BOOLEAN DEFAULT false,
  aprovado_por UUID REFERENCES auth.users(id),
  aprovado_em TIMESTAMPTZ,
  total_impressoes INTEGER DEFAULT 0,
  total_cliques INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── MÉTRICAS ──
CREATE TABLE IF NOT EXISTS public.brainx_metricas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campanha_id UUID REFERENCES public.brainx_campanhas(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('IMPRESSAO','CLIQUE')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── OPT-OUT POR TENANT ──
CREATE TABLE IF NOT EXISTS public.brainx_optout (
  company_id UUID PRIMARY KEY REFERENCES public.company(id) ON DELETE CASCADE,
  optout_em TIMESTAMPTZ DEFAULT now(),
  motivo TEXT
);

-- ── ÍNDICES ──
CREATE INDEX IF NOT EXISTS idx_campanhas_ativas ON public.brainx_campanhas(ativo, aprovado, data_inicio, data_fim);
CREATE INDEX IF NOT EXISTS idx_metricas_campanha ON public.brainx_metricas(campanha_id, tipo, created_at);

-- ── RLS ──
ALTER TABLE public.brainx_parceiros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainx_criativos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainx_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainx_metricas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brainx_optout ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brainx_parceiros TO authenticated;
GRANT ALL ON public.brainx_parceiros TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brainx_criativos TO authenticated;
GRANT ALL ON public.brainx_criativos TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brainx_campanhas TO authenticated;
GRANT ALL ON public.brainx_campanhas TO service_role;

GRANT SELECT, INSERT ON public.brainx_metricas TO authenticated;
GRANT ALL ON public.brainx_metricas TO service_role;

GRANT SELECT, INSERT, DELETE ON public.brainx_optout TO authenticated;
GRANT ALL ON public.brainx_optout TO service_role;

-- Políticas
CREATE POLICY "saas_staff_parceiros" ON public.brainx_parceiros FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','saas_owner','saas_suporte','saas_financeiro')));
CREATE POLICY "saas_staff_criativos" ON public.brainx_criativos FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','saas_owner','saas_suporte','saas_financeiro')));
CREATE POLICY "saas_staff_campanhas" ON public.brainx_campanhas FOR ALL TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','saas_owner','saas_suporte','saas_financeiro')));
CREATE POLICY "saas_staff_ver_metricas" ON public.brainx_metricas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','saas_owner','saas_suporte','saas_financeiro')));
CREATE POLICY "authenticated_insert_metrica" ON public.brainx_metricas FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tenant_optout" ON public.brainx_optout FOR ALL TO authenticated USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "saas_ver_optout" ON public.brainx_optout FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','saas_owner','saas_suporte','saas_financeiro')));

-- ── FUNÇÕES RPC ──
CREATE OR REPLACE FUNCTION public.increment_cliques(campanha_uuid UUID) RETURNS void AS $$
BEGIN
  UPDATE public.brainx_campanhas
  SET total_cliques = total_cliques + 1, updated_at = now()
  WHERE id = campanha_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_impressoes(campanha_uuid UUID) RETURNS void AS $$
BEGIN
  UPDATE public.brainx_campanhas
  SET total_impressoes = total_impressoes + 1, updated_at = now()
  WHERE id = campanha_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
