
-- =============================================
-- 1. FIX STORAGE POLICIES: erp-files (require authentication)
-- =============================================
DROP POLICY IF EXISTS "Allow all uploads to erp-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow all reads from erp-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow all updates to erp-files" ON storage.objects;
DROP POLICY IF EXISTS "Allow all deletes from erp-files" ON storage.objects;

CREATE POLICY "Authenticated uploads to erp-files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'erp-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated reads from erp-files"
ON storage.objects FOR SELECT
USING (bucket_id = 'erp-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated updates to erp-files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'erp-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admin deletes from erp-files"
ON storage.objects FOR DELETE
USING (bucket_id = 'erp-files' AND public.has_role(auth.uid(), 'admin'));

-- =============================================
-- 2. FIX SECURITY DEFINER VIEW → SECURITY INVOKER
-- =============================================
DROP VIEW IF EXISTS public.vw_anvisa_constituintes_completo;

CREATE VIEW public.vw_anvisa_constituintes_completo
WITH (security_invoker = on) AS
SELECT 
  id, nome_tecnico, nome_generico,
  array_to_string(nome_popular, ', ') AS nomes_populares,
  categoria, subcategoria, fonte_de, cas_number,
  limites_19_mais ->> 'min' AS dose_min_adulto,
  limites_19_mais ->> 'max' AS dose_max_adulto,
  limites_19_mais ->> 'unidade' AS unidade_adulto,
  limites_gestantes ->> 'min' AS dose_min_gestante,
  limites_gestantes ->> 'max' AS dose_max_gestante,
  array_to_string(alegacoes, ' | ') AS alegacoes,
  array_to_string(advertencias, ' | ') AS advertencias,
  array_to_string(rotulagem_complementar, ' | ') AS rotulagem,
  array_to_string(grupos_permitidos, ', ') AS grupos_permitidos,
  array_to_string(grupos_nao_autorizados, ', ') AS grupos_nao_autorizados,
  restricoes_uso, norma_inclusao, norma_ultima_alteracao,
  anexo_origem, is_proibido, motivo_proibicao, ativo
FROM anvisa_constituintes c
WHERE ativo = true
ORDER BY nome_tecnico;

-- =============================================
-- 3. FIX FUNCTIONS WITHOUT search_path
-- =============================================
CREATE OR REPLACE FUNCTION public.update_ranking_fornecedores_timestamp()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_hash_auditoria(dados jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN encode(digest(dados::TEXT, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_compatibilidade_rt(p_tipo_conselho tipo_conselho_profissional, p_tipo_produto text)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  CASE p_tipo_produto
    WHEN 'CAPSULA' THEN RETURN p_tipo_conselho IN ('CRF', 'CRQ');
    WHEN 'CRITICO' THEN RETURN p_tipo_conselho IN ('CRQ', 'CRF');
    ELSE RETURN p_tipo_conselho IN ('CRN', 'CRQ', 'CRF');
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.rt_valido_para_producao(p_rt_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE v_status TEXT; v_validade DATE;
BEGIN
  SELECT status, validade_registro INTO v_status, v_validade
  FROM public.responsaveis_tecnicos WHERE id = p_rt_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  RETURN v_status = 'ATIVO' AND v_validade >= CURRENT_DATE;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_hash_qr_code_op(p_op_id uuid, p_lote_pa text, p_secret text DEFAULT 'LOVABLE_OP_MASTER_SECRET_2026')
RETURNS text LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
BEGIN
  RETURN encode(hmac(p_op_id::TEXT || ':' || p_lote_pa || ':' || now()::TEXT, p_secret, 'sha256'), 'hex');
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_gerar_qr_hash_op()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.qr_code_hash IS NULL THEN
    NEW.qr_code_hash := public.gerar_hash_qr_code_op(NEW.id, NEW.lote_produto_acabado);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.validar_qr_code_op(p_op_id uuid, p_hash text)
RETURNS boolean LANGUAGE plpgsql STABLE
SET search_path = public
AS $$
DECLARE v_stored_hash TEXT;
BEGIN
  SELECT qr_code_hash INTO v_stored_hash FROM public.ordens_producao_industrial WHERE id = p_op_id;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  RETURN v_stored_hash = p_hash;
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_codigo_orcamento()
RETURNS text LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE ano INTEGER; seq INTEGER;
BEGIN
  ano := EXTRACT(YEAR FROM CURRENT_DATE);
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 5 FOR 4) AS INTEGER)), 0) + 1
  INTO seq FROM public.orcamentos WHERE codigo LIKE 'ORC-' || ano || '-%';
  RETURN 'ORC-' || ano || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.gerar_codigo_pedido()
RETURNS text LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE ano INTEGER; seq INTEGER;
BEGIN
  ano := EXTRACT(YEAR FROM CURRENT_DATE);
  SELECT COALESCE(MAX(CAST(SUBSTRING(codigo FROM 5 FOR 4) AS INTEGER)), 0) + 1
  INTO seq FROM public.pedidos_venda WHERE codigo LIKE 'PED-' || ano || '-%';
  RETURN 'PED-' || ano || '-' || LPAD(seq::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_constituinte_search_vector()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('portuguese', COALESCE(NEW.nome_tecnico, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.nome_generico, '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.nome_popular, ' '), '')), 'A') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.sinonimos, ' '), '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.fonte_de, '')), 'B') ||
    setweight(to_tsvector('portuguese', COALESCE(NEW.subcategoria, '')), 'C') ||
    setweight(to_tsvector('portuguese', COALESCE(array_to_string(NEW.alegacoes, ' '), '')), 'C');
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.buscar_constituinte_por_nome_popular(termo_busca text)
RETURNS SETOF anvisa_constituintes LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  RETURN QUERY SELECT c.* FROM public.anvisa_constituintes c
  WHERE c.ativo = TRUE AND (
    EXISTS (SELECT 1 FROM unnest(c.nome_popular) AS np WHERE lower(unaccent(np)) LIKE '%' || lower(unaccent(termo_busca)) || '%') OR
    EXISTS (SELECT 1 FROM unnest(c.sinonimos) AS s WHERE lower(unaccent(s)) LIKE '%' || lower(unaccent(termo_busca)) || '%')
  ) LIMIT 20;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_sku()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.sku_interno IS NULL OR NEW.sku_interno = '' THEN
    NEW.sku_interno := UPPER(LEFT(NEW.tipo_item, 2)) || '-' || 
                       TO_CHAR(now(), 'YYMM') || '-' ||
                       LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_entidade_codigo()
RETURNS trigger LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_interno IS NULL OR NEW.codigo_interno = '' THEN
    NEW.codigo_interno := 'ENT-' || LPAD(nextval('entidades_codigo_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;
