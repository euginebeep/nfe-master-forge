import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ExcipienteConfig {
  id: string;
  item_id: string | null;
  nome: string;
  categoria: 'EXCIPIENTE_TECNOLOGICO' | 'EXCIPIENTE_BASE';
  funcao: string | null;
  percentual: number;
  ordem: number;
  adicionar_por_ultimo: boolean;
}

/**
 * Configuração de excipientes do tenant. Fonte de verdade dos percentuais e da
 * ordem de mistura — a mesma que a RPC preparar_op_materiais consome.
 * As constantes de formulador-industrial-rules são apenas fallback.
 */
export function useExcipientesConfig() {
  return useQuery({
    queryKey: ['excipientes-config'],
    queryFn: async (): Promise<ExcipienteConfig[]> => {
      const { data, error } = await supabase
        .from('op_excipientes_config')
        .select('id, item_id, nome, categoria, funcao, percentual, ordem, adicionar_por_ultimo')
        .eq('ativo', true)
        .order('adicionar_por_ultimo', { ascending: true })
        .order('ordem', { ascending: true });

      if (error) throw error;
      return (data ?? []) as ExcipienteConfig[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
