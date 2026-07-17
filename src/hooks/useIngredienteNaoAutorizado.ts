import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type StatusIngredienteNaoAutorizado =
  | 'NAO_LISTADO'
  | 'SOB_FISCALIZACAO'
  | 'PROIBIDO_RE'
  | string;

export interface IngredienteNaoAutorizado {
  nome: string;
  status: StatusIngredienteNaoAutorizado;
  explicacao: string;
  base_legal: string | null;
  fonte_url: string | null;
  confirmado_rt: boolean;
}

export async function buscarIngredienteNaoAutorizado(
  termo: string,
): Promise<IngredienteNaoAutorizado | null> {
  if (!termo || termo.trim().length < 2) return null;

  const { data, error } = await supabase.rpc(
    'buscar_ingrediente_nao_autorizado' as never,
    { p_termo: termo.trim() } as never,
  );

  if (error) {
    console.warn('[anvisa] buscar_ingrediente_nao_autorizado:', error.message);
    return null;
  }

  const rows = (data as IngredienteNaoAutorizado[] | null) ?? [];
  if (!rows.length) return null;

  const row = rows[0];
  return {
    nome: row.nome,
    status: row.status,
    explicacao: row.explicacao,
    base_legal: row.base_legal ?? null,
    fonte_url: row.fonte_url ?? null,
    confirmado_rt: Boolean(row.confirmado_rt),
  };
}

export function useIngredienteNaoAutorizado(
  termo: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['anvisa', 'nao-autorizado', termo],
    queryFn: () => buscarIngredienteNaoAutorizado(termo),
    enabled: enabled && termo.trim().length >= 2,
    staleTime: 10 * 60 * 1000,
  });
}

export function estiloStatusNaoAutorizado(status: StatusIngredienteNaoAutorizado): {
  border: string;
  bg: string;
  title: string;
  badge: string;
} {
  switch (status) {
    case 'PROIBIDO_RE':
      return {
        border: 'border-destructive',
        bg: 'bg-red-50 dark:bg-red-950/30',
        title: 'text-destructive',
        badge: 'PROIBIDO POR RE',
      };
    case 'SOB_FISCALIZACAO':
      return {
        border: 'border-orange-500/60',
        bg: 'bg-orange-50 dark:bg-orange-950/30',
        title: 'text-orange-700 dark:text-orange-400',
        badge: 'SOB FISCALIZAÇÃO',
      };
    case 'NAO_LISTADO':
    default:
      return {
        border: 'border-amber-500/50',
        bg: 'bg-amber-50 dark:bg-amber-950/30',
        title: 'text-amber-700 dark:text-amber-400',
        badge: 'NÃO LISTADO NA IN 28',
      };
  }
}
