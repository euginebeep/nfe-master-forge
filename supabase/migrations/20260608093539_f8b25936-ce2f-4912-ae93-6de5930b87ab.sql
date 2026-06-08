-- Adicionar novas colunas na tabela de comunicados
ALTER TABLE public.saas_comunicados ADD COLUMN IF NOT EXISTS alvo_tipo_empresa TEXT;
ALTER TABLE public.saas_comunicados ADD COLUMN IF NOT EXISTS link_acao TEXT;
ALTER TABLE public.saas_comunicados ADD COLUMN IF NOT EXISTS label_acao TEXT;

-- Criar tabela para rastrear avisos lidos/fechados
CREATE TABLE IF NOT EXISTS public.saas_comunicados_lidos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    comunicado_id UUID NOT NULL REFERENCES public.saas_comunicados(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id, comunicado_id)
);

-- Habilitar RLS
ALTER TABLE public.saas_comunicados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saas_comunicados_lidos ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saas_comunicados TO authenticated;
GRANT ALL ON public.saas_comunicados TO service_role;

GRANT SELECT, INSERT ON public.saas_comunicados_lidos TO authenticated;
GRANT ALL ON public.saas_comunicados_lidos TO service_role;

-- Políticas para saas_comunicados
-- Administradores SaaS (já deve existir, mas garantindo)
CREATE POLICY "SaaS Admin can manage all comunicados" ON public.saas_comunicados
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM user_roles 
            WHERE user_id = auth.uid() 
            AND role IN ('admin', 'saas_owner', 'saas_suporte')
        )
    );

-- Usuários normais podem ver avisos ativos e direcionados a eles
CREATE POLICY "Users can see applicable comunicados" ON public.saas_comunicados
    FOR SELECT
    TO authenticated
    USING (
        ativo = true 
        AND (expira_em IS NULL OR expira_em > now())
        AND (
            (alvo_tenant IS NULL AND alvo_tipo_empresa IS NULL) -- Global
            OR (alvo_tenant = (SELECT company_id FROM profiles WHERE id = auth.uid())) -- Seu Tenant
            -- O filtro de alvo_tipo_empresa será feito via query no front por enquanto
            -- já que a estrutura de tipo de empresa não está clara no banco
        )
    );

-- Políticas para saas_comunicados_lidos
CREATE POLICY "Users can manage their own read status" ON public.saas_comunicados_lidos
    FOR ALL
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
