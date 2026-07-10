import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type RawRow = Record<string, unknown>;

export interface PedidoCompraFornecedor {
  id: string;
  razao_social: string | null;
  nome_fantasia: string | null;
}

export interface PedidoCompra {
  id: string;
  numero_interno: string;
  fornecedor_id: string | null;
  fornecedor_nome: string;
  valor_total: number;
  status: string;
  emitido_em: string | null;
  created_at: string | null;
}

export interface PedidoCompraItem {
  id: string;
  pedido_id: string;
  item_id: string | null;
  item_nome: string;
  quantidade: number;
  unidade: string | null;
  num_pacotes: number | null;
  qtd_por_pacote: number | null;
  preco_unitario: number | null;
  subtotal: number | null;
}

export interface PedidoCompraDetalhe {
  pedido: PedidoCompra;
  itens: PedidoCompraItem[];
}

export interface AprovarCompraResult {
  pedidos_criados: string[];
  n: number;
}

export interface AprovarCompraFornecedorResult {
  pedido_id: string;
  itens: unknown;
  frete: number;
}

const PEDIDOS_QUERY_KEY = ['pedidos-compra'] as const;

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

function nomeFornecedor(forn?: PedidoCompraFornecedor | null): string {
  return forn?.nome_fantasia || forn?.razao_social || 'Fornecedor';
}

function normalizarFornecedor(raw: unknown): PedidoCompraFornecedor | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as RawRow;
  const id = asNullableString(row.id);
  if (!id) return null;
  return {
    id,
    razao_social: asNullableString(row.razao_social),
    nome_fantasia: asNullableString(row.nome_fantasia),
  };
}

function normalizarPedido(row: RawRow): PedidoCompra | null {
  const id = asNullableString(row.id);
  if (!id) return null;

  const fornecedor = normalizarFornecedor(row.fornecedor);
  const fornecedorId = asNullableString(row.fornecedor_id) || fornecedor?.id || null;

  return {
    id,
    numero_interno: asNullableString(row.numero_interno) || '—',
    fornecedor_id: fornecedorId,
    fornecedor_nome: nomeFornecedor(fornecedor),
    valor_total: asNumber(row.valor_total),
    status: asNullableString(row.status) || 'EMITIDO',
    emitido_em: asNullableString(row.emitido_em) || asNullableString(row.created_at),
    created_at: asNullableString(row.created_at),
  };
}

function normalizarItem(row: RawRow): PedidoCompraItem | null {
  const id = asNullableString(row.id);
  const pedidoId = asNullableString(row.pedido_id);
  if (!id || !pedidoId) return null;

  return {
    id,
    pedido_id: pedidoId,
    item_id: asNullableString(row.item_id),
    item_nome: asNullableString(row.item_nome) || 'Item',
    quantidade: asNumber(row.quantidade),
    unidade: asNullableString(row.unidade) || asNullableString(row.unidade_compra),
    num_pacotes: asNullableNumber(row.num_pacotes),
    qtd_por_pacote: asNullableNumber(row.qtd_por_pacote),
    preco_unitario: asNullableNumber(row.preco_unitario),
    subtotal: asNullableNumber(row.subtotal) ?? asNullableNumber(row.valor_subtotal),
  };
}

function parseAprovarCompraResult(data: unknown): AprovarCompraResult {
  if (!data || typeof data !== 'object') {
    return { pedidos_criados: [], n: 0 };
  }
  const obj = data as RawRow;
  const pedidos_criados = Array.isArray(obj.pedidos_criados)
    ? obj.pedidos_criados.filter((id): id is string => typeof id === 'string')
    : [];
  const n = asNumber(obj.n, pedidos_criados.length);
  return { pedidos_criados, n };
}

function parseAprovarCompraFornecedorResult(data: unknown): AprovarCompraFornecedorResult {
  if (!data || typeof data !== 'object') {
    throw new Error('Resposta inválida ao gerar pedido');
  }
  const obj = data as RawRow;
  const pedido_id = asNullableString(obj.pedido_id);
  if (!pedido_id) {
    throw new Error('Pedido não retornado pelo servidor');
  }
  return {
    pedido_id,
    itens: obj.itens,
    frete: asNumber(obj.frete),
  };
}

function invalidatePedidosQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['compras-necessidades-consolidadas'] });
  queryClient.invalidateQueries({ queryKey: ['mapa-consolidado'] });
  queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
  queryClient.invalidateQueries({ queryKey: [...PEDIDOS_QUERY_KEY] });
}

export function useAprovarCompraFornecedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (fornecedorId: string): Promise<AprovarCompraFornecedorResult> => {
      const { data, error } = await supabase.rpc('aprovar_compra_fornecedor', {
        p_fornecedor_id: fornecedorId,
      });
      if (error) throw error;
      return parseAprovarCompraFornecedorResult(data);
    },
    onSuccess: () => {
      invalidatePedidosQueries(queryClient);
      toast.success('Pedido gerado');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao gerar pedido');
    },
  });
}

export function useAprovarCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<AprovarCompraResult> => {
      const { data, error } = await supabase.rpc('aprovar_compra');
      if (error) throw error;
      return parseAprovarCompraResult(data);
    },
    onSuccess: (data) => {
      invalidatePedidosQueries(queryClient);
      toast.success(`${data.n} pedido(s) gerado(s)`);
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao aprovar compra');
    },
  });
}

export function usePedidosCompra() {
  return useQuery({
    queryKey: [...PEDIDOS_QUERY_KEY],
    queryFn: async (): Promise<PedidoCompra[]> => {
      const { data, error } = await supabase
        .from('pedidos_compra' as 'itens')
        .select(`
          id,
          numero_interno,
          fornecedor_id,
          valor_total,
          status,
          emitido_em,
          created_at,
          fornecedor:entidades!pedidos_compra_fornecedor_id_fkey(id, razao_social, nome_fantasia)
        `)
        .order('emitido_em', { ascending: false, nullsFirst: false });

      if (error) throw error;

      return (data || [])
        .map((row) => normalizarPedido(row as RawRow))
        .filter((row): row is PedidoCompra => row != null);
    },
    staleTime: 30_000,
  });
}

export function usePedidoCompra(id: string | undefined) {
  return useQuery({
    queryKey: [...PEDIDOS_QUERY_KEY, id],
    enabled: !!id,
    queryFn: async (): Promise<PedidoCompraDetalhe> => {
      const { data: pedidoData, error: pedidoErr } = await supabase
        .from('pedidos_compra' as 'itens')
        .select(`
          id,
          numero_interno,
          fornecedor_id,
          valor_total,
          status,
          emitido_em,
          created_at,
          fornecedor:entidades!pedidos_compra_fornecedor_id_fkey(id, razao_social, nome_fantasia)
        `)
        .eq('id', id!)
        .maybeSingle();

      if (pedidoErr) throw pedidoErr;

      const pedido = pedidoData ? normalizarPedido(pedidoData as RawRow) : null;
      if (!pedido) throw new Error('Pedido de compra não encontrado');

      const { data: itensData, error: itensErr } = await supabase
        .from('pedidos_compra_itens' as 'itens')
        .select('*')
        .eq('pedido_id', id!)
        .order('item_nome', { ascending: true });

      if (itensErr) throw itensErr;

      const itens = (itensData || [])
        .map((row) => normalizarItem(row as RawRow))
        .filter((row): row is PedidoCompraItem => row != null);

      return { pedido, itens };
    },
    staleTime: 30_000,
  });
}
