
ALTER TABLE public.company
  ADD COLUMN IF NOT EXISTS smtp_host text,
  ADD COLUMN IF NOT EXISTS smtp_port integer DEFAULT 465,
  ADD COLUMN IF NOT EXISTS smtp_secure boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS smtp_user text,
  ADD COLUMN IF NOT EXISTS smtp_pass_encrypted text,
  ADD COLUMN IF NOT EXISTS smtp_from_name text,
  ADD COLUMN IF NOT EXISTS smtp_from_email text;

COMMENT ON COLUMN public.company.smtp_pass_encrypted IS 'SMTP password (stored as-is; protected by RLS - only readable by tenant admins and service_role)';
