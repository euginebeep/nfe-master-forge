-- ============================================================================
-- QR público do lote + rate limit server-side
-- RPC get_lote_publico (anon) — sem custo, saldo ou cliente.
-- Ordem: aplicar no Supabase ANTES do merge/deploy do frontend.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Log de scans (IP só como hash)
CREATE TABLE IF NOT EXISTS public.qr_scan_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id uuid,
  ip_hash text NOT NULL,
  user_agent text,
  ok boolean NOT NULL DEFAULT true,
  motivo text,
  scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_log_ip_recent
  ON public.qr_scan_log (ip_hash, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_scan_log_lote
  ON public.qr_scan_log (lote_id, scanned_at DESC);

ALTER TABLE public.qr_scan_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role full qr_scan_log" ON public.qr_scan_log;
-- Sem políticas para authenticated/anon: só SECURITY DEFINER escreve.
GRANT ALL ON public.qr_scan_log TO service_role;
GRANT SELECT ON public.qr_scan_log TO authenticated;

COMMENT ON TABLE public.qr_scan_log IS
  'Auditoria de leitura do QR público. Guarda ip_hash (nunca IP em claro).';

-- ---------------------------------------------------------------------------
-- Hash do IP do cliente (x-forwarded-for / x-real-ip)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qr_client_ip_hash()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  headers jsonb;
  raw_ip text;
BEGIN
  BEGIN
    headers := nullif(current_setting('request.headers', true), '')::jsonb;
  EXCEPTION WHEN OTHERS THEN
    headers := NULL;
  END;

  raw_ip := COALESCE(
    split_part(COALESCE(headers->>'x-forwarded-for', ''), ',', 1),
    headers->>'x-real-ip',
    headers->>'cf-connecting-ip',
    ''
  );
  raw_ip := trim(raw_ip);

  IF raw_ip = '' THEN
    raw_ip := 'unknown';
  END IF;

  RETURN encode(extensions.digest(raw_ip, 'sha256'), 'hex');
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_client_ip_hash() TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.qr_client_ip_hash() IS
  'SHA-256 do IP do request (via headers). Usado no rate limit do QR público.';

-- ---------------------------------------------------------------------------
-- Payload público do lote (etiqueta / auditoria)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_lote_publico(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ip_hash text;
  v_count int;
  v_lote record;
  v_item record;
  v_fornecedor record;
  v_company record;
  v_nota record;
  v_payload jsonb;
BEGIN
  IF p_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'mensagem', 'Código não informado');
  END IF;

  v_ip_hash := public.qr_client_ip_hash();

  SELECT count(*)::int INTO v_count
  FROM public.qr_scan_log
  WHERE ip_hash = v_ip_hash
    AND scanned_at > now() - interval '1 minute';

  IF v_count >= 20 THEN
    INSERT INTO public.qr_scan_log (lote_id, ip_hash, user_agent, ok, motivo)
    VALUES (
      p_id,
      v_ip_hash,
      current_setting('request.headers', true)::jsonb->>'user-agent',
      false,
      'rate_limit'
    );

    RETURN jsonb_build_object(
      'ok', false,
      'mensagem', 'Muitas consultas. Aguarde um minuto e tente novamente.'
    );
  END IF;

  SELECT
    el.id,
    el.numero_lote,
    el.status,
    el.quantidade_original,
    el.unidade_original,
    el.data_fab,
    el.data_val,
    el.created_at,
    el.company_id,
    el.item_id,
    el.fornecedor_id,
    el.nota_entrada_item_id,
    el.observacoes_qc
  INTO v_lote
  FROM public.estoque_lotes el
  WHERE el.id = p_id;

  IF NOT FOUND THEN
    INSERT INTO public.qr_scan_log (lote_id, ip_hash, user_agent, ok, motivo)
    VALUES (
      p_id,
      v_ip_hash,
      current_setting('request.headers', true)::jsonb->>'user-agent',
      false,
      'nao_encontrado'
    );

    RETURN jsonb_build_object('ok', false, 'mensagem', 'Lote não encontrado');
  END IF;

  SELECT
    i.descricao_interna,
    i.sku_interno,
    i.armazenamento,
    i.texto_alerta_padrao,
    i.tipo_item,
    i.unidade_interna
  INTO v_item
  FROM public.itens i
  WHERE i.id = v_lote.item_id;

  SELECT e.razao_social, e.nome_fantasia, e.documento
  INTO v_fornecedor
  FROM public.entidades e
  WHERE e.id = v_lote.fornecedor_id;

  SELECT
    c.razao_social,
    c.nome_fantasia,
    c.cnpj,
    c.site,
    c.afe_anvisa,
    c.licenca_sanitaria
  INTO v_company
  FROM public.company c
  WHERE c.id = v_lote.company_id;

  SELECT ne.numero, ne.serie, ne.dh_emissao
  INTO v_nota
  FROM public.notas_entrada_itens nei
  JOIN public.notas_entrada ne ON ne.id = nei.nota_entrada_id
  WHERE nei.id = v_lote.nota_entrada_item_id;

  v_payload := jsonb_build_object(
    'ok', true,
    'tipo_lote', 'FORNECEDOR',
    'lote', jsonb_build_object(
      'id', v_lote.id,
      'numero_lote', v_lote.numero_lote,
      'status', v_lote.status,
      'quantidade_original', v_lote.quantidade_original,
      'unidade_original', v_lote.unidade_original,
      'data_fab', v_lote.data_fab,
      'data_val', v_lote.data_val,
      'recebido_em', v_lote.created_at,
      'observacoes_qc', v_lote.observacoes_qc,
      'insumo', jsonb_build_object(
        'descricao', COALESCE(v_item.descricao_interna, 'Insumo'),
        'sku', v_item.sku_interno,
        'tipo_item', v_item.tipo_item,
        'armazenamento', v_item.armazenamento,
        'texto_alerta', v_item.texto_alerta_padrao,
        'unidade_interna', v_item.unidade_interna
      ),
      'fornecedor', CASE
        WHEN v_fornecedor.razao_social IS NULL THEN NULL
        ELSE jsonb_build_object(
          'razao_social', v_fornecedor.razao_social,
          'nome_fantasia', v_fornecedor.nome_fantasia,
          'documento', v_fornecedor.documento
        )
      END,
      'empresa', CASE
        WHEN v_company.razao_social IS NULL THEN NULL
        ELSE jsonb_build_object(
          'razao_social', v_company.razao_social,
          'nome_fantasia', v_company.nome_fantasia,
          'cnpj', v_company.cnpj,
          'site', v_company.site,
          'afe_anvisa', v_company.afe_anvisa,
          'licenca_sanitaria', v_company.licenca_sanitaria
        )
      END,
      'nota_entrada', CASE
        WHEN v_nota.numero IS NULL THEN NULL
        ELSE jsonb_build_object(
          'numero', v_nota.numero,
          'serie', v_nota.serie,
          'dh_emissao', v_nota.dh_emissao
        )
      END
    )
  );

  INSERT INTO public.qr_scan_log (lote_id, ip_hash, user_agent, ok, motivo)
  VALUES (
    v_lote.id,
    v_ip_hash,
    current_setting('request.headers', true)::jsonb->>'user-agent',
    true,
    'ok'
  );

  RETURN v_payload;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_lote_publico(uuid) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.get_lote_publico(uuid) IS
  'Auditoria pública do lote (QR). Rate limit 20/min por IP hash. Sem custo/saldo/cliente.';
