-- Sistema de reserva de números de lote (formato SKU-AAMM-NNNN-D)
-- Impede geração de novo número enquanto houver lote pendente de regularização

CREATE TABLE IF NOT EXISTS public.lotes_reservados (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE,
  codigo_curto TEXT NOT NULL,
  ano_mes TEXT NOT NULL,
  sequencia INTEGER NOT NULL,
  digito_verificador INTEGER NOT NULL,
  numero_completo TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE_REGULARIZACAO'
    CHECK (status IN ('PENDENTE_REGULARIZACAO','CONSUMIDO','CANCELADO')),
  item_id UUID REFERENCES public.itens(id) ON DELETE SET NULL,
  formula_id UUID REFERENCES public.formulas(id) ON DELETE SET NULL,
  lote_pa_id UUID REFERENCES public.lotes_produto_acabado(id) ON DELETE SET NULL,
  op_id UUID REFERENCES public.ordens_producao_industrial(id) ON DELETE SET NULL,
  data_fabricacao DATE,
  descricao_produto TEXT,
  observacao TEXT,
  reservado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  regularizado_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  cancelado_motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, codigo_curto, ano_mes, sequencia),
  UNIQUE (company_id, numero_completo)
);

CREATE INDEX IF NOT EXISTS idx_lotes_reservados_company_status
  ON public.lotes_reservados(company_id, status);
CREATE INDEX IF NOT EXISTS idx_lotes_reservados_codigo
  ON public.lotes_reservados(company_id, codigo_curto, ano_mes);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lotes_reservados TO authenticated;
GRANT ALL ON public.lotes_reservados TO service_role;

ALTER TABLE public.lotes_reservados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_select_lotes_reservados" ON public.lotes_reservados
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

CREATE POLICY "tenant_insert_lotes_reservados" ON public.lotes_reservados
  FOR INSERT TO authenticated
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "tenant_update_lotes_reservados" ON public.lotes_reservados
  FOR UPDATE TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

CREATE POLICY "tenant_delete_lotes_reservados" ON public.lotes_reservados
  FOR DELETE TO authenticated
  USING (company_id = public.get_user_company_id()
         AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_lotes_reservados_updated_at
  BEFORE UPDATE ON public.lotes_reservados
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cálculo do dígito verificador (módulo 11) sobre a string base
CREATE OR REPLACE FUNCTION public.calcular_dv_lote(p_base TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  s INTEGER := 0;
  peso INTEGER := 2;
  c INTEGER;
  i INTEGER;
  resto INTEGER;
BEGIN
  FOR i IN REVERSE length(p_base)..1 LOOP
    c := ascii(substr(p_base, i, 1));
    s := s + (c * peso);
    peso := peso + 1;
    IF peso > 9 THEN peso := 2; END IF;
  END LOOP;
  resto := s % 11;
  IF resto < 2 THEN RETURN 0; ELSE RETURN 11 - resto; END IF;
END;
$$;

-- Reserva atômica do próximo número de lote
-- Bloqueia se já houver alguma reserva PENDENTE_REGULARIZACAO do mesmo (codigo_curto, ano_mes)
CREATE OR REPLACE FUNCTION public.reservar_proximo_lote(
  p_codigo_curto TEXT,
  p_ano_mes TEXT,
  p_data_fabricacao DATE DEFAULT NULL,
  p_descricao_produto TEXT DEFAULT NULL,
  p_observacao TEXT DEFAULT NULL,
  p_permitir_paralelo BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  id UUID,
  numero_completo TEXT,
  sequencia INTEGER,
  digito_verificador INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
  v_user UUID;
  v_next INTEGER;
  v_base TEXT;
  v_dv INTEGER;
  v_numero TEXT;
  v_id UUID;
  v_pendente_count INTEGER;
  v_codigo TEXT;
  v_anomes TEXT;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'usuario_sem_empresa_associada';
  END IF;
  v_user := auth.uid();

  v_codigo := upper(trim(p_codigo_curto));
  v_anomes := trim(p_ano_mes);

  IF v_codigo !~ '^[A-Z0-9]{2,8}$' THEN
    RAISE EXCEPTION 'codigo_curto_invalido_use_2_a_8_alfanumericos';
  END IF;
  IF v_anomes !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'ano_mes_invalido_use_AAMM';
  END IF;

  -- Lock advisory por (company, codigo, anomes) para serializar reservas concorrentes
  PERFORM pg_advisory_xact_lock(
    hashtext(v_company::text || ':' || v_codigo || ':' || v_anomes)
  );

  -- Trava de regularização: bloqueia se já existir pendente do mesmo SKU/mês
  IF NOT p_permitir_paralelo THEN
    SELECT COUNT(*) INTO v_pendente_count
    FROM public.lotes_reservados
    WHERE company_id = v_company
      AND codigo_curto = v_codigo
      AND ano_mes = v_anomes
      AND status = 'PENDENTE_REGULARIZACAO';

    IF v_pendente_count > 0 THEN
      RAISE EXCEPTION 'lote_pendente_regularizacao_bloqueia_nova_reserva'
        USING HINT = 'Regularize ou cancele o lote pendente antes de reservar outro número para este SKU/mês.';
    END IF;
  END IF;

  SELECT COALESCE(MAX(sequencia), 0) + 1 INTO v_next
  FROM public.lotes_reservados
  WHERE company_id = v_company
    AND codigo_curto = v_codigo
    AND ano_mes = v_anomes;

  v_base := v_codigo || '-' || v_anomes || '-' || LPAD(v_next::text, 4, '0');
  v_dv := public.calcular_dv_lote(v_base);
  v_numero := v_base || '-' || v_dv::text;

  INSERT INTO public.lotes_reservados (
    company_id, codigo_curto, ano_mes, sequencia, digito_verificador,
    numero_completo, status, data_fabricacao, descricao_produto, observacao, reservado_por
  ) VALUES (
    v_company, v_codigo, v_anomes, v_next, v_dv,
    v_numero, 'PENDENTE_REGULARIZACAO',
    p_data_fabricacao, p_descricao_produto, p_observacao, v_user
  ) RETURNING lotes_reservados.id INTO v_id;

  id := v_id;
  numero_completo := v_numero;
  sequencia := v_next;
  digito_verificador := v_dv;
  RETURN NEXT;
END;
$$;

-- Regulariza um lote reservado vinculando-o ao registro definitivo
CREATE OR REPLACE FUNCTION public.regularizar_lote_reservado(
  p_reserva_id UUID,
  p_lote_pa_id UUID DEFAULT NULL,
  p_op_id UUID DEFAULT NULL,
  p_item_id UUID DEFAULT NULL,
  p_formula_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'usuario_sem_empresa_associada';
  END IF;

  UPDATE public.lotes_reservados
  SET status = 'CONSUMIDO',
      lote_pa_id = COALESCE(p_lote_pa_id, lote_pa_id),
      op_id = COALESCE(p_op_id, op_id),
      item_id = COALESCE(p_item_id, item_id),
      formula_id = COALESCE(p_formula_id, formula_id),
      regularizado_em = now()
  WHERE id = p_reserva_id
    AND company_id = v_company
    AND status = 'PENDENTE_REGULARIZACAO';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserva_nao_encontrada_ou_ja_processada';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_lote_reservado(
  p_reserva_id UUID,
  p_motivo TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID;
BEGIN
  v_company := public.get_user_company_id();
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'usuario_sem_empresa_associada';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 5 THEN
    RAISE EXCEPTION 'motivo_obrigatorio_min_5_caracteres';
  END IF;

  UPDATE public.lotes_reservados
  SET status = 'CANCELADO',
      cancelado_em = now(),
      cancelado_motivo = p_motivo
  WHERE id = p_reserva_id
    AND company_id = v_company
    AND status = 'PENDENTE_REGULARIZACAO';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'reserva_nao_encontrada_ou_ja_processada';
  END IF;
END;
$$;