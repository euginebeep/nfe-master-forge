import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { STATUS_REQ } from '@/hooks/use-requisicoes-compra';

export const ITENS_EM_RFQ_QUERY_KEY = ['itens-em-rfq'] as const;

export function useItensEmRfq() {
  return useQuery({
    queryKey: [...ITENS_EM_RFQ_QUERY_KEY],
    queryFn: async (): Promise<Set<string>> => {
      const { data, error } = await supabase
        .from('requisicoes_compra_itens')
        .select('item_id, requisicoes_compra!inner(status)')
        .eq('requisicoes_compra.status', STATUS_REQ.EM_RFQ);

      if (error) throw error;

      const ids = new Set<string>();
      for (const row of data || []) {
        if (row.item_id) ids.add(row.item_id);
      }
      return ids;
    },
    staleTime: 30_000,
  });
}
