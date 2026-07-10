import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { calcularQtdComprarCotacao } from '@/lib/requisicoes-compra';
import type { RequisicaoCompra, RequisicaoCompraItem } from '@/hooks/use-requisicoes-compra';

export interface ItemFornecedorCotacao {
  id: string;
  item_id: string;
  fornecedor_id: string;
  unidade_compra_padrao: string | null;
  fator_para_unidade_interna: number | null;
  qtd_por_pacote: number | null;
  fornecedor_preferencial: boolean | null;
  preco_referencia: number | null;
  lead_time_dias: number | null;
  fornecedor?: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
  } | null;
  historico?: FornecedorHistorico | null;
}

export interface FornecedorHistorico {
  ultimo_preco: number | null;
  ultima_compra_data: string | null;
  preco_medio: number | null;
  num_compras: number | null;
  ultima_unidade: string | null;
  ultima_qtd: number | null;
}

export interface ItemHistoricoGeral {
  preco_medio: number | null;
  num_compras: number | null;
}

export interface RequisicaoCotacao {
  id: string;
  requisicao_item_id: string;
  fornecedor_id: string;
  unidade_compra: string | null;
  qtd_por_pacote: number | null;
  qtd_cotada: number | null;
  preco_unitario: number | null;
  prazo_entrega: string | null;
  escolhido: boolean;
  observacao: string | null;
  frete: number | null;
  qtd_alocada: number | null;
  num_pacotes_alocado: number | null;
}

export interface ItemCotacaoDetalhe {
  item: RequisicaoCompraItem;
  fornecedores: ItemFornecedorCotacao[];
  cotacoes: RequisicaoCotacao[];
  historicoItem?: ItemHistoricoGeral | null;
}

export interface RequisicaoCotacoesData {
  requisicao: RequisicaoCompra;
  itens: ItemCotacaoDetalhe[];
}

const REQUISICAO_DETALHE_SELECT = `
  id, company_id, op_id, status, origem, observacoes, created_at, updated_at,
  numero_interno, fornecedor_id, prazo_pagamento, condicao_pagamento, valor_total,
  aprovada_por, aprovada_por_nome, aprovada_em, pedido_enviado_em, recebida_em, nota_entrada_id,
  ordens_producao_industrial(codigo),
  fornecedor:entidades!requisicoes_compra_fornecedor_id_fkey(id, razao_social, nome_fantasia),
  requisicoes_compra_itens(
    id, requisicao_id, item_id, item_nome, quantidade_necessaria, quantidade_disponivel,
    quantidade_faltante, unidade, status, quantidade_comprar, preco_cotado,
    quantidade_recebida, fornecedor_id,
    item:itens(embalagem_compra_qtd, embalagem_compra_unidade, unidade_interna, tipo_item)
  )
`;

export interface UpsertCotacaoInput {
  requisicao_item_id: string;
  fornecedor_id: string;
  unidade_compra?: string | null;
  qtd_por_pacote?: number | null;
  qtd_cotada?: number | null;
  preco_unitario?: number | null;
  prazo_entrega?: string | null;
  observacao?: string | null;
}

function queryKey(requisicaoId: string) {
  return ['requisicao-cotacoes', requisicaoId] as const;
}

function inteligenciaQueryKey(requisicaoId: string, itemIds: string[]) {
  return ['requisicao-cotacoes-inteligencia', requisicaoId, itemIds] as const;
}

export function historicoFornecedorKey(itemId: string, fornecedorId: string) {
  return `${itemId}:${fornecedorId}`;
}

export interface InteligenciaCompraData {
  fornHistMap: Map<string, FornecedorHistorico>;
  itemHistMap: Map<string, ItemHistoricoGeral>;
}

export async function fetchInteligenciaCompra(
  itemIds: string[],
  companyId: string,
): Promise<InteligenciaCompraData> {
  const [fornHistRes, itemHistRes] = await Promise.all([
    supabase
      .from('item_fornecedor_historico' as 'itens')
      .select('item_id, fornecedor_id, num_compras, preco_medio, ultimo_preco, ultima_compra_data, ultima_unidade, ultima_qtd')
      .in('item_id', itemIds)
      .eq('company_id', companyId),
    supabase
      .from('item_historico_compra' as 'itens')
      .select('item_id, num_compras, preco_medio')
      .in('item_id', itemIds),
  ]);

  if (fornHistRes.error) throw fornHistRes.error;
  if (itemHistRes.error) throw itemHistRes.error;

  const fornHistMap = new Map<string, FornecedorHistorico>();
  for (const row of (fornHistRes.data || []) as unknown as Array<{
    item_id: string;
    fornecedor_id: string;
    num_compras: number | null;
    preco_medio: number | null;
    ultimo_preco: number | null;
    ultima_compra_data: string | null;
    ultima_unidade: string | null;
    ultima_qtd: number | null;
  }>) {
    if (!row.item_id || !row.fornecedor_id) continue;
    fornHistMap.set(historicoFornecedorKey(row.item_id, row.fornecedor_id), {
      ultimo_preco: row.ultimo_preco ?? null,
      ultima_compra_data: row.ultima_compra_data ?? null,
      preco_medio: row.preco_medio ?? null,
      num_compras: row.num_compras ?? null,
      ultima_unidade: row.ultima_unidade ?? null,
      ultima_qtd: row.ultima_qtd ?? null,
    });
  }

  const itemHistMap = new Map<string, ItemHistoricoGeral>();
  for (const row of (itemHistRes.data || []) as unknown as Array<{
    item_id: string;
    num_compras: number | null;
    preco_medio: number | null;
  }>) {
    if (!row.item_id) continue;
    itemHistMap.set(row.item_id, {
      preco_medio: row.preco_medio ?? null,
      num_compras: row.num_compras ?? null,
    });
  }

  return { fornHistMap, itemHistMap };
}

function mergeInteligencia(
  base: RequisicaoCotacoesData,
  intel?: InteligenciaCompraData | null,
): RequisicaoCotacoesData {
  if (!intel) return base;

  return {
    ...base,
    itens: base.itens.map(detalhe => {
      const itemId = detalhe.item.item_id;
      return {
        ...detalhe,
        historicoItem: itemId ? (intel.itemHistMap.get(itemId) ?? null) : null,
        fornecedores: detalhe.fornecedores.map(forn => ({
          ...forn,
          historico: itemId
            ? (intel.fornHistMap.get(historicoFornecedorKey(itemId, forn.fornecedor_id)) ?? null)
            : null,
        })),
      };
    }),
  };
}

export function useRequisicaoCotacoes(requisicaoId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKey(requisicaoId || ''),
    enabled: !!requisicaoId,
    queryFn: async (): Promise<RequisicaoCotacoesData> => {
      const { data: requisicao, error: reqErr } = await supabase
        .from('requisicoes_compra')
        .select(REQUISICAO_DETALHE_SELECT)
        .eq('id', requisicaoId!)
        .single();
      if (reqErr) throw reqErr;

      const itens = (requisicao.requisicoes_compra_itens || []) as RequisicaoCompraItem[];
      const itemIds = [...new Set(itens.map(i => i.item_id).filter(Boolean))] as string[];
      const reqItemIds = itens.map(i => i.id);

      let fornecedoresPorItem = new Map<string, ItemFornecedorCotacao[]>();
      if (itemIds.length > 0) {
        const { data: fornData, error: fornErr } = await supabase
          .from('item_fornecedores')
          .select(`
            id, item_id, fornecedor_id, unidade_compra_padrao, fator_para_unidade_interna,
            qtd_por_pacote, fornecedor_preferencial, preco_referencia, lead_time_dias,
            fornecedor:entidades!item_fornecedores_fornecedor_id_fkey(id, razao_social, nome_fantasia)
          `)
          .in('item_id', itemIds);
        if (fornErr) throw fornErr;

        for (const row of (fornData || []) as unknown as ItemFornecedorCotacao[]) {
          const list = fornecedoresPorItem.get(row.item_id) || [];
          list.push(row);
          fornecedoresPorItem.set(row.item_id, list);
        }
      }

      let cotacoesPorItem = new Map<string, RequisicaoCotacao[]>();
      if (reqItemIds.length > 0) {
        const { data: cotData, error: cotErr } = await supabase
          .from('requisicoes_compra_cotacoes' as 'requisicoes_compra')
          .select('*')
          .in('requisicao_item_id', reqItemIds);
        if (cotErr) throw cotErr;

        for (const row of (cotData || []) as unknown as RequisicaoCotacao[]) {
          const list = cotacoesPorItem.get(row.requisicao_item_id) || [];
          list.push(row);
          cotacoesPorItem.set(row.requisicao_item_id, list);
        }
      }

      const itensDetalhe: ItemCotacaoDetalhe[] = itens.map(item => ({
        item,
        fornecedores: item.item_id ? (fornecedoresPorItem.get(item.item_id) || []) : [],
        cotacoes: cotacoesPorItem.get(item.id) || [],
      }));

      return {
        requisicao: requisicao as RequisicaoCompra,
        itens: itensDetalhe,
      };
    },
  });

  const itemIds = useMemo(
    () => [...new Set((query.data?.itens || []).map(i => i.item.item_id).filter(Boolean))] as string[],
    [query.data?.itens],
  );
  const companyId = query.data?.requisicao?.company_id;

  const inteligenciaQuery = useQuery({
    queryKey: inteligenciaQueryKey(requisicaoId || '', itemIds),
    enabled: !!requisicaoId && itemIds.length > 0 && !!companyId,
    queryFn: () => fetchInteligenciaCompra(itemIds, companyId!),
  });

  const data = useMemo(
    () => (query.data ? mergeInteligencia(query.data, inteligenciaQuery.data) : undefined),
    [query.data, inteligenciaQuery.data],
  );

  const upsertCotacao = useMutation({
    mutationFn: async (input: UpsertCotacaoInput) => {
      const payload = {
        requisicao_item_id: input.requisicao_item_id,
        fornecedor_id: input.fornecedor_id,
        unidade_compra: input.unidade_compra?.trim() || null,
        qtd_por_pacote: input.qtd_por_pacote ?? null,
        qtd_cotada: input.qtd_cotada ?? null,
        preco_unitario: input.preco_unitario ?? null,
        prazo_entrega: input.prazo_entrega?.trim() || null,
        observacao: input.observacao?.trim() || null,
        escolhido: false,
      };

      const { error } = await supabase
        .from('requisicoes_compra_cotacoes' as 'requisicoes_compra')
        .upsert(payload, { onConflict: 'requisicao_item_id,fornecedor_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      if (requisicaoId) {
        queryClient.invalidateQueries({ queryKey: queryKey(requisicaoId) });
        queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
        queryClient.invalidateQueries({
          queryKey: ['requisicao-cotacoes-inteligencia', requisicaoId],
        });
      }
      toast.success('Cotação salva');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao salvar cotação');
    },
  });

  const escolherFornecedor = useMutation({
    mutationFn: async (input: UpsertCotacaoInput) => {
      const payload = {
        requisicao_item_id: input.requisicao_item_id,
        fornecedor_id: input.fornecedor_id,
        unidade_compra: input.unidade_compra?.trim() || null,
        qtd_por_pacote: input.qtd_por_pacote ?? null,
        qtd_cotada: input.qtd_cotada ?? null,
        preco_unitario: input.preco_unitario ?? null,
        prazo_entrega: input.prazo_entrega?.trim() || null,
        observacao: input.observacao?.trim() || null,
        escolhido: false,
      };

      const { error: upsertErr } = await supabase
        .from('requisicoes_compra_cotacoes' as 'requisicoes_compra')
        .upsert(payload, { onConflict: 'requisicao_item_id,fornecedor_id' });
      if (upsertErr) throw upsertErr;

      const { data: cotacao, error: cotErr } = await supabase
        .from('requisicoes_compra_cotacoes' as 'requisicoes_compra')
        .select('*')
        .eq('requisicao_item_id', input.requisicao_item_id)
        .eq('fornecedor_id', input.fornecedor_id)
        .single();
      if (cotErr) throw cotErr;

      const { data: item, error: itemErr } = await supabase
        .from('requisicoes_compra_itens')
        .select('quantidade_faltante, unidade')
        .eq('id', input.requisicao_item_id)
        .single();
      if (itemErr) throw itemErr;

      const cot = cotacao as unknown as RequisicaoCotacao;
      const qtdComprar = calcularQtdComprarCotacao(
        item.quantidade_faltante,
        item.unidade,
        cot.unidade_compra,
        cot.qtd_por_pacote,
      );

      const { error: clearErr } = await supabase
        .from('requisicoes_compra_cotacoes' as 'requisicoes_compra')
        .update({ escolhido: false })
        .eq('requisicao_item_id', input.requisicao_item_id);
      if (clearErr) throw clearErr;

      const { error: pickErr } = await supabase
        .from('requisicoes_compra_cotacoes' as 'requisicoes_compra')
        .update({ escolhido: true })
        .eq('id', cot.id);
      if (pickErr) throw pickErr;

      const { error: itemUpErr } = await supabase
        .from('requisicoes_compra_itens')
        .update({
          fornecedor_id: cot.fornecedor_id,
          preco_cotado: cot.preco_unitario,
          quantidade_comprar: qtdComprar,
        })
        .eq('id', input.requisicao_item_id);
      if (itemUpErr) throw itemUpErr;
    },
    onSuccess: () => {
      if (requisicaoId) {
        queryClient.invalidateQueries({ queryKey: queryKey(requisicaoId) });
        queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
        queryClient.invalidateQueries({
          queryKey: ['requisicao-cotacoes-inteligencia', requisicaoId],
        });
      }
      toast.success('Fornecedor escolhido para o item');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao escolher fornecedor');
    },
  });

  return {
    ...query,
    data,
    isLoadingInteligencia: inteligenciaQuery.isLoading,
    upsertCotacao,
    escolherFornecedor,
  };
}
