import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type { UserProfile, UserPermission, AuthState } from '@/contexts/AuthContext';

/**
 * Hook de autenticação que consome o AuthContext compartilhado.
 * Todas as chamadas de API são feitas UMA ÚNICA VEZ no AuthProvider,
 * eliminando fetches duplicados entre componentes.
 */
export function useAuth() {
  const ctx = useAuthContext();
  const navigate = useNavigate();

  const signUp = async (email: string, password: string, fullName: string) => {
    const result = await ctx.signUp(email, password, fullName);
    if (result.error) {
      toast.error(result.error.message);
      return result;
    }
    if (result.repeated) {
      toast.warning(
        'Este e-mail já está cadastrado. Verifique sua caixa de entrada (inclusive spam) para o link de confirmação.',
        { duration: 10000 }
      );
      return result;
    }
    toast.success('Cadastro realizado! Verifique seu email para confirmar.', { duration: 8000 });
    return result;
  };

  const signIn = async (email: string, password: string) => {
    const result = await ctx.signIn(email, password);
    if (result.error) {
      toast.error(result.error.message);
      return result;
    }
    toast.success('Login realizado com sucesso!');
    navigate('/');
    return result;
  };

  const signOut = async () => {
    const result = await ctx.signOut();
    if (result.error) {
      toast.error(result.error.message);
      return result;
    }
    navigate('/auth');
    return result;
  };

  const updateProfile = async (updates: any) => {
    const result = await ctx.updateProfile(updates);
    if (result.error) {
      toast.error('Erro ao atualizar perfil');
      return result;
    }
    toast.success('Perfil atualizado!');
    return result;
  };

  return {
    user: ctx.user,
    session: ctx.session,
    profile: ctx.profile,
    role: ctx.role,
    permissions: ctx.permissions,
    isLoading: ctx.isLoading,
    isAuthenticated: ctx.isAuthenticated,
    signUp,
    signIn,
    signOut,
    updateProfile,
    hasRole: ctx.hasRole,
    canView: ctx.canView,
    canCreate: ctx.canCreate,
    canEdit: ctx.canEdit,
    canDelete: ctx.canDelete,
    refetchProfile: ctx.refetchProfile,
  };
}
