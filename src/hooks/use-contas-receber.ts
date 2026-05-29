import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserCompanyId } from '@/hooks/use-user-company';
import { toast } from 'sonner';

export interface ContaReceber {
  id: string;
  company_id: string;
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
  pedido_venda_id: string | null;
  created_at: string;
  cliente?: { razao_social: string; documento: string } | null;
}

export function useContasReceber(filtros?: {
  status?: string;
  clienteId?: string;
  periodo?: 'mes_atual' | 'trimestre' | 'ano' | 'todos';
}) {
  const { data: companyId } = useUserCompanyId();
  const queryClient = useQueryClient();

  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas-receber', companyId, filtros],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from('contas_receber')
        .select(`
          *,
          cliente:entidades!contas_receber_cliente_id_fkey(razao_social, documento)
        `)
        .eq('company_id', companyId!)
        .order('data_vencimento', { ascending: true });

      if (filtros?.status && filtros.status !== 'all') {
        query = query.eq('status', filtros.status);
      }
      if (filtros?.clienteId && filtros.clienteId !== 'all') {
        query = query.eq('cliente_id', filtros.clienteId);
      }
      if (filtros?.periodo === 'mes_atual') {
        const inicio = new Date();
        inicio.setDate(1); inicio.setHours(0, 0, 0, 0);
        query = query.gte('data_vencimento', inicio.toISOString());
      }

      const { data, error } = await query.limit(500);
      if (error) throw error;
      return (data || []).map((c: Record<string, unknown>) => ({
        ...c,
        valor_pago: Number(c.valor_pago) || 0,
        cliente: c.cliente as { razao_social: string; documento: string } | null,
      })) as ContaReceber[];
    },
  });

  const criarConta = useMutation({
    mutationFn: async (dados: {
      cliente_id?: string | null;
      descricao: string;
      numero_documento?: string;
      valor: number;
      data_emissao: string;
      data_vencimento: string;
      forma_pagamento?: string;
      observacoes?: string;
      pedido_venda_id?: string | null;
    }) => {
      if (!companyId) throw new Error('Empresa não identificada');
      const { error } = await supabase.from('contas_receber').insert({
        ...dados,
        company_id: companyId,
        valor_pago: 0,
        status: 'PENDENTE',
        data_emissao: dados.data_emissao || new Date().toISOString().split('T')[0],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
      toast.success('Conta criada com sucesso!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const baixarConta = useMutation({
    mutationFn: async (dados: {
      id: string;
      valor_recebido: number;
      data_pagamento: string;
      forma_pagamento: string;
    }) => {
      const conta = contas.find(c => c.id === dados.id);
      if (!conta) throw new Error('Conta não encontrada');

      const jaRecebido = Number(conta.valor_pago) || 0;
      const totalRecebido = jaRecebido + dados.valor_recebido;
      const saldo = Number(conta.valor);
      const status = totalRecebido >= saldo ? 'PAGO' : 'PARCIAL';

      const { error } = await supabase
        .from('contas_receber')
        .update({
          valor_pago: totalRecebido,
          status,
          data_pagamento: dados.data_pagamento,
          forma_pagamento: dados.forma_pagamento,
        })
        .eq('id', dados.id)
        .eq('company_id', companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
      toast.success('Recebimento registrado com sucesso!');
    },
    onError: (err: Error) => toast.error(`Erro: ${err.message}`),
  });

  const cancelarConta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('contas_receber')
        .update({ status: 'CANCELADO' })
        .eq('id', id)
        .eq('company_id', companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contas-receber'] });
      toast.success('Conta cancelada');
    },
  });

  const isVencida = (dataVenc: string, status: string) => {
    if (status === 'PAGO' || status === 'CANCELADO') return false;
    return new Date(dataVenc) < new Date(new Date().toDateString());
  };

  return { contas, isLoading, criarConta, baixarConta, cancelarConta, isVencida, companyId };
}