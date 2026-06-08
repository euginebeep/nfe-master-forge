-- Histórico de perguntas ao assistente via Manual
CREATE TABLE IF NOT EXISTS public.manual_ia_historico (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    pergunta TEXT NOT NULL,
    resposta TEXT NOT NULL,
    secao_contexto TEXT,
    tokens_usados INTEGER,
    duracao_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.manual_ia_historico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_ver_proprio" ON public.manual_ia_historico
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "saas_ver_todos" ON public.manual_ia_historico FOR
SELECT USING (
    EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role IN ('admin','saas_owner','saas_suporte')
    )
);

-- Feedback por pergunta do FAQ (tabela leve)
CREATE TABLE IF NOT EXISTS public.manual_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    secao_id TEXT NOT NULL, -- id da seção (string do faqSections)
    pergunta_idx INTEGER NOT NULL, -- índice da pergunta na seção
    util BOOLEAN NOT NULL, -- true = sim, false = não
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    company_id UUID REFERENCES public.company(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.manual_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_insert_feedback" ON public.manual_feedback
FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Função para incrementar voto
CREATE OR REPLACE FUNCTION public.increment_manual_voto(pergunta_id UUID, campo_voto TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE 'UPDATE public.manual_perguntas SET ' || quote_ident(campo_voto) || ' = COALESCE(' || quote_ident(campo_voto) || ', 0) + 1 WHERE id = $1'
    USING pergunta_id;
END;
$$ LANGUAGE plpgsql;