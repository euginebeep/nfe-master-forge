import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { invokeEdge } from '@/lib/edge-invoke';

interface SyncHistory {
  id: string;
  tipo: string;
  status: string;
  registros_atualizados: number;
  registros_novos: number;
  fonte_url: string | null;
  versao_legislacao: string | null;
  hash_conteudo: string | null;
  detalhes: Record<string, unknown>;
  erro_mensagem: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
}

export function useAnvisaSync() {
  const queryClient = useQueryClient();

  const { data: ultimoSync, isLoading: loadingSync } = useQuery({
    queryKey: ['anvisa-sync-history'],
    queryFn: async () => {
      const { data } = await supabase
        .from('anvisa_sync_history')
        .select('*')
        .in('status', ['sucesso', 'alerta'])
        .order('finalizado_em', { ascending: false })
        .limit(1)
        .single();
      return data as SyncHistory | null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { mutate: sincronizar, isPending: sincronizando } = useMutation({
    mutationFn: async () => {
      const { data, error } = await invokeEdge('anvisa-powerbi-sync');
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anvisa-sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['anvisa-search'] });
    },
  });

  const { mutate: sincronizarSubstancia, isPending: sincronizandoSubstancia } = useMutation({
    mutationFn: async (substancia: string) => {
      const { data, error } = await invokeEdge('anvisa-powerbi-sync', { substancia });
      if (error) throw new Error(error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['anvisa-sync-history'] });
      queryClient.invalidateQueries({ queryKey: ['anvisa-search'] });
    },
  });

  return {
    ultimoSync,
    loadingSync,
    sincronizar,
    sincronizando,
    sincronizarSubstancia,
    sincronizandoSubstancia,
  };
}
