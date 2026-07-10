import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CompraNecessidadeConsolidada {
  item_id: string;
  item_nome: string;
  tipo_item: string | null;
  unidade: string | null;
  total_falta: number;
  ops: string[];
  n_ops: number;
  n_requisicoes: number;
  embalagem_compra_qtd: number | null;
  embalagem_compra_unidade: string | null;
  num_compras: number | null;
  preco_medio: number | null;
  ultimo_preco: number | null;
  ultima_compra_data: string | null;
  ultimo_fornecedor_id: string | null;
  ultimo_fornecedor_nome: string | null;
  n_fornecedores_cadastrados: number;
}

type RawRow = Record<string, unknown>;

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter((v): v is string => typeof v === 'string');
    } catch {
      return value ? [value] : [];
    }
  }
  return [];
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

function asNullableString(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s || null;
}

function normalizarLinha(row: RawRow): CompraNecessidadeConsolidada | null {
  const item_id = asNullableString(row.item_id);
  if (!item_id) return null;

  return {
    item_id,
    item_nome: asNullableString(row.item_nome) || 'Item sem nome',
    tipo_item: asNullableString(row.tipo_item),
    unidade: asNullableString(row.unidade) || 'g',
    total_falta: asNumber(row.total_falta),
    ops: asStringArray(row.ops),
    n_ops: asNumber(row.n_ops),
    n_requisicoes: asNumber(row.n_requisicoes),
    embalagem_compra_qtd: asNullableNumber(row.embalagem_compra_qtd),
    embalagem_compra_unidade: asNullableString(row.embalagem_compra_unidade),
    num_compras: asNullableNumber(row.num_compras),
    preco_medio: asNullableNumber(row.preco_medio),
    ultimo_preco: asNullableNumber(row.ultimo_preco),
    ultima_compra_data: asNullableString(row.ultima_compra_data),
    ultimo_fornecedor_id: asNullableString(row.ultimo_fornecedor_id),
    ultimo_fornecedor_nome: asNullableString(row.ultimo_fornecedor_nome),
    n_fornecedores_cadastrados: asNumber(row.n_fornecedores_cadastrados),
  };
}

export function useComprasConsolidadas() {
  return useQuery({
    queryKey: ['compras-necessidades-consolidadas'],
    queryFn: async (): Promise<CompraNecessidadeConsolidada[]> => {
      const { data, error } = await supabase
        .from('compras_necessidades_consolidadas' as 'itens')
        .select('*');

      if (error) throw error;

      return (data || [])
        .map((row) => normalizarLinha(row as RawRow))
        .filter((row): row is CompraNecessidadeConsolidada => row != null)
        .sort((a, b) => a.item_nome.localeCompare(b.item_nome, 'pt-BR'));
    },
    staleTime: 30_000,
  });
}
