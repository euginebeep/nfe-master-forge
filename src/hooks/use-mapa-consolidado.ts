import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useComprasConsolidadas, type CompraNecessidadeConsolidada } from '@/hooks/use-compras-consolidadas';
import { useAuth } from '@/hooks/use-auth';
import {
  fetchInteligenciaCompra,
  historicoFornecedorKey,
  type ItemFornecedorCotacao,
  type ItemHistoricoGeral,
  type RequisicaoCotacao,
} from '@/hooks/use-requisicao-cotacoes';
import type { LinhaDraft } from '@/components/compras/ItemCotacaoGrade';
import { parseNum } from '@/components/compras/ItemCotacaoGrade';

export interface MapaItemConsolidado {
  necessidade: CompraNecessidadeConsolidada;
  fornecedores: ItemFornecedorCotacao[];
  cotacoes: RequisicaoCotacao[];
  historicoItem?: ItemHistoricoGeral | null;
}

const MAPA_QUERY_KEY = ['mapa-consolidado'] as const;

function deduplicarCotacoesPorFornecedor(linhas: RequisicaoCotacao[]): RequisicaoCotacao[] {
  const porFornecedor = new Map<string, RequisicaoCotacao>();

  for (const cot of linhas) {
    const existente = porFornecedor.get(cot.fornecedor_id);
    if (!existente) {
      porFornecedor.set(cot.fornecedor_id, cot);
      continue;
    }
    if (cot.escolhido && !existente.escolhido) {
      porFornecedor.set(cot.fornecedor_id, cot);
    }
  }

  return [...porFornecedor.values()];
}

async function fetchDadosMapa(
  necessidades: CompraNecessidadeConsolidada[],
  companyId: string,
): Promise<MapaItemConsolidado[]> {
  const itemIds = necessidades.map((n) => n.item_id);
  if (itemIds.length === 0) return [];

  const [fornRes, linhasRes, intel] = await Promise.all([
    supabase
      .from('item_fornecedores')
      .select(`
        id, item_id, fornecedor_id, unidade_compra_padrao, fator_para_unidade_interna,
        qtd_por_pacote, fornecedor_preferencial, preco_referencia, lead_time_dias,
        fornecedor:entidades!item_fornecedores_fornecedor_id_fkey(id, razao_social, nome_fantasia)
      `)
      .in('item_id', itemIds),
    supabase
      .from('requisicoes_compra_itens')
      .select('id, item_id')
      .in('item_id', itemIds),
    fetchInteligenciaCompra(itemIds, companyId),
  ]);

  if (fornRes.error) throw fornRes.error;
  if (linhasRes.error) throw linhasRes.error;

  const fornecedoresPorItem = new Map<string, ItemFornecedorCotacao[]>();
  for (const row of (fornRes.data || []) as unknown as ItemFornecedorCotacao[]) {
    if (!row.item_id) continue;
    const list = fornecedoresPorItem.get(row.item_id) || [];
    list.push({
      ...row,
      historico: intel.fornHistMap.get(historicoFornecedorKey(row.item_id, row.fornecedor_id)) ?? null,
    });
    fornecedoresPorItem.set(row.item_id, list);
  }

  const reqItemIds = (linhasRes.data || []).map((l) => l.id).filter(Boolean) as string[];
  const itemIdPorReqItem = new Map<string, string>();
  for (const linha of linhasRes.data || []) {
    if (linha.id && linha.item_id) itemIdPorReqItem.set(linha.id, linha.item_id);
  }

  const cotacoesPorItem = new Map<string, RequisicaoCotacao[]>();

  if (reqItemIds.length > 0) {
    const { data: cotData, error: cotErr } = await supabase
      .from('requisicoes_compra_cotacoes' as 'requisicoes_compra')
      .select('*')
      .in('requisicao_item_id', reqItemIds);

    if (cotErr) throw cotErr;

    const rawPorItem = new Map<string, RequisicaoCotacao[]>();
    for (const row of (cotData || []) as unknown as RequisicaoCotacao[]) {
      const itemId = itemIdPorReqItem.get(row.requisicao_item_id);
      if (!itemId) continue;
      const list = rawPorItem.get(itemId) || [];
      list.push(row);
      rawPorItem.set(itemId, list);
    }

    for (const [itemId, linhas] of rawPorItem) {
      cotacoesPorItem.set(itemId, deduplicarCotacoesPorFornecedor(linhas));
    }
  }

  return necessidades.map((necessidade) => ({
    necessidade,
    fornecedores: fornecedoresPorItem.get(necessidade.item_id) || [],
    cotacoes: cotacoesPorItem.get(necessidade.item_id) || [],
    historicoItem: intel.itemHistMap.get(necessidade.item_id) ?? null,
  }));
}

export function useMapaConsolidado() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const companyId = profile?.company_id;

  const consolidadas = useComprasConsolidadas();
  const itemIds = useMemo(
    () => (consolidadas.data || []).map((n) => n.item_id),
    [consolidadas.data],
  );

  const mapaQuery = useQuery({
    queryKey: [...MAPA_QUERY_KEY, itemIds, companyId],
    enabled: itemIds.length > 0 && !!companyId && !!consolidadas.data,
    queryFn: () => fetchDadosMapa(consolidadas.data!, companyId!),
    staleTime: 15_000,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['compras-necessidades-consolidadas'] });
    queryClient.invalidateQueries({ queryKey: [...MAPA_QUERY_KEY] });
    queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
  };

  const salvarCotacao = useMutation({
    mutationFn: async ({
      itemId,
      fornecedorId,
      fields,
    }: {
      itemId: string;
      fornecedorId: string;
      fields: LinhaDraft;
    }) => {
      const { data, error } = await supabase.rpc('gravar_cotacao_item_consolidado', {
        p_item_id: itemId,
        p_fornecedor_id: fornecedorId,
        p_preco: parseNum(fields.preco_unitario),
        p_qtd_por_pacote: parseNum(fields.qtd_por_pacote),
        p_unidade: fields.unidade_compra?.trim() || null,
        p_prazo: fields.prazo_entrega?.trim() || null,
        p_qtd_cotada: null,
        p_observacao: fields.observacao?.trim() || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Cotação salva');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao salvar cotação');
    },
  });

  const escolherFornecedor = useMutation({
    mutationFn: async ({
      itemId,
      fornecedorId,
    }: {
      itemId: string;
      fornecedorId: string;
    }) => {
      const { data, error } = await supabase.rpc('escolher_fornecedor_item_consolidado', {
        p_item_id: itemId,
        p_fornecedor_id: fornecedorId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Fornecedor escolhido para o item');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao escolher fornecedor');
    },
  });

  return {
    necessidades: consolidadas.data || [],
    itensMapa: mapaQuery.data || [],
    isLoading: consolidadas.isLoading || mapaQuery.isLoading,
    isLoadingInteligencia: mapaQuery.isLoading,
    isError: consolidadas.isError || mapaQuery.isError,
    error: consolidadas.error || mapaQuery.error,
    salvarCotacao,
    escolherFornecedor,
  };
}
