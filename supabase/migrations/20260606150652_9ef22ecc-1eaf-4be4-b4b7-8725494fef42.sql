ALTER TABLE public.op_checklist ADD COLUMN IF NOT EXISTS codigo TEXT;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.op_checklist TO authenticated;
GRANT ALL ON public.op_checklist TO service_role;