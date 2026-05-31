
-- 1) Add new ciphertext column + status flag
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS smtp_pass_ciphertext bytea;
ALTER TABLE public.company ADD COLUMN IF NOT EXISTS smtp_pass_set boolean
  GENERATED ALWAYS AS (smtp_pass_ciphertext IS NOT NULL) STORED;

-- 2) Clear legacy plaintext passwords (they were stored unencrypted - security fix)
UPDATE public.company SET smtp_pass_encrypted = NULL WHERE smtp_pass_encrypted IS NOT NULL;

-- 3) Bootstrap encryption key in vault (random, persistent, not exposed)
DO $$
DECLARE v_exists uuid;
BEGIN
  SELECT id INTO v_exists FROM vault.secrets WHERE name = 'smtp_pass_encryption_key' LIMIT 1;
  IF v_exists IS NULL THEN
    PERFORM vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'smtp_pass_encryption_key',
      'Symmetric key used to encrypt tenant SMTP passwords at rest'
    );
  END IF;
END $$;

-- 4) Internal helper to fetch the key (locked down)
CREATE OR REPLACE FUNCTION public._smtp_enc_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'smtp_pass_encryption_key' LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public._smtp_enc_key() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public._smtp_enc_key() FROM anon, authenticated;

-- 5) Caller-facing: tenant admin encrypts and saves their SMTP password
CREATE OR REPLACE FUNCTION public.set_company_smtp_password(p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_company_id uuid;
  v_key text;
BEGIN
  v_company_id := public.get_user_company_id();
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'no_tenant_for_user';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'forbidden_only_admin_can_change_smtp_password';
  END IF;

  v_key := public._smtp_enc_key();
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'encryption_key_unavailable';
  END IF;

  UPDATE public.company
  SET
    smtp_pass_ciphertext = CASE
      WHEN p_password IS NULL OR length(p_password) = 0 THEN NULL
      ELSE extensions.pgp_sym_encrypt(p_password, v_key)
    END,
    smtp_pass_encrypted = NULL
  WHERE id = v_company_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_company_smtp_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_company_smtp_password(text) TO authenticated;

-- 6) Backend-only: decrypt password for sending emails (service_role only)
CREATE OR REPLACE FUNCTION public.get_company_smtp_password(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ct bytea;
  v_key text;
BEGIN
  IF current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role'
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'forbidden_service_role_only';
  END IF;

  SELECT smtp_pass_ciphertext INTO v_ct FROM public.company WHERE id = p_company_id;
  IF v_ct IS NULL THEN RETURN NULL; END IF;

  v_key := public._smtp_enc_key();
  RETURN extensions.pgp_sym_decrypt(v_ct, v_key);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_company_smtp_password(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_company_smtp_password(uuid) TO service_role;

-- 7) Lock down ciphertext + legacy columns from regular clients
REVOKE SELECT (smtp_pass_encrypted, smtp_pass_ciphertext) ON public.company FROM anon, authenticated;
REVOKE UPDATE (smtp_pass_encrypted, smtp_pass_ciphertext) ON public.company FROM anon, authenticated;
REVOKE INSERT (smtp_pass_encrypted, smtp_pass_ciphertext) ON public.company FROM anon, authenticated;
