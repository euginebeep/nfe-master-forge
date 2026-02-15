import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { EntidadeCompleta, EntidadeFiscalConfig, EntidadeFinanceiroConfig, EntidadeComercialCRM, EntidadeLogisticaConfig } from "@/types/entidades";

export function useEntidadeCompleta(id: string | undefined) {
  return useQuery({
    queryKey: ["entidade-completa", id],
    enabled: !!id && id !== 'novo',
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select(`
          *,
          entidade_papeis (*),
          entidade_contatos (*),
          entidade_enderecos (*),
          entidade_fiscal_config (*),
          entidade_financeiro_config (*),
          entidade_comercial_crm (*),
          entidade_logistica_config (*),
          entidade_documentos (*)
        `)
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as unknown as EntidadeCompleta;
    },
  });
}

export function useEntidadesCompletas(filters?: { 
  papel?: string; 
  status?: string;
  classificacao?: string;
  uf?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ["entidades-completas", filters],
    queryFn: async () => {
      let query = supabase
        .from("entidades")
        .select(`
          *,
          entidade_papeis (*),
          entidade_contatos (*),
          entidade_enderecos (*)
        `)
        .order("razao_social");

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      if (filters?.classificacao) {
        query = query.eq("classificacao", filters.classificacao);
      }

      const { data, error } = await query;
      if (error) throw error;

      let result = data as unknown as EntidadeCompleta[];

      // Filter by papel
      if (filters?.papel) {
        result = result.filter((e) =>
          e.entidade_papeis?.some((p) => p.papel === filters.papel)
        );
      }

      // Filter by UF
      if (filters?.uf) {
        result = result.filter((e) =>
          e.entidade_enderecos?.some((end) => end.uf === filters.uf)
        );
      }

      return result;
    },
  });
}

export function useUpsertFiscalConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<EntidadeFiscalConfig> & { entidade_id: string }) => {
      const { error } = await supabase
        .from("entidade_fiscal_config")
        .upsert(data as any, { onConflict: 'entidade_id' });

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade-completa", vars.entidade_id] });
      toast.success("Configuração fiscal salva");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configuração fiscal: " + error.message);
    },
  });
}

export function useUpsertFinanceiroConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<EntidadeFinanceiroConfig> & { entidade_id: string }) => {
      const { error } = await supabase
        .from("entidade_financeiro_config")
        .upsert(data as any, { onConflict: 'entidade_id' });

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade-completa", vars.entidade_id] });
      toast.success("Configuração financeira salva");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configuração financeira: " + error.message);
    },
  });
}

export function useUpsertComercialCRM() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<EntidadeComercialCRM> & { entidade_id: string }) => {
      const { error } = await supabase
        .from("entidade_comercial_crm")
        .upsert(data as any, { onConflict: 'entidade_id' });

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade-completa", vars.entidade_id] });
      toast.success("Configuração comercial/CRM salva");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configuração comercial: " + error.message);
    },
  });
}

export function useUpsertLogisticaConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<EntidadeLogisticaConfig> & { entidade_id: string }) => {
      const { error } = await supabase
        .from("entidade_logistica_config")
        .upsert(data as any, { onConflict: 'entidade_id' });

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade-completa", vars.entidade_id] });
      toast.success("Configuração logística salva");
    },
    onError: (error) => {
      toast.error("Erro ao salvar configuração logística: " + error.message);
    },
  });
}

export function useUploadDocumentoEntidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entidade_id, file, tipo, observacoes }: { 
      entidade_id: string; 
      file: File; 
      tipo: string;
      observacoes?: string;
    }) => {
      // Upload to storage
      const fileName = `${entidade_id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('erp-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create document record
      const { error: insertError } = await supabase
        .from("entidade_documentos")
        .insert({
          entidade_id,
          tipo,
          nome_arquivo: file.name,
          mime_type: file.type,
          tamanho_bytes: file.size,
          storage_key: fileName,
          observacoes,
        } as any);

      if (insertError) throw insertError;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade-completa", vars.entidade_id] });
      toast.success("Documento enviado com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao enviar documento: " + error.message);
    },
  });
}

export function useDeleteDocumentoEntidade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, entidade_id, storage_key }: { id: string; entidade_id: string; storage_key: string }) => {
      // Delete from storage
      await supabase.storage.from('erp-files').remove([storage_key]);

      // Delete record
      const { error } = await supabase
        .from("entidade_documentos")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["entidade-completa", vars.entidade_id] });
      toast.success("Documento removido");
    },
    onError: (error) => {
      toast.error("Erro ao remover documento: " + error.message);
    },
  });
}

export function useAuditoriaEntidade(entidade_id: string | undefined) {
  return useQuery({
    queryKey: ["auditoria-entidade", entidade_id],
    enabled: !!entidade_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("entidade", "entidades")
        .eq("entidade_id", entidade_id!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useTransportadorasDisponiveis() {
  return useQuery({
    queryKey: ["transportadoras-disponiveis"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select(`
          id, razao_social, nome_fantasia,
          entidade_papeis!inner (papel)
        `)
        .eq("status", "ATIVO");

      if (error) throw error;
      
      // Filter to only transportadoras
      return (data || []).filter((e: { entidade_papeis?: { papel: string }[] }) => 
        e.entidade_papeis?.some((p) => p.papel === 'TRANSPORTADORA')
      );
    },
  });
}
