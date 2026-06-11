// Supabase-backed hooks for item fornecedores and estoque lotes
// Replaces localStorage-based hooks from use-local-itens.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getUserCompanyId } from '@/hooks/use-user-company';

// ====================================================
// ITEM FORNECEDORES (Supabase)
// ====================================================

export interface SupabaseItemFornecedor {
  id: string;
  item_id: string;
  fornecedor_id: string;
  codigo_fornecedor: string | null;
  descricao_fornecedor: string | null;
  unidade_compra_padrao: string | null;
  fator_para_unidade_interna: number | null;
  fornecedor_preferencial: boolean | null;
  preco_referencia: number | null;
  lead_time_dias: number | null;
  moq: number | null;
  created_at: string | null;
  // Joined
  fornecedor?: { razao_social: string } | null;
}

export function useSupabaseItemFornecedores(itemId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ['item-fornecedores', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<SupabaseItemFornecedor[]> => {
      const { data, error } = await supabase
        .from('item_fornecedores')
        .select('*, fornecedor:entidades!item_fornecedores_fornecedor_id_fkey(razao_social)')
        .eq('item_id', itemId!);

      if (error) throw error;
      return (data || []) as unknown as SupabaseItemFornecedor[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      item_id: string;
      fornecedor_id: string;
      codigo_fornecedor?: string;
      descricao_fornecedor?: string;
      unidade_compra_padrao?: string;
      fator_para_unidade_interna?: number;
      fornecedor_preferencial?: boolean;
      preco_referencia?: number;
    }) => {
      // Check duplicate
      const { data: existing } = await supabase
        .from('item_fornecedores')
        .select('id')
        .eq('item_id', data.item_id)
        .eq('fornecedor_id', data.fornecedor_id)
        .maybeSingle();

      if (existing) {
        throw new Error('Este fornecedor já está vinculado ao item');
      }

      const { error } = await supabase
        .from('item_fornecedores')
        .insert(data);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-fornecedores', itemId] });
      toast.success('Fornecedor vinculado');
    },
    onError: (err) => toast.error((err as Error).message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('item_fornecedores')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['item-fornecedores', itemId] });
      toast.success('Fornecedor removido');
    },
    onError: () => toast.error('Erro ao remover fornecedor'),
  });

  return {
    fornecedores,
    isLoading,
    create: (data: Parameters<typeof createMutation.mutate>[0]) => createMutation.mutate(data),
    remove: (id: string) => removeMutation.mutate(id),
  };
}

// ====================================================
// ESTOQUE LOTES (Supabase)
// ====================================================

export interface SupabaseEstoqueLote {
  id: string;
  item_id: string;
  fornecedor_id: string | null;
  nota_entrada_item_id: string | null;
  numero_lote: string;
  data_fab: string | null;
  data_val: string | null;
  quantidade_original: number;
  unidade_original: string | null;
  quantidade_interna: number;
  custo_unitario_original: number | null;
  custo_unitario_interno: number | null;
  status: string;
  observacoes_qc: string | null;
  company_id: string | null;
  created_at: string | null;
  // Joined data
  fornecedor?: { razao_social: string } | null;
  nota_entrada_item?: {
    vprod: number | null;
    nota_entrada?: {
      numero: string | null;
      serie: string | null;
      dh_emissao: string | null;
      chave_nfe: string | null;
    } | null;
  } | null;
  lote_documentos?: SupabaseLoteDocumento[];
}

export interface SupabaseItemAlias {
  id: string;
  item_id: string;
  fornecedor_id: string | null;
  tipo: string;
  texto: string;
  created_at: string | null;
}

export interface SupabaseArquivo {
  id: string;
  nome_original: string;
  mime_type: string;
  tamanho: number;
  storage_key: string;
  checksum_sha256: string | null;
  sensivel: boolean | null;
  created_at: string | null;
  company_id: string | null;
}

export interface SupabaseLoteDocumento {
  id: string;
  lote_id: string;
  tipo_documento: string;
  arquivo_id: string | null;
  hash_arquivo: string | null;
  versao: number | null;
  data_emissao: string | null;
  status_validacao: string;
  observacoes: string | null;
  created_at: string | null;
  arquivo?: SupabaseArquivo | null;
}

export function useSupabaseEstoqueLotes(itemId: string | undefined) {
  const queryClient = useQueryClient();

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ['estoque-lotes', itemId],
    enabled: !!itemId,
    queryFn: async (): Promise<SupabaseEstoqueLote[]> => {
      const { data, error } = await supabase
        .from('estoque_lotes')
        .select(`
          *,
          fornecedor:entidades!estoque_lotes_fornecedor_id_fkey(razao_social),
          nota_entrada_item:notas_entrada_itens!estoque_lotes_nota_entrada_item_id_fkey(
            vprod,
            nota_entrada:notas_entrada!notas_entrada_itens_nota_entrada_id_fkey(
              numero, serie, dh_emissao, chave_nfe
            )
          ),
          lote_documentos(id, tipo_documento, status_validacao)
        `)
        .eq('item_id', itemId!)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as SupabaseEstoqueLote[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('estoque_lotes')
        .update(data)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-lotes', itemId] });
      toast.success('Lote atualizado');
    },
    onError: () => toast.error('Erro ao atualizar lote'),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('estoque_lotes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['estoque-lotes', itemId] });
      toast.success('Lote removido');
    },
    onError: () => toast.error('Erro ao remover lote'),
  });

  return {
    lotes,
    isLoading,
    update: (id: string, data: Record<string, unknown>) => updateMutation.mutate({ id, data }),
    remove: (id: string) => removeMutation.mutate(id),
  };
}
