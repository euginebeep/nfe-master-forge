import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

function maskCNPJ(cnpj: string) {
  const d = (cnpj || '').replace(/\D/g, '').padEnd(14, ' ').slice(0, 14);
  if (d.replace(/\s/g, '').length !== 14) return cnpj;
  return `${d.slice(0,2)}.***.***/${d.slice(8,12)}-${d.slice(12,14)}`;
}

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
      let message = result.error.message;
      if (message.includes('Password is known to be weak')) {
        message = 'Esta senha é muito simples ou comum. Por favor, escolha uma senha mais forte (use letras, números e símbolos).';
      }
      toast.error(message);
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
      let message = result.error.message;
      let description = undefined;

      if (message === 'Invalid login credentials') {
        message = 'Acesso Negado';
        description = 'E-mail ou senha incorretos. Por favor, verifique seus dados e tente novamente.';
      } else if (message.includes('Email not confirmed')) {
        message = 'E-mail Não Confirmado';
        description = 'Sua conta ainda não foi ativada. Verifique sua caixa de entrada para o link de confirmação.';
      } else if (message.includes('Too many requests')) {
        message = 'Muitas Tentativas';
        description = 'Acesso bloqueado temporariamente por segurança. Tente novamente em alguns minutos.';
      }

      toast.error(message, description as any);
      return result;
    }
    // Confirmação visual: mostrar empresa vinculada (após autenticação)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles').select('company_id').eq('id', user.id).maybeSingle();
        if (profile?.company_id) {
          const { data: company } = await supabase
            .from('companies')
            .select('razao_social, nome_fantasia, cnpj')
            .eq('id', profile.company_id)
            .maybeSingle();
          if (company) {
            toast.success(
              `Conectado em: ${company.nome_fantasia || company.razao_social}`,
              { description: `CNPJ ${maskCNPJ(company.cnpj || '')}`, duration: 5000 }
            );
          } else {
            toast.success('Login realizado com sucesso!');
          }
        } else {
          toast.success('Login realizado! Configure sua empresa para começar.');
        }
      } else {
        toast.success('Login realizado com sucesso!');
      }
    } catch {
      toast.success('Login realizado com sucesso!');
    }
    navigate('/dashboard');
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
