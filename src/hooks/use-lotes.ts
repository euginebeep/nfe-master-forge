import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { EstoqueLote, LoteDocumento, StatusLote } from "@/types/erp";
import { toast } from "sonner";
import { registrarAuditoria } from "@/lib/audit-logger";

export function useLotes(filters?: { item_id?: string; status?: StatusLote }) {
  return useQuery({
    queryKey: ["lotes", filters],
    queryFn: async () => {
      let query = supabase
        .from("estoque_lotes")
        .select(`
          *,
          item:itens (id, sku_interno, descricao_interna, tipo_item, unidade_interna),
          fornecedor:entidades (id, razao_social, documento),
          nota_item:notas_entrada_itens (
            nota:notas_entrada (numero, serie, chave_nfe)
          ),
          lote_documentos (*)
        `)
        .order("created_at", { ascending: false });

      if (filters?.item_id) {
        query = query.eq("item_id", filters.item_id);
      }

      if (filters?.status) {
        query = query.eq("status", filters.status);
      }

      const { data, error } = await query;

      if (error) throw error;

      const achatado = (data ?? []).map((l: any) => ({
        ...l,
        nota_numero: l.nota_item?.nota?.numero ?? null,
        nota_serie: l.nota_item?.nota?.serie ?? null,
      }));

      return (achatado as unknown) as (EstoqueLote & {
        item: { id: string; sku_interno: string; descricao_interna: string; tipo_item: string; unidade_interna: string | null };
        fornecedor: { id: string; razao_social: string; documento: string } | null;
        lote_documentos: LoteDocumento[];
        nota_numero: string | null;
        nota_serie: string | null;
      })[];
    },
  });
}

export function useLote(id: string | undefined) {
  return useQuery({
    queryKey: ["lote", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_lotes")
        .select(`
          *,
          item:itens (*),
          fornecedor:entidades (*),
          lote_documentos (
            *,
            arquivo:arquivos (*)
          )
        `)
        .eq("id", id!)
        .single();

      if (error) throw error;
      return data as EstoqueLote & {
        item: Record<string, unknown> | null;
        fornecedor: Record<string, unknown> | null;
        lote_documentos: (LoteDocumento & { arquivo: Record<string, unknown> | null })[];
      };
    },
  });
}

export function useCreateLote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<EstoqueLote, "id" | "created_at">) => {
      const { data: lote, error } = await supabase
        .from("estoque_lotes")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return lote;
    },
    onSuccess: (lote: any) => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      toast.success("Lote criado com sucesso");
      registrarAuditoria({
        tipo: 'LOTE_CRIADO',
        descricao: `Lote "${lote.numero_lote}" criado`,
        entidade_tipo: 'Lote',
        entidade_id: lote.id,
        entidade_codigo: lote.numero_lote,
      });
    },
    onError: (error) => {
      toast.error("Erro ao criar lote: " + error.message);
    },
  });
}

export function useUpdateLoteStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      observacoes_qc,
    }: {
      id: string;
      status: StatusLote;
      observacoes_qc?: string;
    }) => {
      const { error } = await supabase
        .from("estoque_lotes")
        .update({ status, observacoes_qc } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["lote", vars.id] });
      toast.success("Status do lote atualizado");
      const auditType = vars.status === 'DISPONIVEL' ? 'LOTE_LIBERADO' : vars.status === 'BLOQUEADO' ? 'LOTE_BLOQUEADO' : 'LOTE_ALTERADO';
      registrarAuditoria({
        tipo: auditType as any,
        descricao: `Lote alterado para status "${vars.status}"`,
        entidade_tipo: 'Lote',
        entidade_id: vars.id,
      });
    },
    onError: (error) => {
      toast.error("Erro ao atualizar status: " + error.message);
    },
  });
}

export function useCreateLoteDocumento() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Omit<LoteDocumento, "id" | "created_at">) => {
      const { data: doc, error } = await supabase
        .from("lote_documentos")
        .insert(data as any)
        .select()
        .single();

      if (error) throw error;
      return doc;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["lotes"] });
      queryClient.invalidateQueries({ queryKey: ["lote", vars.lote_id] });
      toast.success("Documento anexado ao lote");
    },
    onError: (error) => {
      toast.error("Erro ao anexar documento: " + error.message);
    },
  });
}

export function useUpdateDocumentoValidacao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      lote_id,
      status_validacao,
      observacoes,
    }: {
      id: string;
      lote_id: string;
      status_validacao: string;
      observacoes?: string;
    }) => {
      const { error } = await supabase
        .from("lote_documentos")
        .update({ status_validacao, observacoes } as any)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["lote", vars.lote_id] });
      toast.success("Validacao atualizada");
    },
  });
}
