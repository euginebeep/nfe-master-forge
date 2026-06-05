
-- 1. anvisa_sync_history: remove broad write policies (service_role bypasses RLS)
DROP POLICY IF EXISTS "Apenas autenticados podem criar sync" ON public.anvisa_sync_history;
DROP POLICY IF EXISTS "Apenas autenticados podem atualizar sync" ON public.anvisa_sync_history;

-- 2. avatars storage policies: enforce owner check
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete avatars" ON storage.objects;

CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid())
WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());

CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND owner = auth.uid());

-- 3. unlock_challenges: admin scoped to own tenant
DROP POLICY IF EXISTS "Admin global pode atualizar desafios" ON public.unlock_challenges;
CREATE POLICY "Admin do tenant pode atualizar desafios"
ON public.unlock_challenges FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id())
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company_id());

-- 4. sensor_readings: drop duplicate public-role policy
DROP POLICY IF EXISTS "tenant_isolation" ON public.sensor_readings;
