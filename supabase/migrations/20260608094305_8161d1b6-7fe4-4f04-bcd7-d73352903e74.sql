CREATE POLICY "saas_upload_criativo" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'brainx-parceiros' AND (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','saas_owner','saas_suporte','saas_financeiro'))));
CREATE POLICY "public_view_criativo" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'brainx-parceiros');
CREATE POLICY "anon_view_criativo" ON storage.objects FOR SELECT TO anon USING (bucket_id = 'brainx-parceiros');
