import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Item, ItemFornecedor, ItemAlias, TipoItem } from "@/types/erp";
import { centralToast } from "@/components/ui/central-toast";
import { getUserCompanyId } from "@/hooks/use-user-company";

export function useItens(filters?: { tipo_item?: TipoItem; ativo?: boolean }) {
  return useQuery({
    queryKey: ["itens", filters],
    queryFn: async () => {
      let query = supabase
        .from("itens")
        .select("*")
        .order("descricao_interna");

      if (filters?.tipo_item) {
        query = query.eq("tipo_item", filters.tipo_item);
      }

      if (filters?.ativo !== undefined) {
        query = query.eq("ativo", filters.ativo);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Item[];
    },
  });
}

export function useItem(id: string | undefined) {
  return useQuery({
    queryKey: ["item", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select(`
          *,
          item_fornecedores (
            *,
            fornecedor:entidades (id, razao_social, documento)
          ),
          item_alias (*)
        `)
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as unknown as Item & {
        item_fornecedores: (ItemFornecedor & { fornecedor: { id: string; razao_social: string; documento: string } })[];
        item_alias: ItemAlias[];
      };
    },
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<Item, "id" | "created_at" | "updated_at">) => {
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error('Empresa não configurada. Configure sua empresa antes de criar itens.');

      const { data: item, error } = await supabase
        .from("itens")
        .insert({ ...data, company_id: companyId } as any)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["itens"] });
      queryClient.invalidateQueries({ queryKey: ["hybrid-itens"] });
      centralToast.success("Item Criado", "Produto cadastrado com sucesso");
    },
    onError: (error) => {
      centralToast.error("Erro ao Criar", error.message);
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Item> }) => {
      const { data: item, error } = await supabase
        .from("itens")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return item;
    },
    onSuccess: async (_, vars) => {
      await queryClient.invalidateQueries({ queryKey: ["itens"] });
      await queryClient.invalidateQueries({ queryKey: ["hybrid-itens"] });
      await queryClient.invalidateQueries({ queryKey: ["item", vars.id] });
      await queryClient.invalidateQueries({ queryKey: ["hybrid-item", vars.id] });
      await queryClient.refetchQueries({ queryKey: ["hybrid-itens"] });
      centralToast.success("Item Atualizado", "Alterações salvas com sucesso");
    },
    onError: (error) => {
      centralToast.error("Erro ao Atualizar", error.message);
    },
  });
}

export function useCreateItemFornecedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<ItemFornecedor, "id" | "created_at">) => {
      const { data: forn, error } = await supabase
        .from("item_fornecedores")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return forn;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["item", vars.item_id] });
      centralToast.success("Fornecedor Vinculado");
    },
    onError: (error) => {
      centralToast.error("Erro ao Vincular", error.message);
    },
  });
}

export function useUpdateItemFornecedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      item_id,
      data,
    }: {
      id: string;
      item_id: string;
      data: Partial<ItemFornecedor>;
    }) => {
      const { error } = await supabase
        .from("item_fornecedores")
        .update(data as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["item", vars.item_id] });
      centralToast.success("Fornecedor Atualizado");
    },
  });
}

export function useDeleteItemFornecedor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, item_id }: { id: string; item_id: string }) => {
      const { error } = await supabase
        .from("item_fornecedores")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["item", vars.item_id] });
      centralToast.success("Fornecedor Removido");
    },
  });
}

export function useCreateItemAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<ItemAlias, "id" | "created_at">) => {
      const { data: alias, error } = await supabase
        .from("item_alias")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return alias;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["item", vars.item_id] });
      centralToast.success("Alias Adicionado");
    },
  });
}

export function useDeleteItemAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, item_id }: { id: string; item_id: string }) => {
      const { error } = await supabase.from("item_alias").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["item", vars.item_id] });
      centralToast.success("Alias Removido");
    },
  });
}

export function useFindItemByEAN() {
  return useMutation({
    mutationFn: async (ean: string) => {
      const { data, error } = await supabase
        .from("itens")
        .select("*")
        .eq("ean", ean)
        .maybeSingle();

      if (error) throw error;
      return data as Item | null;
    },
  });
}

export function useFindItemByFornecedorCodigo() {
  return useMutation({
    mutationFn: async ({
      fornecedor_id,
      codigo_fornecedor,
    }: {
      fornecedor_id: string;
      codigo_fornecedor: string;
    }) => {
      const { data, error } = await supabase
        .from("item_fornecedores")
        .select("*, itens(*)")
        .eq("fornecedor_id", fornecedor_id)
        .eq("codigo_fornecedor", codigo_fornecedor)
        .maybeSingle();

      if (error) throw error;
      return data ? (data as any).itens as Item : null;
    },
  });
}
