-- Laudo emitido nao pode ser reescrito nem apagado. Unica alteracao permitida:
-- a trilha de validade (status_validacao / invalidado_*), que e append-only.

DROP POLICY IF EXISTS company_isolation ON public.anvisa_laudos;

CREATE POLICY anvisa_laudos_select ON public.anvisa_laudos
  FOR SELECT TO authenticated
  USING (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()));

CREATE POLICY anvisa_laudos_insert ON public.anvisa_laudos
  FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()));

-- UPDATE permitido pela policy, mas restringido pelo trigger abaixo.
CREATE POLICY anvisa_laudos_update_validade ON public.anvisa_laudos
  FOR UPDATE TO authenticated
  USING (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()))
  WITH CHECK (company_id = (SELECT p.company_id FROM profiles p WHERE p.id = auth.uid()));

-- Sem policy de DELETE: authenticated nao apaga laudo. service_role ainda pode.

CREATE OR REPLACE FUNCTION public.anvisa_laudo_imutavel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'laudo_imutavel: laudo emitido nao pode ser apagado. '
      'Use status_validacao = INVALIDADO.';
  END IF;

  -- Conteudo do laudo e congelado. So a trilha de validade pode mudar.
  IF NEW.produto        IS DISTINCT FROM OLD.produto
  OR NEW.resultado_ia   IS DISTINCT FROM OLD.resultado_ia
  OR NEW.payload_entrada IS DISTINCT FROM OLD.payload_entrada
  OR NEW.status_geral   IS DISTINCT FROM OLD.status_geral
  OR NEW.company_id     IS DISTINCT FROM OLD.company_id
  OR NEW.criado_em      IS DISTINCT FROM OLD.criado_em
  OR NEW.rt_nome        IS DISTINCT FROM OLD.rt_nome
  OR NEW.rt_crf         IS DISTINCT FROM OLD.rt_crf THEN
    RAISE EXCEPTION 'laudo_imutavel: conteudo do laudo % nao pode ser alterado apos '
      'a emissao. Emita um novo laudo e invalide este.', OLD.id;
  END IF;

  -- Invalidacao e irreversivel: nao volta para PRELIMINAR nem VALIDADO_RT.
  IF OLD.status_validacao = 'INVALIDADO'
     AND NEW.status_validacao IS DISTINCT FROM 'INVALIDADO' THEN
    RAISE EXCEPTION 'laudo_imutavel: laudo invalidado nao volta a valer.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_anvisa_laudo_imutavel ON public.anvisa_laudos;
CREATE TRIGGER trg_anvisa_laudo_imutavel
  BEFORE UPDATE OR DELETE ON public.anvisa_laudos
  FOR EACH ROW EXECUTE FUNCTION public.anvisa_laudo_imutavel();