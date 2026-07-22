-- =====================================================================
-- BrainX ERP — QR público de lote + rate limit server-side
-- Data: 2026-07-22
--
-- ESTE ARQUIVO REFLETE FIELMENTE O ESTADO APLICADO EM PRODUCAO
-- (projeto cqkvekdrifmvedvpjmjr), verificado via pg_policies,
-- pg_indexes e pg_get_viewdef em 22/07/2026.
--
-- JA APLICADO. Nao reexecutar em producao. Em ambiente novo, aplicar
-- uma vez para reproduzir o mesmo schema.
--
-- Contexto:
--   A página /audit/lote/:hash consultava estoque_lotes direto do browser
--   com a chave anon. Dois problemas:
--     1) RLS: tenant_select_estoque_lotes é TO authenticated. Scan anônimo
--        (auditor, cliente white-label) sempre retornava vazio.
--     2) estoque_lotes NÃO possui a coluna qr_code_hash, mas o filtro
--        .or(...) a referenciava -> erro PostgREST silencioso.
--   Além disso o filtro era montado por interpolação de string a partir
--   da URL, permitindo injeção de operadores PostgREST.
--
-- Solução:
--   RPC SECURITY DEFINER com parâmetro tipado (uuid), devolvendo apenas
--   o payload público. Sem custo, sem saldo em estoque, sem dados de
--   cliente. Rate limit no servidor, por IP, não em localStorage.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Log de scans (serve para rate limit E para métrica de rastreabilidade)
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.qr_scan_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lote_id     uuid,
  tipo_lote   text,
  ip_hash     text NOT NULL,
  user_agent  text,
  encontrado  boolean NOT NULL DEFAULT false,
  bloqueado   boolean NOT NULL DEFAULT false,
  company_id  uuid,
  scanned_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qr_scan_log_ip_time
  ON public.qr_scan_log (ip_hash, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_qr_scan_log_lote
  ON public.qr_scan_log (lote_id, scanned_at DESC);

ALTER TABLE public.qr_scan_log ENABLE ROW LEVEL SECURITY;

-- Ninguém lê direto pelo PostgREST. Só a RPC (definer) escreve,
-- e o tenant lê o próprio histórico via policy abaixo.
DROP POLICY IF EXISTS "tenant_select_qr_scan_log" ON public.qr_scan_log;
CREATE POLICY "tenant_select_qr_scan_log"
  ON public.qr_scan_log FOR SELECT TO authenticated
  USING (company_id = public.get_user_company_id());

REVOKE ALL ON public.qr_scan_log FROM anon;

-- ---------------------------------------------------------------------
-- 2. Helper: hash do IP do requisitante
--    Não guardamos IP em claro (LGPD) — só um hash estável para contagem.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qr_client_ip_hash()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_headers json;
  v_ip      text;
BEGIN
  BEGIN
    v_headers := current_setting('request.headers', true)::json;
  EXCEPTION WHEN others THEN
    v_headers := NULL;
  END;

  v_ip := COALESCE(
    split_part(v_headers ->> 'x-forwarded-for', ',', 1),
    v_headers ->> 'cf-connecting-ip',
    'desconhecido'
  );

  RETURN encode(digest(COALESCE(NULLIF(trim(v_ip), ''), 'desconhecido'), 'sha256'), 'hex');
END;
$$;

-- ---------------------------------------------------------------------
-- 3. RPC pública: get_lote_publico
--    Parâmetro tipado uuid -> injeção impossível.
--    Retorna jsonb com o payload seguro, ou jsonb com erro controlado.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_lote_publico(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ip_hash    text;
  v_recentes   int;
  v_limite     int := 20;      -- scans por IP
  v_janela     interval := '1 minute';
  v_result     jsonb;
  v_company    uuid;
  v_tipo       text;
BEGIN
  v_ip_hash := public.qr_client_ip_hash();

  -- --- rate limit -----------------------------------------------------
  SELECT count(*) INTO v_recentes
  FROM public.qr_scan_log
  WHERE ip_hash = v_ip_hash
    AND scanned_at > now() - v_janela;

  IF v_recentes >= v_limite THEN
    INSERT INTO public.qr_scan_log (lote_id, ip_hash, bloqueado, encontrado)
    VALUES (p_id, v_ip_hash, true, false);

    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'RATE_LIMIT',
      'mensagem', 'Muitas consultas. Aguarde um minuto e tente novamente.'
    );
  END IF;

  -- --- lote de fornecedor (matéria-prima / insumo) ---------------------
  SELECT jsonb_build_object(
    'ok', true,
    'tipo_lote', 'FORNECEDOR',
    'id', l.id,
    'numero_lote', l.numero_lote,
    'status', l.status,
    'quantidade_recebida', l.quantidade_original,
    'unidade', l.unidade_original,
    'data_fab', l.data_fab,
    'data_val', l.data_val,
    'recebido_em', l.created_at,
    'insumo', jsonb_build_object(
      'descricao', i.descricao_interna,
      'sku', i.sku_interno,
      'armazenamento', i.armazenamento,
      'higroscopico', i.higroscopico,
      'controle_especial', i.controle_especial,
      'criticidade', i.criticidade,
      'alerta', i.texto_alerta_padrao
    ),
    'fornecedor', CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object(
      'razao_social', f.razao_social,
      'nome_fantasia', f.nome_fantasia,
      'documento', f.documento
    ) END,
    'nota_entrada', CASE WHEN ne.id IS NULL THEN NULL ELSE jsonb_build_object(
      'numero', ne.numero,
      'serie', ne.serie,
      'chave', ne.chave_nfe,
      'emissao', ne.dh_emissao
    ) END,
    'empresa', jsonb_build_object(
      'razao_social', c.razao_social,
      'nome_fantasia', c.nome_fantasia,
      'cnpj', c.cnpj,
      'licenca_sanitaria', c.licenca_sanitaria,
      'site', c.site
    ),
    'coa', (
      SELECT jsonb_build_object(
        'possui', count(*) > 0,
        'quantidade', count(*)
      )
      FROM public.lote_documentos ld
      WHERE ld.lote_id = l.id
    )
  ), l.company_id
  INTO v_result, v_company
  FROM public.estoque_lotes l
  JOIN public.itens i          ON i.id  = l.item_id
  LEFT JOIN public.entidades f ON f.id  = l.fornecedor_id
  LEFT JOIN public.company c   ON c.id  = l.company_id
  LEFT JOIN public.notas_entrada_itens nei ON nei.id = l.nota_entrada_item_id
  LEFT JOIN public.notas_entrada ne        ON ne.id  = nei.nota_entrada_id
  WHERE l.id = p_id;

  IF v_result IS NOT NULL THEN
    v_tipo := 'FORNECEDOR';
  ELSE
    -- --- lote de produto acabado --------------------------------------
    SELECT jsonb_build_object(
      'ok', true,
      'tipo_lote', 'ACABADO',
      'id', pa.id,
      'numero_lote', pa.numero_lote,
      'status', pa.status,
      'produto_nome', pa.produto_nome,
      'produto_codigo', pa.produto_codigo,
      'data_fab', pa.data_fabricacao,
      'data_val', pa.data_validade,
      'quantidade_produzida', pa.quantidade_produzida,
      'rt', jsonb_build_object(
        'nome', pa.rt_nome,
        'conselho', pa.rt_tipo_conselho,
        'registro', pa.rt_numero_registro,
        'uf', pa.rt_uf_conselho
      )
    )
    INTO v_result
    FROM public.lotes_produto_acabado pa
    WHERE pa.id = p_id OR pa.qr_code_hash = p_id::text;

    v_tipo := 'ACABADO';
  END IF;

  -- --- registra o scan -------------------------------------------------
  INSERT INTO public.qr_scan_log (lote_id, tipo_lote, ip_hash, user_agent, encontrado, company_id)
  VALUES (
    p_id,
    v_tipo,
    v_ip_hash,
    left(COALESCE((current_setting('request.headers', true)::json) ->> 'user-agent', ''), 300),
    v_result IS NOT NULL,
    v_company
  );

  IF v_result IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'erro', 'NAO_ENCONTRADO',
      'mensagem', 'Lote não localizado. Verifique o código ou contate o fabricante.'
    );
  END IF;

  RETURN v_result;
END;
$$;

-- Só a RPC é exposta ao anônimo. As tabelas continuam fechadas.
REVOKE ALL ON FUNCTION public.get_lote_publico(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_lote_publico(uuid) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.qr_client_ip_hash() FROM anon, public;

COMMENT ON FUNCTION public.get_lote_publico(uuid) IS
  'Retorno público de rastreabilidade de lote (QR da etiqueta). Payload restrito: '
  'sem custo, sem saldo de estoque, sem dados de cliente. Rate limit por IP.';

-- ---------------------------------------------------------------------
-- 4. Métrica: quantas vezes cada lote foi escaneado (para o tenant)
-- ---------------------------------------------------------------------
DROP VIEW IF EXISTS public.vw_lote_scans;
CREATE VIEW public.vw_lote_scans WITH (security_invoker = true) AS
SELECT
  lote_id,
  company_id,
  count(*) FILTER (WHERE encontrado)  AS scans_ok,
  count(*) FILTER (WHERE bloqueado)   AS scans_bloqueados,
  max(scanned_at)                     AS ultimo_scan
FROM public.qr_scan_log
WHERE lote_id IS NOT NULL
GROUP BY lote_id, company_id;

REVOKE ALL ON public.vw_lote_scans FROM anon;
GRANT SELECT ON public.vw_lote_scans TO authenticated;
