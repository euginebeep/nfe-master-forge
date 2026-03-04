DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_upload_erp_files' AND tablename = 'objects') THEN
    CREATE POLICY "auth_upload_erp_files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'erp-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_read_erp_files' AND tablename = 'objects') THEN
    CREATE POLICY "auth_read_erp_files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'erp-files');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'auth_delete_erp_files' AND tablename = 'objects') THEN
    CREATE POLICY "auth_delete_erp_files" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'erp-files');
  END IF;
END $$;