-- ============================================================
-- 1. Tabela de numeração fiscal (controle atômico por tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nfe_numeracao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  modelo TEXT NOT NULL CHECK (modelo IN ('55','65')),
  serie INTEGER NOT NULL,
  proximo_numero BIGINT NOT NULL DEFAULT 1,
  ultimo_emitido BIGINT,
  ultimo_reservado_em TIMESTAMPTZ,
  ultimo_reservado_por UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, modelo, serie)
);

GRANT SELECT ON public.nfe_numeracao TO authenticated;
GRANT ALL ON public.nfe_numeracao TO service_role;

ALTER TABLE public.nfe_numeracao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_nfe_numeracao" ON public.nfe_numeracao
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- Mutações são feitas apenas via RPC (security definer). Sem policy de INSERT/UPDATE para authenticated.

CREATE TRIGGER trg_nfe_numeracao_updated_at
  BEFORE UPDATE ON public.nfe_numeracao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: importa numeração corrente de company (uma linha por empresa que tenha série configurada)
INSERT INTO public.nfe_numeracao (company_id, modelo, serie, proximo_numero)
SELECT id, '55', COALESCE(nfe_serie_padrao, 1), COALESCE(nfe_numero_inicial, 1)
FROM public.company
ON CONFLICT (company_id, modelo, serie) DO NOTHING;

INSERT INTO public.nfe_numeracao (company_id, modelo, serie, proximo_numero)
SELECT id, '65', COALESCE(nfe_serie_padrao, 1), 1
FROM public.company
ON CONFLICT (company_id, modelo, serie) DO NOTHING;

-- ============================================================
-- 2. Tabela de auditoria fiscal (eventos por nota)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.nfe_auditoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  nota_id UUID,
  modelo TEXT,
  serie INTEGER,
  numero BIGINT,
  chave_acesso TEXT,
  protocolo TEXT,
  evento TEXT NOT NULL CHECK (evento IN (
    'RESERVA_NUMERO','EMISSAO','PROTOCOLO','REJEICAO',
    'CANCELAMENTO','CC_E','INUTILIZACAO','REIMPRESSAO','PREVIEW','XML_DOWNLOAD'
  )),
  status TEXT,
  usuario_id UUID,
  usuario_nome TEXT,
  ip_address TEXT,
  user_agent TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.nfe_auditoria TO authenticated;
GRANT ALL ON public.nfe_auditoria TO service_role;

ALTER TABLE public.nfe_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_nfe_auditoria" ON public.nfe_auditoria
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

-- Inserção controlada via RPC. Permite INSERT para authenticated apenas do próprio tenant (front pode registrar PREVIEW/REIMPRESSAO).
CREATE POLICY "tenant_insert_nfe_auditoria" ON public.nfe_auditoria
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE INDEX IF NOT EXISTS idx_nfe_aud_company_created ON public.nfe_auditoria (company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_nfe_aud_nota ON public.nfe_auditoria (nota_id);
CREATE INDEX IF NOT EXISTS idx_nfe_aud_chave ON public.nfe_auditoria (chave_acesso);

-- ============================================================
-- 3. RPC: reservar próximo número (atômico)
-- ============================================================
CREATE OR REPLACE FUNCTION public.reservar_proximo_numero_nfe(
  p_modelo TEXT,
  p_serie INTEGER
) RETURNS TABLE (numero BIGINT, modelo TEXT, serie INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
  v_user UUID;
  v_row RECORD;
  v_next BIGINT;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'usuario_sem_empresa_associada';
  END IF;
  IF p_modelo NOT IN ('55','65') THEN
    RAISE EXCEPTION 'modelo_invalido_use_55_ou_65';
  END IF;

  v_user := auth.uid();

  -- Garante linha existente
  INSERT INTO public.nfe_numeracao (company_id, modelo, serie, proximo_numero)
  VALUES (v_company, p_modelo, p_serie, 1)
  ON CONFLICT (company_id, modelo, serie) DO NOTHING;

  -- Lock atômico da linha do tenant+modelo+série
  SELECT * INTO v_row
  FROM public.nfe_numeracao
  WHERE company_id = v_company AND modelo = p_modelo AND serie = p_serie
  FOR UPDATE;

  v_next := v_row.proximo_numero;

  UPDATE public.nfe_numeracao
  SET proximo_numero = v_next + 1,
      ultimo_reservado_em = now(),
      ultimo_reservado_por = v_user
  WHERE id = v_row.id;

  -- Audita reserva
  INSERT INTO public.nfe_auditoria (
    company_id, modelo, serie, numero, evento, usuario_id, payload
  ) VALUES (
    v_company, p_modelo, p_serie, v_next, 'RESERVA_NUMERO', v_user,
    jsonb_build_object('reservado_em', now())
  );

  numero := v_next;
  modelo := p_modelo;
  serie := p_serie;
  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reservar_proximo_numero_nfe(TEXT, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservar_proximo_numero_nfe(TEXT, INTEGER) TO authenticated, service_role;

-- ============================================================
-- 4. RPC: liberar / inutilizar número
-- ============================================================
CREATE OR REPLACE FUNCTION public.liberar_numero_nfe(
  p_modelo TEXT,
  p_serie INTEGER,
  p_numero BIGINT,
  p_motivo TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
  v_user UUID;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'usuario_sem_empresa_associada'; END IF;
  v_user := auth.uid();

  INSERT INTO public.nfe_auditoria (
    company_id, modelo, serie, numero, evento, usuario_id, payload, observacao
  ) VALUES (
    v_company, p_modelo, p_serie, p_numero, 'INUTILIZACAO', v_user,
    jsonb_build_object('motivo', p_motivo), p_motivo
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.liberar_numero_nfe(TEXT, INTEGER, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.liberar_numero_nfe(TEXT, INTEGER, BIGINT, TEXT) TO authenticated, service_role;

-- ============================================================
-- 5. RPC: registrar evento (espelha em audit_trail_imutavel se aplicável)
-- ============================================================
CREATE OR REPLACE FUNCTION public.registrar_evento_nfe(
  p_evento TEXT,
  p_nota_id UUID DEFAULT NULL,
  p_modelo TEXT DEFAULT NULL,
  p_serie INTEGER DEFAULT NULL,
  p_numero BIGINT DEFAULT NULL,
  p_chave_acesso TEXT DEFAULT NULL,
  p_protocolo TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_observacao TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
  v_user UUID;
  v_nome TEXT;
  v_id UUID;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN RAISE EXCEPTION 'usuario_sem_empresa_associada'; END IF;
  v_user := auth.uid();
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

REVOKE EXECUTE ON FUNCTION public.registrar_evento_nfe(TEXT, UUID, TEXT, INTEGER, BIGINT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_evento_nfe(TEXT, UUID, TEXT, INTEGER, BIGINT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT) TO authenticated, service_role;