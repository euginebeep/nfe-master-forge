
-- =====================================================
-- MODO FANTASMA — Super Dev Impersonation
-- =====================================================

-- 1. Chave de criptografia no vault
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'ghost_audit_encryption_key') THEN
    PERFORM vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'ghost_audit_encryption_key',
      'Chave para criptografar saas_ghost_audit (modo fantasma)'
    );
  END IF;
END $$;

-- 2. Tabela: super devs (acesso master)
CREATE TABLE IF NOT EXISTS public.saas_super_devs (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  added_by UUID,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);
GRANT ALL ON public.saas_super_devs TO service_role;
ALTER TABLE public.saas_super_devs ENABLE ROW LEVEL SECURITY;
-- Sem políticas: apenas service_role lê/escreve.

-- 3. Tabela: sessões de impersonation ativas
CREATE TABLE IF NOT EXISTS public.saas_impersonation_sessions (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_company_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '2 hours'
);
GRANT ALL ON public.saas_impersonation_sessions TO service_role;
GRANT SELECT ON public.saas_impersonation_sessions TO authenticated;
ALTER TABLE public.saas_impersonation_sessions ENABLE ROW LEVEL SECURITY;
-- Super dev vê sua própria sessão (pra UI saber)
CREATE POLICY "super_dev_ve_propria_sessao" ON public.saas_impersonation_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.saas_super_devs WHERE saas_super_devs.user_id = auth.uid()));

-- 4. Tabela: log oculto criptografado
CREATE TABLE IF NOT EXISTS public.saas_ghost_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  target_company_id UUID,
  acao TEXT NOT NULL,
  payload_encrypted BYTEA,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT ALL ON public.saas_ghost_audit TO service_role;
ALTER TABLE public.saas_ghost_audit ENABLE ROW LEVEL SECURITY;
-- Sem policies: leitura só via função SECURITY DEFINER.
CREATE INDEX IF NOT EXISTS idx_ghost_audit_user ON public.saas_ghost_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghost_audit_target ON public.saas_ghost_audit(target_company_id, created_at DESC);

-- =====================================================
-- HELPERS
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_super_dev(_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.saas_super_devs WHERE user_id = _uid)
$$;

CREATE OR REPLACE FUNCTION public.is_ghost_mode(_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.saas_impersonation_sessions
    WHERE user_id = _uid AND expires_at > now()
  )
$$;

CREATE OR REPLACE FUNCTION public.get_ghost_target_company(_uid UUID DEFAULT auth.uid())
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT target_company_id FROM public.saas_impersonation_sessions
  WHERE user_id = _uid AND expires_at > now()
$$;

-- =====================================================
-- ALTERA get_user_company_id — retorna alvo em modo fantasma
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_company_id()
RETURNS UUID
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ghost UUID;
BEGIN
  SELECT target_company_id INTO v_ghost
  FROM public.saas_impersonation_sessions
  WHERE user_id = auth.uid() AND expires_at > now();

  IF v_ghost IS NOT NULL THEN
    RETURN v_ghost;
  END IF;

  RETURN (SELECT company_id FROM public.profiles WHERE id = auth.uid());
END;
$$;

-- =====================================================
-- ALTERA has_role — super dev passa em tudo
-- =====================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Super dev tem todas as roles, sempre
  IF EXISTS (SELECT 1 FROM public.saas_super_devs WHERE user_id = _user_id) THEN
    RETURN TRUE;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- =====================================================
-- GHOST AUDIT — gravar criptografado
-- =====================================================

CREATE OR REPLACE FUNCTION public._ghost_audit_key()
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'ghost_audit_encryption_key' LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.ghost_audit_log(p_acao TEXT, p_payload JSONB)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key TEXT;
  v_target UUID;
BEGIN
  v_key := public._ghost_audit_key();
  v_target := public.get_ghost_target_company(auth.uid());

  INSERT INTO public.saas_ghost_audit (user_id, target_company_id, acao, payload_encrypted)
  VALUES (
    auth.uid(),
    v_target,
    p_acao,
    extensions.pgp_sym_encrypt(p_payload::TEXT, v_key)
  );
END;
$$;

-- Leitura descriptografada (só super dev)
CREATE OR REPLACE FUNCTION public.read_ghost_audit(
  p_limit INT DEFAULT 200,
  p_target_company UUID DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  target_company_id UUID,
  acao TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key TEXT;
BEGIN
  IF NOT public.is_super_dev(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden_super_dev_only';
  END IF;
  v_key := public._ghost_audit_key();

  RETURN QUERY
  SELECT
    g.id, g.user_id, g.target_company_id, g.acao,
    extensions.pgp_sym_decrypt(g.payload_encrypted, v_key)::JSONB AS payload,
    g.created_at
  FROM public.saas_ghost_audit g
  WHERE (p_target_company IS NULL OR g.target_company_id = p_target_company)
    AND (p_since IS NULL OR g.created_at >= p_since)
  ORDER BY g.created_at DESC
  LIMIT p_limit;
END;
$$;

-- =====================================================
-- ALTERA registrar_evento_auditoria (variante completa)
-- Se super dev em modo fantasma → grava em ghost_audit
-- =====================================================

CREATE OR REPLACE FUNCTION public.registrar_evento_auditoria(
  p_tipo_evento tipo_evento_auditoria,
  p_descricao TEXT,
  p_entidade_tipo TEXT,
  p_entidade_id UUID,
  p_entidade_codigo TEXT DEFAULT NULL,
  p_usuario_id UUID DEFAULT NULL,
  p_usuario_nome TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_dados_evento JSONB DEFAULT '{}'::jsonb,
  p_dados_anteriores JSONB DEFAULT NULL,
  p_dados_novos JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash_anterior TEXT;
  v_sequencia BIGINT;
  v_hash_atual TEXT;
  v_novo_id UUID;
  v_dados_completos JSONB;
BEGIN
  -- DESVIO FANTASMA: se super dev em modo fantasma, grava no log oculto e retorna null
  IF public.is_ghost_mode(auth.uid()) THEN
    PERFORM public.ghost_audit_log(
      'AUDIT:' || p_tipo_evento::TEXT,
      jsonb_build_object(
        'descricao', p_descricao,
        'entidade_tipo', p_entidade_tipo,
        'entidade_id', p_entidade_id,
        'entidade_codigo', p_entidade_codigo,
        'dados_evento', p_dados_evento,
        'dados_anteriores', p_dados_anteriores,
        'dados_novos', p_dados_novos
      )
    );
    RETURN NULL;
  END IF;

  SELECT hash_atual, sequencia INTO v_hash_anterior, v_sequencia
  FROM public.audit_trail_imutavel ORDER BY sequencia DESC LIMIT 1;

  v_sequencia := COALESCE(v_sequencia, 0) + 1;

  v_dados_completos := jsonb_build_object(
    'tipo_evento', p_tipo_evento, 'descricao', p_descricao,
    'entidade_tipo', p_entidade_tipo, 'entidade_id', p_entidade_id,
    'entidade_codigo', p_entidade_codigo, 'usuario_id', p_usuario_id,
    'dados_evento', p_dados_evento, 'hash_anterior', v_hash_anterior,
    'sequencia', v_sequencia, 'timestamp', now()
  );

  v_hash_atual := public.gerar_hash_auditoria(v_dados_completos);

  INSERT INTO public.audit_trail_imutavel (
    tipo_evento, descricao, entidade_tipo, entidade_id, entidade_codigo,
    usuario_id, usuario_nome, ip_address, user_agent, dados_evento,
    dados_anteriores, dados_novos, hash_anterior, hash_atual, sequencia
  ) VALUES (
    p_tipo_evento, p_descricao, p_entidade_tipo, p_entidade_id, p_entidade_codigo,
    p_usuario_id, p_usuario_nome, p_ip_address, p_user_agent, p_dados_evento,
    p_dados_anteriores, p_dados_novos, v_hash_anterior, v_hash_atual, v_sequencia
  ) RETURNING id INTO v_novo_id;

  RETURN v_novo_id;
END;
$$;

-- =====================================================
-- ALTERA registrar_evento_auditoria (variante curta)
-- =====================================================

CREATE OR REPLACE FUNCTION public.registrar_evento_auditoria(
  p_entidade_tipo TEXT,
  p_entidade_id UUID,
  p_acao TEXT,
  p_resultado TEXT,
  p_detalhes JSONB DEFAULT '{}'::jsonb,
  p_company_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
  v_user_id UUID := auth.uid();
BEGIN
  -- DESVIO FANTASMA
  IF public.is_ghost_mode(v_user_id) THEN
    PERFORM public.ghost_audit_log(
      'AUDIT_SHORT:' || p_acao,
      jsonb_build_object(
        'entidade_tipo', p_entidade_tipo,
        'entidade_id', p_entidade_id,
        'resultado', p_resultado,
        'detalhes', p_detalhes,
        'company_id', p_company_id
      )
    );
    RETURN NULL;
  END IF;

  INSERT INTO public.audit_trail_imutavel (
    entidade_tipo, entidade_id, acao, resultado, detalhes,
    company_id, user_id, ip_address, user_agent
  ) VALUES (
    p_entidade_tipo, p_entidade_id, p_acao, p_resultado, p_detalhes,
    COALESCE(p_company_id, (SELECT company_id FROM public.profiles WHERE id = v_user_id)),
    v_user_id,
    current_setting('request.headers', true)::jsonb->>'x-forwarded-for',
    current_setting('request.headers', true)::jsonb->>'user-agent'
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- =====================================================
-- ALTERA update_ultimo_acesso — pula se modo fantasma
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_ultimo_acesso(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_ghost_mode(p_user_id) THEN
    RETURN;
  END IF;
  UPDATE public.profiles SET ultimo_acesso = now() WHERE id = p_user_id;
END;
$$;

-- =====================================================
-- ALTERA registrar_evento_nfe — pula se modo fantasma
-- =====================================================

CREATE OR REPLACE FUNCTION public.registrar_evento_nfe(
  p_evento TEXT, p_nota_id UUID DEFAULT NULL, p_modelo TEXT DEFAULT NULL,
  p_serie INTEGER DEFAULT NULL, p_numero BIGINT DEFAULT NULL,
  p_chave_acesso TEXT DEFAULT NULL, p_protocolo TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL, p_payload JSONB DEFAULT '{}'::jsonb,
  p_observacao TEXT DEFAULT NULL, p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID; v_user UUID; v_nome TEXT; v_id UUID;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'usuario_sem_empresa_associada'; END IF;
  v_user := auth.uid();

  -- DESVIO FANTASMA
  IF public.is_ghost_mode(v_user) THEN
    PERFORM public.ghost_audit_log(
      'NFE:' || p_evento,
      jsonb_build_object(
        'nota_id', p_nota_id, 'modelo', p_modelo, 'serie', p_serie,
        'numero', p_numero, 'chave_acesso', p_chave_acesso,
        'protocolo', p_protocolo, 'status', p_status, 'payload', p_payload,
        'observacao', p_observacao
      )
    );
    RETURN NULL;
  END IF;

  SELECT nome_completo INTO v_nome FROM public.profiles WHERE id = v_user;

  INSERT INTO public.nfe_auditoria (
    company_id, nota_id, modelo, serie, numero, chave_acesso, protocolo,
    evento, status, usuario_id, usuario_nome, ip_address, user_agent,
    payload, observacao
  ) VALUES (
    v_company, p_nota_id, p_modelo, p_serie, p_numero, p_chave_acesso, p_protocolo,
    p_evento, p_status, v_user, v_nome, p_ip_address, p_user_agent,
    COALESCE(p_payload, '{}'::jsonb), p_observacao
  ) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- =====================================================
-- ALTERA triggers de notificações — não notifica se autor é fantasma
-- =====================================================

CREATE OR REPLACE FUNCTION public.trigger_notify_alerta_executivo()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE u RECORD; n_type TEXT;
BEGIN
  IF public.is_ghost_mode(auth.uid()) THEN RETURN NEW; END IF;
  n_type := CASE WHEN NEW.nivel='CRITICO' THEN 'error' WHEN NEW.nivel='ALTO' THEN 'warning' ELSE 'info' END;
  FOR u IN SELECT p.id FROM profiles p WHERE p.company_id = NEW.company_id LOOP
    INSERT INTO notifications (user_id, title, message, type, module)
    VALUES (u.id, NEW.titulo, NEW.descricao, n_type, 'Executivo');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_notify_anomalia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE u RECORD;
BEGIN
  IF public.is_ghost_mode(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.severidade IN ('CRITICA','ALTA') THEN
    FOR u IN SELECT p.id FROM profiles p WHERE p.company_id = NEW.company_id LOOP
      INSERT INTO notifications (user_id, title, message, type, module)
      VALUES (u.id, 'Anomalia '||NEW.severidade||' detectada', NEW.descricao, 'error', 'Produção');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- =====================================================
-- RPC: start_ghost_session / stop_ghost_session
-- =====================================================

CREATE OR REPLACE FUNCTION public.start_ghost_session(p_target_company_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_expires TIMESTAMPTZ := now() + interval '2 hours';
BEGIN
  IF NOT public.is_super_dev(v_uid) THEN
    RAISE EXCEPTION 'forbidden_super_dev_only';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.company WHERE id = p_target_company_id) THEN
    RAISE EXCEPTION 'empresa_nao_encontrada';
  END IF;

  INSERT INTO public.saas_impersonation_sessions (user_id, target_company_id, started_at, expires_at)
  VALUES (v_uid, p_target_company_id, now(), v_expires)
  ON CONFLICT (user_id) DO UPDATE
    SET target_company_id = EXCLUDED.target_company_id,
        started_at = now(),
        expires_at = EXCLUDED.expires_at;

  PERFORM public.ghost_audit_log('SESSION_START', jsonb_build_object('target', p_target_company_id));

  RETURN jsonb_build_object('ok', true, 'target_company_id', p_target_company_id, 'expires_at', v_expires);
END;
$$;

CREATE OR REPLACE FUNCTION public.stop_ghost_session()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF NOT public.is_super_dev(v_uid) THEN
    RAISE EXCEPTION 'forbidden_super_dev_only';
  END IF;
  PERFORM public.ghost_audit_log('SESSION_END', '{}'::jsonb);
  DELETE FROM public.saas_impersonation_sessions WHERE user_id = v_uid;
  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_ghost_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.stop_ghost_session() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_dev(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_ghost_mode(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.read_ghost_audit(INT, UUID, TIMESTAMPTZ) TO authenticated;
