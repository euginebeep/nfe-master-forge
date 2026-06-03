-- 1) Tabela
CREATE TABLE IF NOT EXISTS public.unlock_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  challenge_code TEXT NOT NULL UNIQUE,
  requested_by UUID NOT NULL,
  requested_by_nome TEXT,
  motivo TEXT NOT NULL,
  escopo TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  status TEXT NOT NULL DEFAULT 'AGUARDANDO_ADMIN'
    CHECK (status IN ('AGUARDANDO_ADMIN','LIBERADO','CONSUMIDO','EXPIRADO','CANCELADO')),
  temp_password_hash TEXT,
  temp_password_visualizada_em TIMESTAMPTZ,
  aprovado_por UUID,
  aprovado_por_nome TEXT,
  aprovado_em TIMESTAMPTZ,
  consumido_em TIMESTAMPTZ,
  desbloqueio_expira_em TIMESTAMPTZ,
  expira_em TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '6 hours'),
  ip_solicitante TEXT,
  ip_aprovador TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_unlock_challenges_company ON public.unlock_challenges(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unlock_challenges_status ON public.unlock_challenges(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_unlock_challenges_code ON public.unlock_challenges(challenge_code);

-- 2) GRANTs
GRANT SELECT, INSERT, UPDATE ON public.unlock_challenges TO authenticated;
GRANT ALL ON public.unlock_challenges TO service_role;

-- 3) RLS
ALTER TABLE public.unlock_challenges ENABLE ROW LEVEL SECURITY;

-- Operador vê desafios do próprio tenant
CREATE POLICY "Tenant users veem seus desafios"
  ON public.unlock_challenges FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Operador cria desafio para o próprio tenant (e como si mesmo)
CREATE POLICY "Tenant users criam desafios"
  ON public.unlock_challenges FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND requested_by = auth.uid()
  );

-- Updates só via service_role (edge functions). Mas admin pode cancelar.
CREATE POLICY "Admin global pode atualizar desafios"
  ON public.unlock_challenges FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 4) Trigger updated_at
CREATE TRIGGER trg_unlock_challenges_updated_at
  BEFORE UPDATE ON public.unlock_challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5) Função para verificar se há sessão de desbloqueio ativa para o usuário corrente
CREATE OR REPLACE FUNCTION public.has_active_unlock(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.unlock_challenges
    WHERE requested_by = _user_id
      AND status = 'CONSUMIDO'
      AND desbloqueio_expira_em > now()
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_active_unlock(UUID) TO authenticated;