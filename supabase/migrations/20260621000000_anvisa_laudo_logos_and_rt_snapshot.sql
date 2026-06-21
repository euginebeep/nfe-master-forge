-- ============================================================
-- PASSO 1 — PROMPT MASTER LaudoANVISA
-- 1. Bucket de storage para logos de clientes do laudo ANVISA
-- 2. Persistir logo do cliente e snapshot do RT em cada laudo
-- ============================================================

-- 1. Bucket público para logos de clientes do laudo ANVISA
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'anvisa-laudo-logos',
  'anvisa-laudo-logos',
  true,
  2097152,
  ARRAY['image/png','image/jpeg','image/jpg','image/webp','image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- Policies do bucket
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'authenticated_upload_laudo_logo'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "authenticated_upload_laudo_logo" ON storage.objects
        FOR INSERT WITH CHECK (bucket_id = 'anvisa-laudo-logos' AND auth.uid() IS NOT NULL)
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'public_view_laudo_logo'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "public_view_laudo_logo" ON storage.objects
        FOR SELECT USING (bucket_id = 'anvisa-laudo-logos')
    $policy$;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'authenticated_delete_own_laudo_logo'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "authenticated_delete_own_laudo_logo" ON storage.objects
        FOR DELETE USING (bucket_id = 'anvisa-laudo-logos' AND auth.uid() IS NOT NULL)
    $policy$;
  END IF;
END $$;

-- 2. Persistir logo do cliente e snapshot do RT em cada laudo gerado
ALTER TABLE public.anvisa_laudos
  ADD COLUMN IF NOT EXISTS cliente_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS cliente_nome_exibicao TEXT,
  ADD COLUMN IF NOT EXISTS rt_id UUID REFERENCES public.responsaveis_tecnicos(id),
  ADD COLUMN IF NOT EXISTS rt_nome_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS rt_registro_snapshot TEXT;
