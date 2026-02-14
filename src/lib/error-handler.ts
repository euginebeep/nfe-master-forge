import { toast } from 'sonner';

type ErrorLevel = 'warning' | 'error' | 'info';

interface AppError {
  message: string;
  level: ErrorLevel;
  originalError?: unknown;
}

export function handleApiError(error: unknown, context?: string): AppError {
  const prefix = context ? `${context}: ` : '';

  if (error instanceof Response || (error && typeof error === 'object' && 'status' in error)) {
    const status = (error as { status: number }).status;
    
    if (status === 401) {
      toast.error('Sessão expirada. Faça login novamente.');
      window.location.href = '/auth';
      return { message: 'Não autenticado', level: 'error', originalError: error };
    }
    
    if (status === 403) {
      toast.error(`${prefix}Você não tem permissão para esta ação.`);
      return { message: 'Sem permissão', level: 'error', originalError: error };
    }
    
    if (status >= 500) {
      toast.error(`${prefix}Erro no servidor. Tente novamente em instantes.`);
      return { message: 'Erro interno do servidor', level: 'error', originalError: error };
    }
  }

  if (error instanceof Error) {
    // Supabase errors
    if ('code' in error) {
      const code = (error as { code: string }).code;
      if (code === 'PGRST116') {
        return { message: 'Registro não encontrado', level: 'warning', originalError: error };
      }
      if (code === '23505') {
        toast.error(`${prefix}Registro duplicado. Verifique os dados.`);
        return { message: 'Registro duplicado', level: 'error', originalError: error };
      }
      if (code === '23503') {
        toast.error(`${prefix}Não é possível excluir. Existem registros vinculados.`);
        return { message: 'Violação de referência', level: 'error', originalError: error };
      }
    }
    
    toast.error(`${prefix}${error.message}`);
    return { message: error.message, level: 'error', originalError: error };
  }

  toast.error(`${prefix}Erro inesperado. Tente novamente.`);
  return { message: 'Erro desconhecido', level: 'error', originalError: error };
}

export function logError(error: unknown, context?: string) {
  if (import.meta.env.DEV) {
    console.error(`[${context || 'App'}]`, error);
  }
}
