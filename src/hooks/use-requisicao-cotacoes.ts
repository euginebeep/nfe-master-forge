import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  fornecedor?: {
    id: string;
    razao_social: string;
    nome_fantasia: string | null;
  } | null;
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
}

export interface ItemCotacaoDetalhe {
  item: RequisicaoCompraItem;
  fornecedores: ItemFornecedorCotacao[];
  cotacoes: RequisicaoCotacao[];
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
    item:itens(embalagem_compra_qtd, embalagem_compra_unidade, unidade_interna)
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
            qtd_por_pacote, fornecedor_preferencial,
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
      }
      toast.success('Fornecedor escolhido para o item');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao escolher fornecedor');
    },
  });

  return {
    ...query,
    upsertCotacao,
    escolherFornecedor,
  };
}
