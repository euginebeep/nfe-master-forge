import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EstoqueMovimentacao {
  id: string;
  tipo: string;
  item_id: string;
  lote_id: string | null;
  quantidade: number;
  unidade: string;
  custo_unitario: number | null;
  motivo: string;
  documento_ref: string | null;
  origem: string;
  observacoes: string | null;
  created_at: string;
  item?: { descricao_interna: string; sku_interno: string | null };
  lote?: { numero_lote: string } | null;
}

export function useEstoqueMovimentacoes() {
  const queryClient = useQueryClient();

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['estoque-movimentacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select('*, itens!inner(descricao_interna, sku_interno), estoque_lotes(numero_lote)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((m: Record<string, unknown>) => ({
        ...m,
        item: m.itens as { descricao_interna: string; sku_interno: string | null },
        lote: m.estoque_lotes as { numero_lote: string } | null,
      })) as EstoqueMovimentacao[];
    },
  });

  const createMovimentacao = useMutation({
    mutationFn: async (mov: {
      tipo: string;
      item_id: string;
      lote_id?: string;
      quantidade: number;
      unidade: string;
      custo_unitario?: number;
      motivo: string;
      documento_ref?: string;
      origem?: string;
      observacoes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('estoque_movimentacoes').insert({
        ...mov,
        usuario_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      toast.success('Movimentação registrada com sucesso!');
    },
    onError: () => {
      toast.error('Erro ao registrar movimentação');
    },
  });

  return { movimentacoes, isLoading, createMovimentacao };
}
