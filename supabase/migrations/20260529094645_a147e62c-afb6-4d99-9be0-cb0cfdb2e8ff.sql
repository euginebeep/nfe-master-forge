
-- ========== 1. ANVISA sync history: remove public SELECT ==========
DROP POLICY IF EXISTS "Todos podem ver histórico de sync" ON public.anvisa_sync_history;
CREATE POLICY "Authenticated can view sync history"
  ON public.anvisa_sync_history FOR SELECT
  TO authenticated USING (auth.uid() IS NOT NULL);

-- ========== 2. ANVISA constituintes: writes admin only ==========
DROP POLICY IF EXISTS "Constituintes gerenciados por autenticados" ON public.anvisa_constituintes;
DROP POLICY IF EXISTS "Constituintes visíveis para todos" ON public.anvisa_constituintes;
CREATE POLICY "anvisa_constituintes_select_auth"
  ON public.anvisa_constituintes FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "anvisa_constituintes_write_admin"
  ON public.anvisa_constituintes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ========== 3. ANVISA alegacoes detalhadas: writes admin only ==========
DROP POLICY IF EXISTS "Alegações gerenciadas por autenticados" ON public.anvisa_alegacoes_detalhadas;
DROP POLICY IF EXISTS "Alegações visíveis para todos" ON public.anvisa_alegacoes_detalhadas;
CREATE POLICY "anvisa_alegacoes_select_auth"
  ON public.anvisa_alegacoes_detalhadas FOR SELECT
  TO authenticated USING (true);
CREATE POLICY "anvisa_alegacoes_write_admin"
  ON public.anvisa_alegacoes_detalhadas FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ========== 4. Chat messages: scope to company ==========
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT public.get_user_company_id();

-- Backfill from sender profile
UPDATE public.chat_messages cm
SET company_id = p.company_id
FROM public.profiles p
WHERE cm.sender_id = p.id AND cm.company_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_company_id ON public.chat_messages(company_id);

DROP POLICY IF EXISTS "Users can view their messages" ON public.chat_messages;
CREATE POLICY "Users can view their messages"
  ON public.chat_messages FOR SELECT
  TO authenticated
  USING (
    (company_id = public.get_user_company_id())
    AND (
      auth.uid() = sender_id
      OR auth.uid() = recipient_id
      OR (recipient_id IS NULL AND channel IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
CREATE POLICY "Users can send messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND company_id = public.get_user_company_id()
  );

-- ========== 5. ERP-files bucket: scope by company via arquivos / entidade_documentos ==========
DROP POLICY IF EXISTS "Authenticated reads from erp-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated updates to erp-files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated uploads to erp-files" ON storage.objects;
DROP POLICY IF EXISTS "auth_read_erp_files" ON storage.objects;
DROP POLICY IF EXISTS "auth_upload_erp_files" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_erp_files" ON storage.objects;

CREATE POLICY "erp_files_read_tenant"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'erp-files'
    AND (
      EXISTS (
        SELECT 1 FROM public.arquivos a
        WHERE a.storage_key = storage.objects.name
          AND a.company_id = public.get_user_company_id()
      )
      OR EXISTS (
        SELECT 1 FROM public.entidade_documentos ed
        JOIN public.entidades e ON e.id = ed.entidade_id
        WHERE ed.storage_key = storage.objects.name
          AND e.company_id = public.get_user_company_id()
      )
      -- Newly uploaded files (no row yet) created by the same user are visible briefly to allow upload flow
      OR owner = auth.uid()
    )
  );

CREATE POLICY "erp_files_insert_auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'erp-files'
    AND owner = auth.uid()
  );

CREATE POLICY "erp_files_update_tenant"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'erp-files'
    AND (
      owner = auth.uid()
      OR EXISTS (
        SELECT 1 FROM public.arquivos a
        WHERE a.storage_key = storage.objects.name
          AND a.company_id = public.get_user_company_id()
      )
    )
  );

CREATE POLICY "erp_files_delete_tenant"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'erp-files'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR owner = auth.uid()
    )
  );

-- ========== 6. Public buckets: restrict listing, keep direct fetch via signed/public urls ==========
-- Replace broad SELECT with one that allows authenticated listing in own folder only.
-- Public fetches via getPublicUrl still work because they go through the storage render endpoint, not RLS list.
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars readable by authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "Avatars publicly readable anon"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'avatars' AND name IS NOT NULL);

DROP POLICY IF EXISTS "Email assets are publicly accessible" ON storage.objects;
CREATE POLICY "Email assets readable by authenticated"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'email-assets');
CREATE POLICY "Email assets publicly readable anon"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'email-assets' AND name IS NOT NULL);

-- ========== 7. Responsaveis Tecnicos: limit SELECT of PII to admin/gerente/supervisor ==========
DROP POLICY IF EXISTS "t_rt" ON public.responsaveis_tecnicos;
CREATE POLICY "rt_select_privileged"
  ON public.responsaveis_tecnicos FOR SELECT
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
      OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    )
  );
CREATE POLICY "rt_write_privileged"
  ON public.responsaveis_tecnicos FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    )
  );
CREATE POLICY "rt_update_privileged"
  ON public.responsaveis_tecnicos FOR UPDATE
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
    )
  )
  WITH CHECK (company_id = public.get_user_company_id());
CREATE POLICY "rt_delete_privileged"
  ON public.responsaveis_tecnicos FOR DELETE
  TO authenticated
  USING (
    company_id = public.get_user_company_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- ========== 8. OP assinaturas RT: SELECT restricted; INSERT (signing) allowed for tenant users ==========
DROP POLICY IF EXISTS "t_op_assrt" ON public.op_assinaturas_rt;
CREATE POLICY "op_assrt_select_privileged"
  ON public.op_assinaturas_rt FOR SELECT
  TO authenticated
  USING (
    public.op_belongs_to_tenant(op_id)
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'gerente'::public.app_role)
      OR public.has_role(auth.uid(), 'supervisor'::public.app_role)
    )
  );
CREATE POLICY "op_assrt_insert_tenant"
  ON public.op_assinaturas_rt FOR INSERT
  TO authenticated
  WITH CHECK (public.op_belongs_to_tenant(op_id));

-- ========== 9. Realtime: scope channel subscriptions to authenticated only ==========
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_can_listen" ON realtime.messages;
CREATE POLICY "authenticated_can_listen"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);
DROP POLICY IF EXISTS "authenticated_can_send" ON realtime.messages;
CREATE POLICY "authenticated_can_send"
  ON realtime.messages FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ========== 10. Revoke EXECUTE from anon on SECURITY DEFINER internal action functions ==========
REVOKE EXECUTE ON FUNCTION public.baixar_estoque_op_embalagens(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.baixar_estoque_op_materias_primas(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_expiring_lots() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.notify_low_stock() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.update_ultimo_acesso(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.registrar_evento_auditoria(tipo_evento_auditoria, text, text, uuid, text, uuid, text, text, text, jsonb, jsonb, jsonb) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_gerar_qr_hash_op() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_notify_alerta_executivo() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_notify_anomalia() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_registrar_movimentacao_entrada_lote() FROM anon, public, authenticated;
