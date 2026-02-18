import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { User, Session } from '@supabase/supabase-js';

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador';
type AppDepartamento = 'DIRETORIA' | 'COMERCIAL' | 'COMPRAS' | 'FINANCEIRO' | 'ESTOQUE' | 'PRODUCAO' | 'QUALIDADE' | 'RH' | 'TI';

export interface UserProfile {
  id: string;
  nome_completo: string;
  cargo: string | null;
  departamento: AppDepartamento | null;
  avatar_url: string | null;
  telefone: string | null;
  sexo: 'MASCULINO' | 'FEMININO' | 'NAO_INFORMADO' | null;
  data_nascimento: string | null;
}

export interface UserPermission {
  modulo: string;
  pode_visualizar: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
}

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  permissions: UserPermission[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    permissions: [],
    isLoading: true,
    isAuthenticated: false,
  });
  const navigate = useNavigate();

  // Fetch user profile, role and permissions
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile, role, and permissions in parallel
      const [profileRes, roleRes, permissionsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.rpc('get_user_role', { _user_id: userId }),
        supabase.from('user_permissions').select('*').eq('user_id', userId),
      ]);

      if (profileRes.error && profileRes.error.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileRes.error);
      }
      if (roleRes.error) {
        console.error('Error fetching role:', roleRes.error);
      }

      const role = (roleRes.data as AppRole) || 'visualizador';
      const permissions: UserPermission[] = (permissionsRes.data || []).map((p: any) => ({
        modulo: p.modulo,
        pode_visualizar: p.pode_visualizar ?? false,
        pode_criar: p.pode_criar ?? false,
        pode_editar: p.pode_editar ?? false,
        pode_excluir: p.pode_excluir ?? false,
      }));

      return {
        profile: profileRes.data as UserProfile | null,
        role,
        permissions,
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { profile: null, role: 'visualizador' as AppRole, permissions: [] };
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setTimeout(async () => {
            if (!mounted) return;
            const { profile, role, permissions } = await fetchUserData(session.user.id);
            setState({
              user: session.user,
              session,
              profile,
              role,
              permissions,
              isLoading: false,
              isAuthenticated: true,
            });
          }, 0);
        } else {
          setState({
            user: null,
            session: null,
            profile: null,
            role: null,
            permissions: [],
            isLoading: false,
            isAuthenticated: false,
          });
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (session?.user) {
        const { profile, role, permissions } = await fetchUserData(session.user.id);
        setState({
          user: session.user,
          session,
          profile,
          role,
          permissions,
          isLoading: false,
          isAuthenticated: true,
        });
      } else {
        setState(prev => ({ ...prev, isLoading: false }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    toast.success('Cadastro realizado! Verifique seu email para confirmar.');
    return { data };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      toast.error(error.message);
      return { error };
    }

    toast.success('Login realizado com sucesso!');
    navigate('/');
    return { data };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return { error };
    }
    navigate('/auth');
    return {};
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!state.user) return { error: new Error('Not authenticated') };

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', state.user.id)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao atualizar perfil');
      return { error };
    }

    setState(prev => ({ ...prev, profile: data as UserProfile }));
    toast.success('Perfil atualizado!');
    return { data };
  };

  const hasRole = (role: AppRole): boolean => {
    if (!state.role) return false;
    const roleHierarchy: AppRole[] = ['admin', 'gerente', 'supervisor', 'operador', 'visualizador'];
    const userRoleIndex = roleHierarchy.indexOf(state.role);
    const requiredRoleIndex = roleHierarchy.indexOf(role);
    return userRoleIndex <= requiredRoleIndex;
  };

  /**
   * Verifica se o usuário pode visualizar um módulo.
   * Admin sempre tem acesso total.
   * Outros roles precisam ter `pode_visualizar = true` nas permissões.
   */
  const canView = (modulo: string): boolean => {
    if (state.role === 'admin') return true;
    const perm = state.permissions.find(p => p.modulo === modulo);
    return perm?.pode_visualizar ?? false;
  };

  /**
   * Verifica se o usuário pode criar registros em um módulo.
   */
  const canCreate = (modulo: string): boolean => {
    if (state.role === 'admin') return true;
    const perm = state.permissions.find(p => p.modulo === modulo);
    return perm?.pode_criar ?? false;
  };

  /**
   * Verifica se o usuário pode editar registros em um módulo.
   */
  const canEdit = (modulo: string): boolean => {
    if (state.role === 'admin') return true;
    const perm = state.permissions.find(p => p.modulo === modulo);
    return perm?.pode_editar ?? false;
  };

  /**
   * Verifica se o usuário pode excluir registros em um módulo.
   */
  const canDelete = (modulo: string): boolean => {
    if (state.role === 'admin') return true;
    const perm = state.permissions.find(p => p.modulo === modulo);
    return perm?.pode_excluir ?? false;
  };

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    updateProfile,
    hasRole,
    canView,
    canCreate,
    canEdit,
    canDelete,
    refetchProfile: () => state.user && fetchUserData(state.user.id),
  };
}
