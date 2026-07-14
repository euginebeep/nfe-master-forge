import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RawRow = Record<string, unknown>;

export interface PedidoParaVinculo {
  id: string;
  numero_interno: string;
  status: string;
  valor_total: number;
  emitido_em: string | null;
}

export interface VincularNotaPedidoResult {
  itens_casados: number;
  itens_sem_par_no_pedido: number;
}

export type SituacaoQtd = 'AGUARDANDO' | 'PARCIAL' | 'OK' | 'RECEBIDO A MAIOR';
export type SituacaoPreco = 'SEM NOTA' | 'OK' | 'COBRADO A MAIOR' | 'COBRADO A MENOR';

export interface RecebimentoDivergencia {
  company_id: string;
  pedido_id: string;
  pedido_numero: string;
  pedido_status: string;
  fornecedor_nome: string;
  pedido_item_id: string;
  item_id: string | null;
  item_nome: string;
  unidade: string | null;
  qtd_pedida: number;
  preco_pedido: number | null;
  subtotal_pedido: number | null;
  qtd_recebida: number;
  n_notas: number;
  notas: string[] | null;
  unidade_nota: string | null;
  valor_nota: number | null;
  preco_nota: number | null;
  div_qtd: number | null;
  div_preco: number | null;
  div_preco_pct: number | null;
  situacao_qtd: SituacaoQtd;
  situacao_preco: SituacaoPreco;
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((v) => String(v));
}

function parseVincularResult(data: unknown): VincularNotaPedidoResult {
  if (!data || typeof data !== 'object') {
    return { itens_casados: 0, itens_sem_par_no_pedido: 0 };
  }
  const obj = data as RawRow;
  return {
    itens_casados: asNumber(obj.itens_casados),
    itens_sem_par_no_pedido: asNumber(obj.itens_sem_par_no_pedido),
  };
}

function normalizarPedidoParaVinculo(row: RawRow): PedidoParaVinculo | null {
  const id = asNullableString(row.id);
  if (!id) return null;
  return {
    id,
    numero_interno: asNullableString(row.numero_interno) || '—',
    status: asNullableString(row.status) || 'EMITIDO',
    valor_total: asNumber(row.valor_total),
    emitido_em: asNullableString(row.emitido_em) || asNullableString(row.created_at),
  };
}

function normalizarRecebimento(row: RawRow): RecebimentoDivergencia | null {
  const pedido_item_id = asNullableString(row.pedido_item_id);
  const pedido_id = asNullableString(row.pedido_id);
  if (!pedido_item_id || !pedido_id) return null;

  return {
    company_id: asNullableString(row.company_id) || '',
    pedido_id,
    pedido_numero: asNullableString(row.pedido_numero) || '—',
    pedido_status: asNullableString(row.pedido_status) || '',
    fornecedor_nome: asNullableString(row.fornecedor_nome) || '',
    pedido_item_id,
    item_id: asNullableString(row.item_id),
    item_nome: asNullableString(row.item_nome) || 'Item',
    unidade: asNullableString(row.unidade),
    qtd_pedida: asNumber(row.qtd_pedida),
    preco_pedido: asNullableNumber(row.preco_pedido),
    subtotal_pedido: asNullableNumber(row.subtotal_pedido),
    qtd_recebida: asNumber(row.qtd_recebida),
    n_notas: asNumber(row.n_notas),
    notas: asStringArray(row.notas),
    unidade_nota: asNullableString(row.unidade_nota),
    valor_nota: asNullableNumber(row.valor_nota),
    preco_nota: asNullableNumber(row.preco_nota),
    div_qtd: asNullableNumber(row.div_qtd),
    div_preco: asNullableNumber(row.div_preco),
    div_preco_pct: asNullableNumber(row.div_preco_pct),
    situacao_qtd: (asNullableString(row.situacao_qtd) || 'AGUARDANDO') as SituacaoQtd,
    situacao_preco: (asNullableString(row.situacao_preco) || 'SEM NOTA') as SituacaoPreco,
  };
}

function invalidateNotaPedidoQueries(queryClient: ReturnType<typeof useQueryClient>, pedidoId?: string | null) {
  queryClient.invalidateQueries({ queryKey: ['notas-entrada'] });
  queryClient.invalidateQueries({ queryKey: ['pedidos-para-vinculo'] });
  queryClient.invalidateQueries({ queryKey: ['recebimento-divergencias'] });
  queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] });
  if (pedidoId) {
    queryClient.invalidateQueries({ queryKey: ['pedidos-compra', pedidoId] });
  }
}

export function usePedidosParaVinculo(fornecedorId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ['pedidos-para-vinculo', fornecedorId],
    enabled: enabled && !!fornecedorId,
    queryFn: async (): Promise<PedidoParaVinculo[]> => {
      const { data, error } = await supabase
        .from('pedidos_compra' as 'itens')
        .select('id, numero_interno, status, valor_total, emitido_em, created_at')
        .eq('fornecedor_id', fornecedorId!)
        .in('status', ['EMITIDO', 'RECEBIDO_PARCIAL'])
        .order('emitido_em', { ascending: false, nullsFirst: false });

      if (error) throw error;

      return (data || [])
        .map((row) => normalizarPedidoParaVinculo(row as RawRow))
        .filter((row): row is PedidoParaVinculo => row != null);
    },
    staleTime: 15_000,
  });
}

export function useRecebimentoDivergencias(pedidoId: string | undefined) {
  return useQuery({
    queryKey: ['recebimento-divergencias', pedidoId],
    enabled: !!pedidoId,
    queryFn: async (): Promise<RecebimentoDivergencia[]> => {
      const { data, error } = await supabase
        .from('recebimento_divergencias' as 'itens')
        .select('*')
        .eq('pedido_id', pedidoId!)
        .order('item_nome', { ascending: true });

      if (error) throw error;

      return (data || [])
        .map((row) => normalizarRecebimento(row as RawRow))
        .filter((row): row is RecebimentoDivergencia => row != null);
    },
    staleTime: 15_000,
  });
}

export function useVincularNotaPedido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      notaId,
      pedidoId,
    }: {
      notaId: string;
      pedidoId: string;
    }): Promise<VincularNotaPedidoResult> => {
      const { data, error } = await supabase.rpc('vincular_nota_pedido', {
        p_nota_id: notaId,
        p_pedido_id: pedidoId,
      });
      if (error) throw error;
      return parseVincularResult(data);
    },
    onSuccess: (_data, vars) => {
      invalidateNotaPedidoQueries(queryClient, vars.pedidoId);
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao vincular nota ao pedido');
    },
  });
}

export function useDesvincularNotaPedido() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (notaId: string) => {
      const { error } = await supabase.rpc('desvincular_nota_pedido', {
        p_nota_id: notaId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateNotaPedidoQueries(queryClient);
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao desvincular nota do pedido');
    },
  });
}

export function useMarcarNotaAvulsa() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ notaId, motivo }: { notaId: string; motivo: string }) => {
      const { error } = await supabase.rpc('marcar_nota_avulsa', {
        p_nota_id: notaId,
        p_motivo: motivo.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateNotaPedidoQueries(queryClient);
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao marcar nota como avulsa');
    },
  });
}
