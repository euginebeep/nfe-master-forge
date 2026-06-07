-- Tickets de suporte
CREATE TABLE IF NOT EXISTS public.saas_tickets (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  numero       SERIAL,
  company_id   UUID REFERENCES public.company(id) ON DELETE CASCADE,
  titulo       TEXT NOT NULL,
  descricao    TEXT,
  status       TEXT DEFAULT 'ABERTO' CHECK (status IN ('ABERTO', 'EM_ATENDIMENTO', 'AGUARDANDO_CLIENTE', 'RESOLVIDO', 'CANCELADO')),
  prioridade   TEXT DEFAULT 'MEDIA' CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA', 'URGENTE')),
  departamento TEXT DEFAULT 'SUPORTE',
  criado_por   UUID REFERENCES auth.users(id),
  atribuido_a  UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Mensagens dos tickets
CREATE TABLE IF NOT EXISTS public.saas_ticket_mensagens (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id    UUID REFERENCES public.saas_tickets(id) ON DELETE CASCADE,
  mensagem     TEXT NOT NULL,
  anexos       JSONB DEFAULT '[]',
  autor_id     UUID REFERENCES auth.users(id),
  is_interna   BOOLEAN DEFAULT false,
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Comunicados Globais
CREATE TABLE IF NOT EXISTS public.saas_comunicados (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo       TEXT NOT NULL,
  conteudo     TEXT NOT NULL,
  tipo         TEXT DEFAULT 'INFO' CHECK (tipo IN ('INFO', 'AVISO', 'MANUTENCAO', 'URGENTE')),
  ativo        BOOLEAN DEFAULT true,
  alvo_tenant  UUID REFERENCES public.company(id), -- Null = todos
  expira_em    TIMESTAMPTZ,
  criado_por   UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Configurações de IA (BrainX AI Hub)
CREATE TABLE IF NOT EXISTS public.saas_ai_config (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  provider     TEXT NOT NULL DEFAULT 'google',
  model        TEXT NOT NULL DEFAULT 'gemini-2.0-flash',
  description  TEXT,
  is_default   BOOLEAN DEFAULT false,
  is_active    BOOLEAN DEFAULT true,
  settings     JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Log de Atividades SaaS
CREATE TABLE IF NOT EXISTS public.saas_activity_log (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id     UUID REFERENCES auth.users(id),
  action       TEXT NOT NULL,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT,
  details      JSONB DEFAULT '{}',
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- Notas privadas sobre empresas
CREATE TABLE IF NOT EXISTS public.saas_company_notas (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id   UUID REFERENCES public.company(id) ON DELETE CASCADE,
  nota         TEXT NOT NULL,
  autor_id     UUID REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS em tudo
ALTER TABLE public.saas_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_ticket_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_ai_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_company_notas ENABLE ROW LEVEL SECURITY;

-- Grants para authenticated e service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_tickets TO authenticated;
GRANT ALL ON public.saas_tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_ticket_mensagens TO authenticated;
GRANT ALL ON public.saas_ticket_mensagens TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_comunicados TO authenticated;
GRANT ALL ON public.saas_comunicados TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_ai_config TO authenticated;
GRANT ALL ON public.saas_ai_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_activity_log TO authenticated;
GRANT ALL ON public.saas_activity_log TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_company_notas TO authenticated;
GRANT ALL ON public.saas_company_notas TO service_role;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;

-- Políticas: Apenas usuários com roles SaaS ou admin podem ver/gerenciar
CREATE POLICY "SaaS Admin All Tickets" ON public.saas_tickets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'saas_owner', 'saas_suporte'))
);

CREATE POLICY "SaaS Admin All Messages" ON public.saas_ticket_mensagens FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'saas_owner', 'saas_suporte'))
);

CREATE POLICY "SaaS Admin All Comunicados" ON public.saas_comunicados FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'saas_owner', 'saas_suporte'))
);

CREATE POLICY "SaaS Admin All AI Config" ON public.saas_ai_config FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'saas_owner'))
);

CREATE POLICY "SaaS Admin All Activity Log" ON public.saas_activity_log FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'saas_owner'))
);

CREATE POLICY "SaaS Admin All Company Notas" ON public.saas_company_notas FOR ALL USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'saas_owner', 'saas_suporte'))
);