import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];
type AppDepartamento = Database['public']['Enums']['app_departamento'];

export interface UserWithProfile {
  id: string;
  email: string;
  nome_completo: string;
  cargo: string | null;
  departamento: AppDepartamento | null;
  avatar_url: string | null;
  telefone: string | null;
  status: string;
  role: AppRole;
  ultimo_acesso: string | null;
  created_at: string;
}

export interface ModulePermission {
  modulo: string;
  pode_visualizar: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
}

export interface CreateUserData {
  email: string;
  password: string;
  nome_completo: string;
  cargo?: string;
  departamento?: AppDepartamento;
  role?: AppRole;
  avatar_url?: string;
  permissions?: ModulePermission[];
}

export interface UpdateUserData {
  user_id: string;
  nome_completo?: string;
  cargo?: string;
  departamento?: AppDepartamento;
  role?: AppRole;
  avatar_url?: string;
  status?: string;
  new_password?: string;
  permissions?: ModulePermission[];
}

// Pre-defined factory roles with their default permissions
export const FACTORY_ROLES = {
  admin: {
    label: 'Administrador',
    description: 'Acesso total ao sistema',
    defaultModules: [] as string[], // Admin has access to everything
  },
  gerente: {
    label: 'Gerente',
    description: 'Gestão geral com acesso amplo',
    defaultModules: ['entidades', 'itens', 'estoque', 'compras', 'producao', 'financeiro', 'relatorios'],
  },
  supervisor: {
    label: 'Supervisor',
    description: 'Supervisão de operações',
    defaultModules: ['entidades', 'itens', 'estoque', 'compras', 'producao'],
  },
  operador: {
    label: 'Operador',
    description: 'Operações do dia-a-dia',
    defaultModules: ['itens', 'estoque', 'producao'],
  },
  visualizador: {
    label: 'Visualizador',
    description: 'Apenas consulta',
    defaultModules: ['entidades', 'itens', 'estoque'],
  },
};

export const SYSTEM_MODULES = [
  { id: 'empresa', label: 'Empresa', description: 'Configurações da empresa' },
  { id: 'entidades', label: 'Entidades', description: 'Fornecedores, clientes, parceiros' },
  { id: 'itens', label: 'Itens', description: 'Matérias primas e produtos' },
  { id: 'estoque', label: 'Estoque', description: 'Lotes e movimentações' },
  { id: 'compras', label: 'Compras', description: 'NF-e e notas de entrada' },
  { id: 'producao', label: 'Produção', description: 'Fórmulas e ordens de produção' },
  { id: 'financeiro', label: 'Financeiro', description: 'Contas e fluxo de caixa' },
  { id: 'vendas', label: 'Vendas', description: 'CRM, pedidos e marketplace' },
  { id: 'relatorios', label: 'Relatórios', description: 'Relatórios gerenciais' },
  { id: 'usuarios', label: 'Usuários', description: 'Gestão de usuários' },
  { id: 'configuracoes', label: 'Configurações', description: 'Configurações do sistema' },
];

export function useUsers() {
  const [users, setUsers] = useState<UserWithProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('nome_completo');

      if (profilesError) throw profilesError;

      // Fetch roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Create a map of user_id to role
      const roleMap = new Map<string, AppRole>();
      roles?.forEach(r => roleMap.set(r.user_id, r.role));

      // Combine data - need to get email from auth (we'll use id for now)
      const usersWithRoles: UserWithProfile[] = (profiles || []).map(profile => ({
        id: profile.id,
        email: '', // We'll need to fetch this separately or store it
        nome_completo: profile.nome_completo,
        cargo: profile.cargo,
        departamento: profile.departamento,
        avatar_url: profile.avatar_url,
        telefone: profile.telefone,
        status: (profile as any).status || 'ATIVO',
        role: roleMap.get(profile.id) || 'visualizador',
        ultimo_acesso: (profile as any).ultimo_acesso,
        created_at: profile.created_at,
      }));

      setUsers(usersWithRoles);
      setError(null);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchUserPermissions = async (userId: string): Promise<ModulePermission[]> => {
    const { data, error } = await supabase
      .from('user_permissions')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }

    return (data || []).map(p => ({
      modulo: p.modulo,
      pode_visualizar: p.pode_visualizar ?? false,
      pode_criar: p.pode_criar ?? false,
      pode_editar: p.pode_editar ?? false,
      pode_excluir: p.pode_excluir ?? false,
    }));
  };

  const createUser = async (data: CreateUserData): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await supabase.functions.invoke('admin-create-user', {
        body: data,
      });

      // Prefer the specific error from the response body over the generic HTTP error
      const errorMsg = response.data?.error || response.error?.message || 'Erro ao criar usuário';
      if (response.error || response.data?.error) {
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      toast.success('Usuário criado com sucesso!');
      await fetchUsers();
      return { success: true };
    } catch (err) {
      console.error('Error creating user:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const updateUser = async (data: UpdateUserData): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await supabase.functions.invoke('admin-update-user', {
        body: data,
      });

      // Prefer the specific error from the response body over the generic HTTP error
      const errorMsg = response.data?.error || response.error?.message || 'Erro ao atualizar usuário';
      if (response.error || response.data?.error) {
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      toast.success('Usuário atualizado com sucesso!');
      await fetchUsers();
      return { success: true };
    } catch (err) {
      console.error('Error updating user:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return {
    users,
    isLoading,
    error,
    fetchUsers,
    fetchUserPermissions,
    createUser,
    updateUser,
  };
}
