import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { registrarAuditoria } from '@/lib/audit-logger';
import type { Database } from '@/integrations/supabase/types';

/**
 * Extrai a mensagem de erro real de uma resposta de supabase.functions.invoke.
 * Quando o status é não-2xx, o corpo JSON fica em response.error.context (Response).
 * Retorna null quando não há erro.
 */
async function extractInvokeError(
  response: { data: any; error: any },
  fallback: string
): Promise<string | null> {
  // 1) Erro de servidor: tenta ler o body do Response em error.context
  if (response.error) {
    try {
      const ctx: any = (response.error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.clone().json();
        if (body?.error) return String(body.error);
        if (body?.message) return String(body.message);
      } else if (ctx && typeof ctx.text === 'function') {
        const txt = await ctx.clone().text();
        if (txt) return txt;
      }
    } catch {
      /* ignora parse */
    }
    return response.error.message || fallback;
  }
  // 2) Função retornou 2xx mas com { error: "..." } no body
  if (response.data?.error) return String(response.data.error);
  return null;
}

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
  { id: 'qualidade', label: 'Qualidade', description: 'Quarentena, desvios, POPs, análises e calibrações' },
  { id: 'financeiro', label: 'Financeiro', description: 'Contas e fluxo de caixa' },
  { id: 'vendas', label: 'Vendas', description: 'CRM, pedidos e marketplace' },
  { id: 'fiscal', label: 'Fiscal', description: 'Emissão de NF-e de saída e auditoria fiscal' },
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

      // supabase.functions.invoke stores the non-2xx body in response.error.context (a Response)
      const errorMsg = await extractInvokeError(response, 'Erro ao criar usuário');
      if (errorMsg) {
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      toast.success('Usuário criado com sucesso!');
      await fetchUsers();
      registrarAuditoria({
        tipo: 'USUARIO_CRIADO',
        descricao: `Usuário "${data.nome_completo}" criado (${data.email})`,
        entidade_tipo: 'Usuario',
        entidade_id: response.data?.user_id || 'unknown',
      });
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

      const errorMsg = await extractInvokeError(response, 'Erro ao atualizar usuário');
      if (errorMsg) {
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      toast.success('Usuário atualizado com sucesso!');
      await fetchUsers();
      registrarAuditoria({
        tipo: 'USUARIO_ALTERADO',
        descricao: `Usuário "${data.nome_completo || ''}" atualizado`,
        entidade_tipo: 'Usuario',
        entidade_id: data.user_id,
      });
      return { success: true };
    } catch (err) {
      console.error('Error updating user:', err);
      const message = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(message);
      return { success: false, error: message };
    }
  };

  const deleteUser = async (userId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        return { success: false, error: 'Not authenticated' };
      }

      const response = await supabase.functions.invoke('admin-delete-user', {
        body: { user_id: userId },
      });

      const errorMsg = await extractInvokeError(response, 'Erro ao excluir usuário');
      if (errorMsg) {
        toast.error(errorMsg);
        return { success: false, error: errorMsg };
      }

      toast.success('Usuário excluído com sucesso!');
      await fetchUsers();
      registrarAuditoria({
        tipo: 'USUARIO_EXCLUIDO',
        descricao: `Usuário excluído`,
        entidade_tipo: 'Usuario',
        entidade_id: userId,
      });
      return { success: true };
    } catch (err) {
      console.error('Error deleting user:', err);
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
    deleteUser,
  };
}
