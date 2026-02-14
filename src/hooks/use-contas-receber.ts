import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContaReceber {
  id: string;
  cliente_id: string | null;
  numero_documento: string | null;
  descricao: string;
  valor: number;
  valor_pago: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  status: string;
  forma_pagamento: string | null;
  observacoes: string | null;
  created_at: string;
  cliente?: { razao_social: string } | null;
}

export function useContasReceber() {
  const queryClient = useQueryClient();

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-receber'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_receber')
        .select('*, entidades(razao_social)')
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return (data || []).map((c: Record<string, unknown>) => ({
        ...c,
        cliente: c.entidades as { razao_social: string } | null,
      })) as ContaReceber[];
    },
  });

  const baixarConta = useMutation({
    mutationFn: async ({ id, valor_pago }: { id: string; valor_pago: number }) => {
      const conta = contas.find(c => c.id === id);
      if (!conta) throw new Error('Conta não encontrada');
      
      const totalPago = Number(conta.valor_pago) + valor_pago;
      const status = totalPago >= Number(conta.valor) ? 'PAGO' : 'PARCIAL';
      
      const { error } = await supabase
        .from('contas_receber')
        .update({
          valor_pago: totalPago,
          status,
          data_pagamento: status === 'PAGO' ? new Date().toISOString().split('T')[0] : null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
      toast.success('Baixa registrada com sucesso!');
    },
    onError: () => toast.error('Erro ao registrar baixa'),
  });

  return { contas, isLoading, baixarConta };
}
