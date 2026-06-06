import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import { registrarAuditoria } from '@/lib/audit-logger';
import { queryClient } from '@/lib/query-client';

type AppRole = 'admin' | 'gerente' | 'supervisor' | 'operador' | 'visualizador';
type AppDepartamento = 'DIRETORIA' | 'COMERCIAL' | 'COMPRAS' | 'FINANCEIRO' | 'ESTOQUE' | 'PRODUCAO' | 'QUALIDADE' | 'RH' | 'TI';

export interface UserProfile {
  id: string;
  nome_completo: string;
  company_id: string | null;
  cargo: string | null;
  departamento: AppDepartamento | null;
  avatar_url: string | null;
  telefone: string | null;
  sexo: 'MASCULINO' | 'FEMININO' | 'NAO_INFORMADO' | null;
  data_nascimento: string | null;
  is_demo?: boolean;
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

interface AuthContextValue extends AuthState {
  signUp: (email: string, password: string, fullName: string) => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<any>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<any>;
  hasRole: (role: AppRole) => boolean;
  canView: (modulo: string) => boolean;
  canCreate: (modulo: string) => boolean;
  canEdit: (modulo: string) => boolean;
  canDelete: (modulo: string) => boolean;
  refetchProfile: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    role: null,
    permissions: [],
    isLoading: true,
    isAuthenticated: false,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    try {
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

      return { profile: profileRes.data as UserProfile | null, role, permissions };
    } catch (error) {
      console.error('Error fetching user data:', error);
      return { profile: null, role: 'visualizador' as AppRole, permissions: [] };
    }
  }, []);

  const updateLastAccess = async (userId: string) => {
    try {
      await supabase.rpc('update_ultimo_acesso', { p_user_id: userId });
    } catch {
      // silent
    }
  };

  useEffect(() => {
    let mounted = true;
    let initialLoaded = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        // Skip if initial load handles it
        if (!initialLoaded) return;

        if (session?.user) {
          queryClient.removeQueries({ queryKey: ['company'] });
          queryClient.removeQueries({ queryKey: ['user-company-id'] });
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            if (!mounted) return;
            if (event === 'SIGNED_IN') {
              await updateLastAccess(session.user.id);
            }
            const { profile, role, permissions } = await fetchUserData(session.user.id);
            if (!mounted) return;
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
          queryClient.clear();
          setState({
            user: null, session: null, profile: null, role: null,
            permissions: [], isLoading: false, isAuthenticated: false,
          });
        }
      }
    );

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;

        if (session?.user) {
          const { profile, role, permissions } = await fetchUserData(session.user.id);
          if (!mounted) return;

          // Aplicar mesma detecção de demo do onAuthStateChange
          const isDemoPersistedInit = sessionStorage.getItem('brainx_demo_mode') === 'true';
          const isDemoEmailInit = session.user.email === 'demo@brainxerp.com';
          const isDemoInit = (profile?.is_demo || isDemoPersistedInit || isDemoEmailInit) && !profile?.company_id;

          if (isDemoInit) {
            sessionStorage.setItem('brainx_demo_mode', 'true');
          } else if (!isDemoInit && !profile?.company_id) {
            sessionStorage.removeItem('brainx_demo_mode');
          }

          const finalProfileInit = profile ? { ...profile, is_demo: isDemoInit } : null;

          setState({
            user: session.user, session,
            profile: finalProfileInit,
            role, permissions,
            isLoading: false, isAuthenticated: true,
          });
        } else {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      } catch {
        if (mounted) setState(prev => ({ ...prev, isLoading: false }));
      } finally {
        initialLoaded = true;
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
    });
    if (error) return { error };
    const isRepeated = data?.user?.identities?.length === 0;
    if (isRepeated) return { data, repeated: true };
    return { data };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error };
    queryClient.removeQueries({ queryKey: ['company'] });
    queryClient.removeQueries({ queryKey: ['user-company-id'] });
    if (data.session?.user) {
      await updateLastAccess(data.session.user.id);
      const { profile, role, permissions } = await fetchUserData(data.session.user.id);
      setState({
        user: data.session.user,
        session: data.session,
        profile,
        role,
        permissions,
        isLoading: false,
        isAuthenticated: true,
      });
    }
    // Fire-and-forget audit
    if (data.user) {
      registrarAuditoria({
        tipo: 'LOGIN_REALIZADO',
        descricao: `Login realizado por ${email}`,
        entidade_tipo: 'Usuario',
        entidade_id: data.user.id,
      });
    }
    return { data };
  };

  const signOut = async () => {
    const userId = state.user?.id;
    if (userId) {
      registrarAuditoria({
        tipo: 'LOGOUT_REALIZADO',
        descricao: 'Logout realizado',
        entidade_tipo: 'Usuario',
        entidade_id: userId,
      });
    }
    const { error } = await supabase.auth.signOut();
    if (error) return { error };
    queryClient.clear();
    return {};
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!state.user) return { error: new Error('Not authenticated') };
    const { data, error } = await supabase
      .from('profiles').update(updates).eq('id', state.user.id).select().single();
    if (error) return { error };
    setState(prev => ({ ...prev, profile: data as UserProfile }));
    return { data };
  };

  const hasRole = (role: AppRole): boolean => {
    if (!state.role) return false;
    const h: AppRole[] = ['admin', 'gerente', 'supervisor', 'operador', 'visualizador'];
    return h.indexOf(state.role) <= h.indexOf(role);
  };

  const canView = (modulo: string): boolean => {
    if (state.role === 'admin') return true;
    if (state.isLoading) return true;
    return state.permissions.find(p => p.modulo === modulo)?.pode_visualizar ?? false;
  };

  const canCreate = (modulo: string): boolean => {
    if (state.role === 'admin') return true;
    return state.permissions.find(p => p.modulo === modulo)?.pode_criar ?? false;
  };

  const canEdit = (modulo: string): boolean => {
    if (state.role === 'admin') return true;
    return state.permissions.find(p => p.modulo === modulo)?.pode_editar ?? false;
  };

  const canDelete = (modulo: string): boolean => {
    if (state.role === 'admin') return true;
    return state.permissions.find(p => p.modulo === modulo)?.pode_excluir ?? false;
  };

  const refetchProfile = () => {
    if (state.user) {
      fetchUserData(state.user.id).then(({ profile, role, permissions }) => {
        setState(prev => ({ ...prev, profile, role, permissions }));
      });
    }
  };

  return (
    <AuthContext.Provider value={{
      ...state, signUp, signIn, signOut, updateProfile,
      hasRole, canView, canCreate, canEdit, canDelete, refetchProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuthContext must be used within AuthProvider');
  return ctx;
}
