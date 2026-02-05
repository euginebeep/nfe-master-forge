
-- Create table for module permissions per user
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  modulo text NOT NULL,
  pode_visualizar boolean DEFAULT false,
  pode_criar boolean DEFAULT false,
  pode_editar boolean DEFAULT false,
  pode_excluir boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, modulo)
);

-- Enable RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage all permissions"
ON public.user_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Users can view their own permissions
CREATE POLICY "Users can view own permissions"
ON public.user_permissions
FOR SELECT
USING (auth.uid() = user_id);

-- Create function to check module permission
CREATE OR REPLACE FUNCTION public.has_module_permission(
  _user_id uuid,
  _modulo text,
  _permission text DEFAULT 'visualizar'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      -- Admin has full access
      WHEN has_role(_user_id, 'admin') THEN true
      WHEN _permission = 'visualizar' THEN COALESCE((SELECT pode_visualizar FROM user_permissions WHERE user_id = _user_id AND modulo = _modulo), false)
      WHEN _permission = 'criar' THEN COALESCE((SELECT pode_criar FROM user_permissions WHERE user_id = _user_id AND modulo = _modulo), false)
      WHEN _permission = 'editar' THEN COALESCE((SELECT pode_editar FROM user_permissions WHERE user_id = _user_id AND modulo = _modulo), false)
      WHEN _permission = 'excluir' THEN COALESCE((SELECT pode_excluir FROM user_permissions WHERE user_id = _user_id AND modulo = _modulo), false)
      ELSE false
    END
$$;

-- Add status column to profiles if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'status') THEN
    ALTER TABLE public.profiles ADD COLUMN status text DEFAULT 'ATIVO';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'ultimo_acesso') THEN
    ALTER TABLE public.profiles ADD COLUMN ultimo_acesso timestamptz;
  END IF;
END $$;
