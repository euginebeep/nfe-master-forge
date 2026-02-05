// Hybrid hooks that use Supabase as primary source with localStorage fallback
// These hooks first try Supabase, then fall back to localStorage if no data

import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { LocalDb } from '@/lib/local-db';
import { toast } from 'sonner';
import type { LocalItem } from '@/hooks/use-local-itens';
import type { LocalEntidade, LocalEntidadeContato, LocalEntidadeEndereco } from '@/hooks/use-local-entidades';

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
      // Try Supabase first
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

      const { data: supabaseData, error } = await query;

      // If Supabase has data, use it
      if (!error && supabaseData && supabaseData.length > 0) {
        return supabaseData as HybridItem[];
      }

      // Fallback to localStorage
      let localData = LocalDb.getCollection<LocalItem>('itens');
      
      if (filters?.tipo_item) {
        localData = localData.filter(i => i.tipo_item === filters.tipo_item);
      }
      if (filters?.ativo !== undefined) {
        localData = localData.filter(i => i.ativo === filters.ativo);
      }

      return localData.map(item => ({
        ...item,
        sku_interno: item.sku_interno || null,
        descricao_comercial: item.descricao_comercial || null,
        categoria_operacional: item.categoria_operacional || null,
        ncm: item.ncm || null,
        ean: item.ean || null,
        criticidade: item.criticidade || 'NORMAL',
        higroscopico: item.higroscopico || false,
        armazenamento: item.armazenamento || 'AMBIENTE',
        unidade_declaracao: item.unidade_declaracao || null,
        unidade_pesagem: item.unidade_pesagem || null,
        fator_conversao: item.fator_conversao || null,
        exige_premix: item.exige_premix || false,
      }));
    },
    staleTime: 30000, // 30 seconds
  });
}

export function useHybridItem(id: string | undefined) {
  return useQuery({
    queryKey: ['hybrid-item', id],
    enabled: !!id,
    queryFn: async (): Promise<HybridItem | null> => {
      if (!id) return null;

      // Try Supabase first
      const { data: supabaseData, error } = await supabase
        .from('itens')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && supabaseData) {
        return supabaseData as HybridItem;
      }

      // Fallback to localStorage
      const localItem = LocalDb.getById<LocalItem>('itens', id);
      if (localItem) {
        return {
          ...localItem,
          sku_interno: localItem.sku_interno || null,
          descricao_comercial: localItem.descricao_comercial || null,
          categoria_operacional: localItem.categoria_operacional || null,
          ncm: localItem.ncm || null,
          ean: localItem.ean || null,
          criticidade: localItem.criticidade || 'NORMAL',
        };
      }

      return null;
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
  // Joined data
  entidade_papeis?: { papel: string }[];
  entidade_contatos?: LocalEntidadeContato[];
  entidade_enderecos?: LocalEntidadeEndereco[];
  // Computed field for local compatibility
  papeis?: string[];
  _primaryContact?: LocalEntidadeContato;
}

export function useHybridEntidades(filters?: { papel?: string; status?: string }) {
  return useQuery({
    queryKey: ['hybrid-entidades', filters],
    queryFn: async (): Promise<HybridEntidade[]> => {
      // Try Supabase first
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

      const { data: supabaseData, error } = await query;

      // If Supabase has data, use it
      if (!error && supabaseData && supabaseData.length > 0) {
        let result = supabaseData.map(ent => ({
          ...ent,
          papeis: ent.entidade_papeis?.map((p: { papel: string }) => p.papel) || [],
          _primaryContact: ent.entidade_contatos?.find((c: any) => c.preferencial) || ent.entidade_contatos?.[0],
        })) as HybridEntidade[];

        // Filter by papel if needed
        if (filters?.papel) {
          result = result.filter(e => e.papeis?.includes(filters.papel!));
        }

        return result;
      }

      // Fallback to localStorage
      let localData = LocalDb.getCollection<LocalEntidade>('entidades');
      
      if (filters?.papel) {
        localData = localData.filter(e => e.papeis?.includes(filters.papel as any));
      }
      if (filters?.status) {
        localData = localData.filter(e => e.status === filters.status);
      }

      // Enrich with contacts
      const contatos = LocalDb.getCollection<LocalEntidadeContato>('entidade_contatos');
      
      return localData.map(ent => ({
        ...ent,
        nome_fantasia: ent.nome_fantasia || null,
        ie: ent.ie || null,
        im: ent.im || null,
        cnae: ent.cnae || null,
        crt: ent.crt || null,
        classificacao: ent.classificacao || 'REGULAR',
        tags: ent.tags || [],
        site: ent.site || null,
        observacoes: ent.observacoes || null,
        _primaryContact: contatos.find(c => c.entidade_id === ent.id && c.preferencial) 
          || contatos.find(c => c.entidade_id === ent.id),
      }));
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

      // Try Supabase first
      const { data: supabaseData, error } = await supabase
        .from('entidades')
        .select(`
          *,
          entidade_papeis (papel),
          entidade_contatos (*),
          entidade_enderecos (*)
        `)
        .eq('id', id)
        .maybeSingle();

      if (!error && supabaseData) {
        return {
          ...supabaseData,
          papeis: supabaseData.entidade_papeis?.map((p: { papel: string }) => p.papel) || [],
          _primaryContact: supabaseData.entidade_contatos?.find((c: any) => c.preferencial) || supabaseData.entidade_contatos?.[0],
        } as HybridEntidade;
      }

      // Fallback to localStorage
      const localEnt = LocalDb.getById<LocalEntidade>('entidades', id);
      if (localEnt) {
        const contatos = LocalDb.query<LocalEntidadeContato>('entidade_contatos', c => c.entidade_id === id);
        const enderecos = LocalDb.query<LocalEntidadeEndereco>('entidade_enderecos', e => e.entidade_id === id);
        
        return {
          ...localEnt,
          nome_fantasia: localEnt.nome_fantasia || null,
          entidade_contatos: contatos,
          entidade_enderecos: enderecos,
          _primaryContact: contatos.find(c => c.preferencial) || contatos[0],
        };
      }

      return null;
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
      // Try to create in Supabase first
      const { data: item, error } = await supabase
        .from('itens')
        .insert(data)
        .select()
        .single();

      if (error) {
        // Fallback: create in localStorage
        const localItem = LocalDb.insert<LocalItem>('itens', {
          ...data,
          sku_interno: data.sku_interno || LocalDb.generateSKU(data.tipo_item),
        } as any);
        return localItem;
      }

      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hybrid-itens'] });
      toast.success('Item criado com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar item: ' + (error as Error).message);
    },
  });
}

export function useCreateHybridEntidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: Omit<HybridEntidade, 'id' | 'created_at' | 'updated_at'> & { papeis?: string[] }) => {
      const { papeis, entidade_papeis, entidade_contatos, entidade_enderecos, _primaryContact, ...entidadeData } = input;

      // Try to create in Supabase first
      const { data: entidade, error } = await supabase
        .from('entidades')
        .insert(entidadeData)
        .select()
        .single();

      if (error) {
        // Fallback: create in localStorage
        const localEnt = LocalDb.insert<LocalEntidade>('entidades', {
          ...entidadeData,
          papeis: papeis || [],
          tags: input.tags || [],
        } as any);
        return localEnt;
      }

      // Insert papeis
      if (papeis && papeis.length > 0) {
        await supabase
          .from('entidade_papeis')
          .insert(papeis.map(p => ({ entidade_id: entidade.id, papel: p })));
      }

      return entidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hybrid-entidades'] });
      toast.success('Entidade criada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao criar entidade: ' + (error as Error).message);
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
        // Fallback: update in localStorage
        LocalDb.update<LocalItem>('itens', id, data as any);
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ['hybrid-itens'] });
      queryClient.invalidateQueries({ queryKey: ['hybrid-item', vars.id] });
      toast.success('Item atualizado com sucesso');
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
        // Fallback: update in localStorage
        LocalDb.update<LocalEntidade>('entidades', id, data as any);
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
      toast.success('Entidade atualizada com sucesso');
    },
  });
}
