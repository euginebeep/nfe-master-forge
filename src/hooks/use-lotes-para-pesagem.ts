import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface LoteParaPesagem {
  id: string;
  numero_lote: string;
  quantidade_interna: number;
  data_val: string | null;
  status: string;
}

export function useLotesParaPesagem(itemId?: string | null) {
  return useQuery({
    queryKey: ['lotes-para-pesagem', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<LoteParaPesagem[]> => {
      const hoje = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from('estoque_lotes')
        .select('id, numero_lote, quantidade_interna, data_val, status')
        .eq('item_id', itemId!)
        .gt('quantidade_interna', 0)
        .in('status', ['DISPONIVEL', 'QUARENTENA'])
        .or(`data_val.is.null,data_val.gte.${hoje}`)
        .order('data_val', { ascending: true, nullsFirst: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}
