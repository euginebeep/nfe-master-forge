import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  STATUS_REQ,
  type StatusRequisicao,
  calcularValorTotal,
  podeTransicionar,
  avaliarRecebimento,
  normalizarStatus,
} from '@/lib/requisicoes-compra';

export interface ItemCadastroEmbalagem {
  embalagem_compra_qtd: number | null;
  embalagem_compra_unidade: string | null;
  unidade_interna: string | null;
  tipo_item?: string | null;
}

export interface RequisicaoCompraItem {
  id: string;
  requisicao_id: string;
  item_id: string | null;
  item_nome: string;
  quantidade_necessaria: number | null;
  quantidade_disponivel: number | null;
  quantidade_faltante: number | null;
  unidade: string | null;
  status: string | null;
  quantidade_comprar: number | null;
  preco_cotado: number | null;
  quantidade_recebida: number | null;
  fornecedor_id: string | null;
  item?: ItemCadastroEmbalagem | null;
}

export interface RequisicaoCompra {
  id: string;
  company_id: string;
  op_id: string | null;
  status: string;
  origem: string | null;
  observacoes: string | null;
  numero_interno: string | null;
  fornecedor_id: string | null;
  prazo_pagamento: string | null;
  condicao_pagamento: string | null;
  valor_total: number | null;
  aprovada_por: string | null;
  aprovada_por_nome: string | null;
  aprovada_em: string | null;
  pedido_enviado_em: string | null;
  recebida_em: string | null;
  nota_entrada_id: string | null;
  created_at: string;
  updated_at: string;
  ordens_producao_industrial?: { codigo: string | null } | null;
  fornecedor?: { id: string; razao_social: string; nome_fantasia: string | null } | null;
  requisicoes_compra_itens?: RequisicaoCompraItem[];
}

export interface HistoricoCompraItem {
  item_id: string;
  num_compras: number | null;
  preco_medio: number | null;
  ultimo_preco: number | null;
  ultima_qtd: number | null;
  ultima_compra_data: string | null;
  ultimo_fornecedor_id: string | null;
  ultimo_fornecedor_nome: string | null;
}

const REQUISICAO_SELECT = `
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

export function useRequisicoesCompra() {
  return useQuery({
    queryKey: ['requisicoes-compra'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('requisicoes_compra')
        .select(REQUISICAO_SELECT)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return ((data || []) as RequisicaoCompra[]).map(r => ({
        ...r,
        status: normalizarStatus(r.status),
      }));
    },
  });
}

export function useHistoricoCompra(itemIds: string[]) {
  return useQuery({
    queryKey: ['item-historico-compra', itemIds],
    enabled: itemIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('item_historico_compra' as 'itens')
        .select(
          'item_id, num_compras, preco_medio, ultimo_preco, ultima_qtd, ultima_compra_data, ultimo_fornecedor_id, ultimo_fornecedor_nome',
        )
        .in('item_id', itemIds);
      if (error) throw error;
      const map = new Map<string, HistoricoCompraItem>();
      for (const row of (data || []) as unknown as HistoricoCompraItem[]) {
        if (row.item_id) map.set(row.item_id, row);
      }
      return map;
    },
  });
}

interface SalvarRequisicaoInput {
  id: string;
  fornecedor_id?: string | null;
  prazo_pagamento?: string | null;
  condicao_pagamento?: string | null;
  valor_total: number;
  status?: StatusRequisicao;
  itens: Array<{
    id: string;
    quantidade_comprar: number | null;
    preco_cotado: number | null;
    fornecedor_id?: string | null;
  }>;
  embalagens?: Array<{
    item_id: string;
    embalagem_compra_qtd: number;
    embalagem_compra_unidade: string;
  }>;
}

async function persistirEmbalagens(
  embalagens: SalvarRequisicaoInput['embalagens'],
) {
  for (const emb of embalagens || []) {
    const { error } = await supabase
      .from('itens')
      .update({
        embalagem_compra_qtd: emb.embalagem_compra_qtd,
        embalagem_compra_unidade: emb.embalagem_compra_unidade,
      })
      .eq('id', emb.item_id);
    if (error) throw error;
  }
}

export function useSalvarRequisicaoCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SalvarRequisicaoInput) => {
      const cabPayload: Record<string, unknown> = {
        fornecedor_id: input.fornecedor_id || null,
        prazo_pagamento: input.prazo_pagamento?.trim() || null,
        condicao_pagamento: input.condicao_pagamento?.trim() || null,
        valor_total: input.valor_total,
        updated_at: new Date().toISOString(),
      };
      if (input.status) cabPayload.status = input.status;

      const { error: cabErr } = await supabase
        .from('requisicoes_compra')
        .update(cabPayload)
        .eq('id', input.id);
      if (cabErr) throw cabErr;

      for (const item of input.itens) {
        const { error: itemErr } = await supabase
          .from('requisicoes_compra_itens')
          .update({
            quantidade_comprar: item.quantidade_comprar,
            preco_cotado: item.preco_cotado,
            fornecedor_id: item.fornecedor_id ?? null,
          })
          .eq('id', item.id);
        if (itemErr) throw itemErr;
      }

      await persistirEmbalagens(input.embalagens);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Requisição salva');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao salvar requisição');
    },
  });
}

export function useAprovarRequisicaoCompra() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      aprovada_por: string;
      aprovada_por_nome: string;
      itens: SalvarRequisicaoInput['itens'];
      fornecedor_id?: string | null;
      prazo_pagamento?: string | null;
      condicao_pagamento?: string | null;
      valor_total: number;
      embalagens?: SalvarRequisicaoInput['embalagens'];
    }) => {
      const agora = new Date().toISOString();

      for (const item of input.itens) {
        const { error: itemErr } = await supabase
          .from('requisicoes_compra_itens')
          .update({
            quantidade_comprar: item.quantidade_comprar,
            preco_cotado: item.preco_cotado,
            fornecedor_id: item.fornecedor_id ?? null,
          })
          .eq('id', item.id);
        if (itemErr) throw itemErr;
      }

      await persistirEmbalagens(input.embalagens);

      const { error } = await supabase
        .from('requisicoes_compra')
        .update({
          status: STATUS_REQ.APROVADA,
          aprovada_por: input.aprovada_por,
          aprovada_por_nome: input.aprovada_por_nome,
          aprovada_em: agora,
          fornecedor_id: input.fornecedor_id || null,
          prazo_pagamento: input.prazo_pagamento?.trim() || null,
          condicao_pagamento: input.condicao_pagamento?.trim() || null,
          valor_total: input.valor_total,
          updated_at: agora,
        })
        .eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Compra aprovada');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao aprovar compra');
    },
  });
}

export function useMarcarPedidoEnviado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('requisicoes_compra')
        .update({
          status: STATUS_REQ.PO_EMITIDO,
          pedido_enviado_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Pedido marcado como enviado');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao marcar pedido enviado');
    },
  });
}

export function useRegistrarRecebimento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      itens: Array<{ id: string; quantidade_recebida: number | null }>;
      nota_entrada_id?: string | null;
    }) => {
      for (const item of input.itens) {
        const { error: itemErr } = await supabase
          .from('requisicoes_compra_itens')
          .update({ quantidade_recebida: item.quantidade_recebida })
          .eq('id', item.id);
        if (itemErr) throw itemErr;
      }

      const { data: itensAtualizados, error: fetchErr } = await supabase
        .from('requisicoes_compra_itens')
        .select('quantidade_comprar, quantidade_recebida')
        .eq('requisicao_id', input.id);
      if (fetchErr) throw fetchErr;

      const novoStatus = avaliarRecebimento(itensAtualizados || []);
      const agora = new Date().toISOString();
      const cabUpdate: Record<string, unknown> = {
        status: novoStatus,
        updated_at: agora,
      };
      if (novoStatus === STATUS_REQ.RECEBIDA) cabUpdate.recebida_em = agora;
      if (input.nota_entrada_id) cabUpdate.nota_entrada_id = input.nota_entrada_id;

      const { error } = await supabase
        .from('requisicoes_compra')
        .update(cabUpdate)
        .eq('id', input.id);
      if (error) throw error;

      return novoStatus;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success(
        status === STATUS_REQ.RECEBIDA ? 'Recebimento completo registrado' : 'Recebimento parcial registrado',
      );
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao registrar recebimento');
    },
  });
}

export function usePedirCotacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('requisicoes_compra')
        .update({ status: STATUS_REQ.EM_RFQ, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      toast.success('Pedido de cotação gerado — requisição em RFQ');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao pedir cotação');
    },
  });
}

const STATUS_PERMITE_EXCLUIR_ITEM: StatusRequisicao[] = [STATUS_REQ.ABERTA, STATUS_REQ.EM_RFQ];

export async function excluirItemRequisicaoComBpf(itemLinhaId: string): Promise<string> {
  const { data: linha, error: fetchErr } = await supabase
    .from('requisicoes_compra_itens')
    .select('id, requisicao_id, requisicoes_compra(status)')
    .eq('id', itemLinhaId)
    .maybeSingle();

  if (fetchErr) throw fetchErr;
  if (!linha?.id) throw new Error('Linha da requisição não encontrada');

  const statusRaw = (linha.requisicoes_compra as { status?: string } | null)?.status;
  const status = statusRaw ? normalizarStatus(statusRaw) : null;

  if (!status || !STATUS_PERMITE_EXCLUIR_ITEM.includes(status)) {
    throw new Error(
      'Só é possível excluir itens de requisições em aberto ou em cotação (RFQ). Requisições em mapa ou posteriores estão bloqueadas.',
    );
  }

  const { error } = await supabase
    .from('requisicoes_compra_itens')
    .delete()
    .eq('id', itemLinhaId);

  if (error) throw error;
  return linha.requisicao_id as string;
}

export function useExcluirItemRequisicao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: excluirItemRequisicaoComBpf,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      queryClient.invalidateQueries({ queryKey: ['compras-necessidades-consolidadas'] });
      toast.success('Item removido da requisição');
    },
    onError: (err: { message?: string; code?: string }) => {
      toast.error(err?.message || err?.code || 'Erro ao excluir item');
    },
  });
}

export { calcularValorTotal, podeTransicionar, STATUS_REQ, normalizarStatus };
