
-- Função para atualizar ultimo_acesso automaticamente via trigger no login
-- Usamos um trigger na tabela profiles que pode ser chamado pelo app

-- Cria função para atualizar ultimo_acesso
CREATE OR REPLACE FUNCTION public.update_ultimo_acesso(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles 
  SET ultimo_acesso = now()
  WHERE id = p_user_id;
END;
$$;

-- Garante que a função pode ser chamada por usuários autenticados
GRANT EXECUTE ON FUNCTION public.update_ultimo_acesso(uuid) TO authenticated;
