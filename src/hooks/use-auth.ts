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

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  role: AppRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    isLoading: true,
    isAuthenticated: false,
  });
  const navigate = useNavigate();

  // Fetch user profile and role
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      // Fetch role using the database function
      const { data: roleData, error: roleError } = await supabase
        .rpc('get_user_role', { _user_id: userId });

      if (roleError) {
        console.error('Error fetching role:', roleError);
      }

      return {
        profile: profile as UserProfile | null,
        role: (roleData as AppRole) || 'visualizador',
      };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { profile: null, role: 'visualizador' as AppRole };
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;

    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          // Defer data fetching to avoid blocking
          setTimeout(async () => {
            if (!mounted) return;
            const { profile, role } = await fetchUserData(session.user.id);
            setState({
              user: session.user,
              session,
              profile,
              role,
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
            isLoading: false,
            isAuthenticated: false,
          });
        }
      }
    );

    // Check initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;

      if (session?.user) {
        const { profile, role } = await fetchUserData(session.user.id);
        setState({
          user: session.user,
          session,
          profile,
          role,
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

  // Sign up
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

  // Sign in
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

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
      return { error };
    }
    navigate('/auth');
    return {};
  };

  // Update profile
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

  // Check if user has specific role
  const hasRole = (role: AppRole): boolean => {
    if (!state.role) return false;
    const roleHierarchy: AppRole[] = ['admin', 'gerente', 'supervisor', 'operador', 'visualizador'];
    const userRoleIndex = roleHierarchy.indexOf(state.role);
    const requiredRoleIndex = roleHierarchy.indexOf(role);
    return userRoleIndex <= requiredRoleIndex;
  };

  return {
    ...state,
    signUp,
    signIn,
    signOut,
    updateProfile,
    hasRole,
    refetchProfile: () => state.user && fetchUserData(state.user.id),
  };
}
