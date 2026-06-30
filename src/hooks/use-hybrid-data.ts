// Hybrid hooks — Supabase-only with company_id isolation
// localStorage fallback has been REMOVED to prevent silent data loss

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { centralToast } from '@/components/ui/central-toast';
import { getUserCompanyId } from '@/hooks/use-user-company';

// ===============================
// ITENS HYBRID HOOKS
// ===============================

export interface HybridItem {
  id: string;
  sku_interno: string | null;
  descricao_interna: string;
  descricao_comercial?: string | null;
  tipo_item: string;
  categoria_operacional?: string | null;
  ncm?: string | null;
  ean?: string | null;
  unidade_interna: string;
  controla_lote: boolean;
  controla_validade: boolean;
  criticidade: string | null;
  higroscopico?: boolean | null;
  armazenamento?: string | null;
  unidade_declaracao?: string | null;
  unidade_pesagem?: string | null;
  fator_conversao?: number | null;
  exige_premix?: boolean | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useHybridItens(filters?: { tipo_item?: string; ativo?: boolean }) {
  return useQuery({
    queryKey: ['hybrid-itens', filters],
    queryFn: async (): Promise<HybridItem[]> => {
      let query = supabase
        .from('itens')
        .select('*')
        .order('descricao_interna');

      if (filters?.tipo_item) {
        query = query.eq('tipo_item', filters.tipo_item);
      }

      if (filters?.ativo !== undefined) {
        query = query.eq('ativo', filters.ativo);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useHybridItens] Erro ao buscar itens:', error.message);
        throw error;
      }

      return (data || []) as HybridItem[];
    },
    staleTime: 30000,
  });
}

export function useHybridItem(id: string | undefined) {
  return useQuery({
    queryKey: ['hybrid-item', id],
    enabled: !!id,
    queryFn: async (): Promise<HybridItem | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('itens')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[useHybridItem] Erro:', error.message);
        throw error;
      }

      return data as HybridItem | null;
    },
  });
}

// ===============================
// ENTIDADES HYBRID HOOKS
// ===============================

export interface HybridEntidade {
  id: string;
  tipo_pessoa: string;
  documento: string;
  razao_social: string;
  nome_fantasia?: string | null;
  ie?: string | null;
  im?: string | null;
  cnae?: string | null;
  crt?: string | null;
  status: string;
  classificacao?: string | null;
  tags?: string[] | null;
  site?: string | null;
  observacoes?: string | null;
  created_at?: string;
  updated_at?: string;
  entidade_papeis?: { papel: string }[];
  entidade_contatos?: any[];
  entidade_enderecos?: any[];
  papeis?: string[];
  _primaryContact?: any;
}

export function useHybridEntidades(filters?: { papel?: string; status?: string }) {
  return useQuery({
    queryKey: ['hybrid-entidades', filters],
    queryFn: async (): Promise<HybridEntidade[]> => {
      let query = supabase
        .from('entidades')
        .select(`
          *,
          entidade_papeis (papel),
          entidade_contatos (*)
        `)
        .order('razao_social');

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[useHybridEntidades] Erro:', error.message);
        throw error;
      }

      let result = (data || []).map(ent => ({
        ...ent,
        papeis: ent.entidade_papeis?.map((p: { papel: string }) => p.papel) || [],
        _primaryContact: ent.entidade_contatos?.find((c: { preferencial?: boolean | null }) => c.preferencial) || ent.entidade_contatos?.[0],
      })) as HybridEntidade[];

      if (filters?.papel) {
        result = result.filter(e => e.papeis?.includes(filters.papel!));
      }

      return result;
    },
    staleTime: 30000,
  });
}

export function useHybridEntidade(id: string | undefined) {
  return useQuery({
    queryKey: ['hybrid-entidade', id],
    enabled: !!id,
    queryFn: async (): Promise<HybridEntidade | null> => {
      if (!id) return null;

      const { data, error } = await supabase
        .from('entidades')
        .select(`
          *,
          entidade_papeis (papel),
          entidade_contatos (*),
          entidade_enderecos (*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) {
        console.error('[useHybridEntidade] Erro:', error.message);
        throw error;
      }

      if (!data) return null;

      return {
        ...data,
        papeis: data.entidade_papeis?.map((p: { papel: string }) => p.papel) || [],
        _primaryContact: data.entidade_contatos?.find((c: { preferencial?: boolean | null }) => c.preferencial) || data.entidade_contatos?.[0],
      } as HybridEntidade;
    },
  });
}

// ===============================
// CREATE/UPDATE MUTATIONS
// ===============================

export function useCreateHybridItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<HybridItem, 'id' | 'created_at' | 'updated_at'>) => {
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error('Empresa não configurada. Configure sua empresa antes de criar itens.');

      const { data: item, error } = await supabase
        .from('itens')
        .insert({ ...data, company_id: companyId })
        .select()
        .single();

      if (error) {
        console.error('[useCreateHybridItem] Erro ao criar item:', error.message);
        throw error; // NEVER fallback to localStorage
      }

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hybrid-itens'] });
      queryClient.invalidateQueries({ queryKey: ['itens'] });
      centralToast.success('Item Criado', 'Produto salvo no banco com sucesso');
    },
    onError: (error) => {
      centralToast.error('Erro ao Criar Item', (error as Error).message);
    },
  });
}

export function useCreateHybridEntidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<HybridEntidade, 'id' | 'created_at' | 'updated_at'> & { papeis?: string[] }) => {
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error('Empresa não configurada. Configure sua empresa antes de criar entidades.');

      const { papeis, entidade_papeis, entidade_contatos, entidade_enderecos, _primaryContact, ...entidadeData } = input;

      const { data: entidade, error } = await supabase
        .from('entidades')
        .insert({ ...entidadeData, company_id: companyId })
        .select()
        .single();

      if (error) {
        console.error('[useCreateHybridEntidade] Erro ao criar entidade:', error.message);
        throw error; // NEVER fallback to localStorage
      }

      // Insert papeis
      if (papeis && papeis.length > 0) {
        const { error: papeisError } = await supabase
          .from('entidade_papeis')
          .insert(papeis.map(p => ({ entidade_id: entidade.id, papel: p })));
        
        if (papeisError) {
          console.error('[useCreateHybridEntidade] Erro ao inserir papéis:', papeisError.message);
        }
      }

      return entidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hybrid-entidades'] });
      queryClient.invalidateQueries({ queryKey: ['entidades'] });
      centralToast.success('Entidade Criada', 'Cadastro salvo no banco com sucesso');
    },
    onError: (error) => {
      centralToast.error('Erro ao Criar Entidade', (error as Error).message);
    },
  });
}

export function useUpdateHybridItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HybridItem> }) => {
      const { error } = await supabase
        .from('itens')
        .update(data)
        .eq('id', id);

      if (error) {
        console.error('[useUpdateHybridItem] Erro ao atualizar item:', error.message);
        throw error; // NEVER fallback to localStorage
      }
      
      return { id };
    },
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ['hybrid-itens'] });
      await queryClient.invalidateQueries({ queryKey: ['hybrid-item', vars.id] });
      await queryClient.invalidateQueries({ queryKey: ['itens'] });
      await queryClient.invalidateQueries({ queryKey: ['item', vars.id] });
      centralToast.success('Item Atualizado', 'Alterações salvas com sucesso');
    },
    onError: (error) => {
      centralToast.error('Erro ao Atualizar', (error as Error).message);
    },
  });
}

export function useUpdateHybridEntidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<HybridEntidade> }) => {
      const { papeis, entidade_papeis, entidade_contatos, entidade_enderecos, _primaryContact, ...updateData } = data;

      const { error } = await supabase
        .from('entidades')
        .update(updateData)
        .eq('id', id);

      if (error) {
        console.error('[useUpdateHybridEntidade] Erro ao atualizar entidade:', error.message);
        throw error; // NEVER fallback to localStorage
      }

      // Update papeis if provided
      if (papeis) {
        await supabase
          .from('entidade_papeis')
          .delete()
          .eq('entidade_id', id);

        if (papeis.length > 0) {
          await supabase
            .from('entidade_papeis')
            .insert(papeis.map(p => ({ entidade_id: id, papel: p })));
        }
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hybrid-entidades'] });
      queryClient.invalidateQueries({ queryKey: ['hybrid-entidade', vars.id] });
      queryClient.invalidateQueries({ queryKey: ['entidades'] });
      centralToast.success('Entidade Atualizada', 'Alterações salvas com sucesso');
    },
    onError: (error) => {
      centralToast.error('Erro ao Atualizar Entidade', (error as Error).message);
    },
  });
}
