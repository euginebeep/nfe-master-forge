import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Entidade, EntidadePapel, EntidadeContato, EntidadeEndereco } from "@/types/erp";
import { toast } from "sonner";

export function useEntidades(filters?: { papel?: string; status?: string }) {
  return useQuery({
    queryKey: ["entidades", filters],
    queryFn: async () => {
      // Se filtramos por papel, usamos inner join (!) para filtrar no SQL
      const selectClause = filters?.papel
        ? `*, entidade_papeis!inner(*)`
        : `*, entidade_papeis(*)`;

      let query = supabase
        .from("entidades")
        .select(selectClause)
        .order("razao_social");

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      // Filtro por papel diretamente no SQL via inner join
      if (filters?.papel) {
        query = query.eq("entidade_papeis.papel", filters.papel);
      }

      const { data, error } = await query;

      if (error) throw error;

      // RLS filtra por company_id automaticamente
      return data as (Entidade & { entidade_papeis: EntidadePapel[] })[];
    },
  });
}

export function useEntidade(id: string | undefined) {
  return useQuery({
    queryKey: ["entidade", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select(`
          *,
          entidade_papeis (*),
          entidade_contatos (*),
          entidade_enderecos (*)
        `)
        .eq("id", id!)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return data as Entidade & {
        entidade_papeis: EntidadePapel[];
        entidade_contatos: EntidadeContato[];
        entidade_enderecos: EntidadeEndereco[];
      };
    },
  });
}

export function useCreateEntidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: Omit<Entidade, "id" | "created_at" | "updated_at"> & {
        papeis?: string[];
      }
    ) => {
      const { papeis, ...entidadeData } = input;

      const { data: entidade, error } = await supabase
        .from("entidades")
        .insert(entidadeData as any)
        .select()
        .single();

      if (error) throw error;

      if (papeis && papeis.length > 0) {
        const { error: papeisError } = await supabase
          .from("entidade_papeis")
          .insert(papeis.map((p) => ({ entidade_id: entidade.id, papel: p })) as any);

        if (papeisError) throw papeisError;
      }

      return entidade;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entidades"] });
      toast.success("Entidade criada com sucesso");
    },
    onError: (error: Error & { code?: string }) => {
      if (error?.code === '23505' || error?.message?.includes('entidades_documento_key')) {
        toast.error("Já existe uma entidade cadastrada com este CPF/CNPJ.");
      } else {
        toast.error("Erro ao criar entidade: " + error.message);
      }
    },
  });
}

export function useUpdateEntidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<Entidade>;
    }) => {
      const { data: entidade, error } = await supabase
        .from("entidades")
        .update(data as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return entidade;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidades"] });
      queryClient.invalidateQueries({ queryKey: ["entidade", vars.id] });
      toast.success("Entidade atualizada com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar entidade: " + error.message);
    },
  });
}

export function useDeleteEntidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Delete related records first
      await supabase.from("entidade_contatos").delete().eq("entidade_id", id);
      await supabase.from("entidade_enderecos").delete().eq("entidade_id", id);
      await supabase.from("entidade_papeis").delete().eq("entidade_id", id);
      await supabase.from("entidade_fiscal_config").delete().eq("entidade_id", id);
      await supabase.from("entidade_financeiro_config").delete().eq("entidade_id", id);
      await supabase.from("entidade_comercial_crm").delete().eq("entidade_id", id);
      await supabase.from("entidade_logistica_config").delete().eq("entidade_id", id);

      const { error } = await supabase.from("entidades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entidades"] });
      queryClient.invalidateQueries({ queryKey: ["hybrid-entidades"] });
      toast.success("Entidade excluída com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao excluir entidade: " + error.message);
    },
  });
}

export function useUpsertEntidadePapeis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      entidade_id,
      papeis,
    }: {
      entidade_id: string;
      papeis: string[];
    }) => {
      await supabase
        .from("entidade_papeis")
        .delete()
        .eq("entidade_id", entidade_id);

      if (papeis.length > 0) {
        const insertData = papeis.map((papel) => ({ entidade_id, papel }));
        const { error } = await supabase
          .from("entidade_papeis")
          .insert(insertData);

        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade", vars.entidade_id] });
    },
  });
}

export function useCreateContato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<EntidadeContato, "id" | "created_at">) => {
      const { data: contato, error } = await supabase
        .from("entidade_contatos")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return contato;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade", vars.entidade_id] });
      toast.success("Contato adicionado");
    },
    onError: (error) => {
      toast.error("Erro ao adicionar contato: " + error.message);
    },
  });
}

export function useUpdateContato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      entidade_id,
      data,
    }: {
      id: string;
      entidade_id: string;
      data: Partial<EntidadeContato>;
    }) => {
      const { error } = await supabase
        .from("entidade_contatos")
        .update(data as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade", vars.entidade_id] });
      toast.success("Contato atualizado");
    },
  });
}

export function useDeleteContato() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, entidade_id }: { id: string; entidade_id: string }) => {
      const { error } = await supabase
        .from("entidade_contatos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade", vars.entidade_id] });
      toast.success("Contato removido");
    },
  });
}

export function useCreateEndereco() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<EntidadeEndereco, "id" | "created_at">) => {
      const { data: endereco, error } = await supabase
        .from("entidade_enderecos")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return endereco;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade", vars.entidade_id] });
      toast.success("Endereco adicionado");
    },
  });
}

export function useUpdateEndereco() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      entidade_id,
      data,
    }: {
      id: string;
      entidade_id: string;
      data: Partial<EntidadeEndereco>;
    }) => {
      const { error } = await supabase
        .from("entidade_enderecos")
        .update(data as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade", vars.entidade_id] });
      toast.success("Endereco atualizado");
    },
  });
}

export function useDeleteEndereco() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, entidade_id }: { id: string; entidade_id: string }) => {
      const { error } = await supabase
        .from("entidade_enderecos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade", vars.entidade_id] });
      toast.success("Endereco removido");
    },
  });
}

export function useFindEntidadeByDocumento() {
  return useMutation({
    mutationFn: async (documento: string) => {
      const cleaned = documento.replace(/\D/g, "");
      const { data, error } = await supabase
        .from("entidades")
        .select("*")
        .eq("documento", cleaned)
        .maybeSingle();

      if (error) throw error;
      return data as Entidade | null;
    },
  });
}
