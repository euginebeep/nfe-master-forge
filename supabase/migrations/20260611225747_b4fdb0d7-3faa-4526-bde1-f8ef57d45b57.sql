-- Function to log audit events
CREATE OR REPLACE FUNCTION public.registrar_evento_auditoria(
  p_entidade_tipo TEXT,
  p_entidade_id UUID,
  p_acao TEXT,
  p_resultado TEXT,
  p_detalhes JSONB DEFAULT '{}'::jsonb,
  p_company_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  INSERT INTO public.audit_trail_imutavel (
    entidade_tipo,
    entidade_id,
    acao,
    resultado,
    detalhes,
    company_id,
    user_id,
    ip_address,
    user_agent
  ) VALUES (
    p_entidade_tipo,
    p_entidade_id,
    p_acao,
    p_resultado,
    p_detalhes,
    COALESCE(p_company_id, (SELECT company_id FROM public.profiles WHERE id = v_user_id)),
    v_user_id,
    current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', true)::jsonb->>'user-agent'
  ) RETURNING id INTO v_audit_id;
  
  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure audit_trail_imutavel exists or create it if missing (simplified version for this checklist)
-- Note: Assuming table exists based on context, but adding a check just in case.
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_trail_imutavel') THEN
    CREATE TABLE public.audit_trail_imutavel (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      entidade_tipo TEXT NOT NULL,
      entidade_id UUID,
      acao TEXT NOT NULL,
      resultado TEXT NOT NULL,
      detalhes JSONB DEFAULT '{}'::jsonb,
      company_id UUID REFERENCES public.company(id),
      user_id UUID REFERENCES auth.users(id),
      ip_address TEXT,
      user_agent TEXT
    );
    GRANT SELECT, INSERT ON public.audit_trail_imutavel TO authenticated;
    GRANT ALL ON public.audit_trail_imutavel TO service_role;
    ALTER TABLE public.audit_trail_imutavel ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Users can view audit logs from their company" ON public.audit_trail_imutavel
      FOR SELECT USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
  END IF;
END $$;

-- Hardening RLS for erp-files bucket (sensitive files should not be accessible by owner alone if they belong to a company)
-- We need to ensure that certificates can only be read if the user belongs to the company,
-- and owner access is restricted for sensitive paths if necessary.
-- For now, let's just make sure company_id is always checked.

-- RPC to validate ownership of a note before sensitive actions (server-side check)
CREATE OR REPLACE FUNCTION public.validar_acesso_nota_saida(p_nuvem_fiscal_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.notas_saida n
    JOIN public.profiles p ON p.company_id = n.company_id
    WHERE n.nuvem_fiscal_id = p_nuvem_fiscal_id
      AND p.id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.validar_acesso_nota_saida(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_evento_auditoria(TEXT, UUID, TEXT, TEXT, JSONB, UUID) TO authenticated;
