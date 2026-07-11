import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface MapaCotacaoRankingRow {
  company_id: string;
  item_id: string;
  item_nome: string;
  unidade_item: string | null;
  total_falta: number;
  fornecedor_id: string;
  fornecedor_nome: string;
  preco_unitario: number | null;
  frete: number | null;
  qtd_por_pacote: number | null;
  unidade_compra: string | null;
  prazo_entrega: string | null;
  prazo_dias: number | null;
  escolhido: boolean;
  qtd_alocada: number | null;
  qtd_compra: number;
  custo_itens: number | null;
  custo_total: number | null;
  rank_custo: number | null;
  rank_preco: number | null;
  rank_prazo: number | null;
  n_cotados: number;
}

export const MAPA_RANKING_QUERY_KEY = ['mapa-cotacao-ranking'] as const;

type RawRow = Record<string, unknown>;

function asString(value: unknown): string {
  return value != null ? String(value).trim() : '';
}

function asNullableString(value: unknown): string | null {
  const s = asString(value);
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

function asBool(value: unknown): boolean {
  return value === true || value === 'true' || value === 1;
}

function normalizarRankingRow(row: RawRow): MapaCotacaoRankingRow | null {
  const item_id = asNullableString(row.item_id);
  const fornecedor_id = asNullableString(row.fornecedor_id);
  if (!item_id || !fornecedor_id) return null;

  return {
    company_id: asString(row.company_id),
    item_id,
    item_nome: asString(row.item_nome) || 'Item',
    unidade_item: asNullableString(row.unidade_item),
    total_falta: asNumber(row.total_falta),
    fornecedor_id,
    fornecedor_nome: asString(row.fornecedor_nome) || 'Fornecedor',
    preco_unitario: asNullableNumber(row.preco_unitario),
    frete: asNullableNumber(row.frete),
    qtd_por_pacote: asNullableNumber(row.qtd_por_pacote),
    unidade_compra: asNullableString(row.unidade_compra),
    prazo_entrega: asNullableString(row.prazo_entrega),
    prazo_dias: asNullableNumber(row.prazo_dias),
    escolhido: asBool(row.escolhido),
    qtd_alocada: asNullableNumber(row.qtd_alocada),
    qtd_compra: asNumber(row.qtd_compra),
    custo_itens: asNullableNumber(row.custo_itens),
    custo_total: asNullableNumber(row.custo_total),
    rank_custo: asNullableNumber(row.rank_custo),
    rank_preco: asNullableNumber(row.rank_preco),
    rank_prazo: asNullableNumber(row.rank_prazo),
    n_cotados: asNumber(row.n_cotados),
  };
}

export function agruparRankingPorItem(
  rows: MapaCotacaoRankingRow[],
): Map<string, MapaCotacaoRankingRow[]> {
  const map = new Map<string, MapaCotacaoRankingRow[]>();
  for (const row of rows) {
    const list = map.get(row.item_id) || [];
    list.push(row);
    map.set(row.item_id, list);
  }
  return map;
}

export function melhorCustoRanking(rows: MapaCotacaoRankingRow[]): MapaCotacaoRankingRow | null {
  return rows.find((r) => r.rank_custo === 1) ?? null;
}

export function payloadAlocacaoFromRanking(row: MapaCotacaoRankingRow): {
  fornecedorId: string;
  qtdAlocada: number;
  numPacotes: number | null;
} {
  const qtdCompra = row.qtd_compra;
  const qtdPacote = row.qtd_por_pacote;

  if (qtdPacote != null && qtdPacote > 0) {
    const numPacotes = qtdCompra / qtdPacote;
    return {
      fornecedorId: row.fornecedor_id,
      qtdAlocada: qtdCompra,
      numPacotes: Number.isInteger(numPacotes) ? numPacotes : Math.round(numPacotes),
    };
  }

  return {
    fornecedorId: row.fornecedor_id,
    qtdAlocada: qtdCompra,
    numPacotes: null,
  };
}

async function fetchMapaRanking(itemIds: string[]): Promise<Map<string, MapaCotacaoRankingRow[]>> {
  if (itemIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from('mapa_cotacao_ranking' as 'itens')
    .select('*')
    .in('item_id', itemIds);

  if (error) throw error;

  const rows = (data || [])
    .map((row) => normalizarRankingRow(row as RawRow))
    .filter((row): row is MapaCotacaoRankingRow => row != null);

  return agruparRankingPorItem(rows);
}

export function useMapaRanking(itemIds: string[]) {
  const sortedKey = [...itemIds].sort().join(',');

  return useQuery({
    queryKey: [...MAPA_RANKING_QUERY_KEY, sortedKey],
    enabled: itemIds.length > 0,
    queryFn: () => fetchMapaRanking(itemIds),
    staleTime: 15_000,
  });
}
