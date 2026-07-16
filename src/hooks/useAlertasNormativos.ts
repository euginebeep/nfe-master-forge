/**
 * Alertas normativos ANVISA (monitor diário).
 * Só leitura + marcar revisado — nunca publica base sozinho.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

export interface AlertaNormativo {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  norma: string | null;
  constituintes_afetados: string[] | null;
  fonte_url: string | null;
  critico: boolean;
  status_revisao: string;
  lido: boolean;
  created_at: string;
}

export function useAlertasNormativosPendentes() {
  return useQuery({
    queryKey: ["anvisa", "alertas-normativos-pendentes"],
    queryFn: async (): Promise<AlertaNormativo[]> => {
      // status_revisao adicionada na migration ligar-monitor — cast até regenerar types
      const { data, error } = await supabase
        .from("anvisa_alertas_normativos")
        .select("*")
        .eq("status_revisao" as never, "PENDENTE" as never)
        .order("critico", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        // Fallback pré-migration: alertas não lidos
        const fb = await supabase
          .from("anvisa_alertas_normativos")
          .select("*")
          .eq("lido", false)
          .order("critico", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(50);
        if (fb.error) throw fb.error;
        return (fb.data ?? []).map((r) => ({
          id: r.id,
          tipo: r.tipo,
          titulo: r.titulo,
          descricao: r.descricao,
          norma: r.norma,
          constituintes_afetados: r.constituintes_afetados,
          fonte_url: r.fonte_url,
          critico: Boolean(r.critico),
          status_revisao: "PENDENTE",
          lido: Boolean(r.lido),
          created_at: r.created_at,
        }));
      }
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id),
        tipo: String(r.tipo),
        titulo: String(r.titulo),
        descricao: (r.descricao as string | null) ?? null,
        norma: (r.norma as string | null) ?? null,
        constituintes_afetados: (r.constituintes_afetados as string[] | null) ?? null,
        fonte_url: (r.fonte_url as string | null) ?? null,
        critico: Boolean(r.critico),
        status_revisao: String(r.status_revisao ?? "PENDENTE"),
        lido: Boolean(r.lido),
        created_at: String(r.created_at),
      }));
    },
  });
}

export function useConstituintesRequeremRehomologacao() {
  return useQuery({
    queryKey: ["anvisa", "requer-rehomologacao"],
    queryFn: async (): Promise<
      Array<{
        id: string;
        nome_tecnico: string;
        requer_rehomologacao_motivo: string | null;
        requer_rehomologacao_em: string | null;
      }>
    > => {
      const { data, error } = await supabase
        .from("anvisa_constituintes")
        .select("id, nome_tecnico, requer_rehomologacao_motivo, requer_rehomologacao_em")
        .eq("requer_rehomologacao" as never, true as never)
        .order("nome_tecnico")
        .limit(100);
      if (error) {
        // Coluna ainda não aplicada — silencioso
        if (error.message?.includes("requer_rehomologacao") || error.code === "42703") {
          return [];
        }
        throw error;
      }
      return (data ?? []) as Array<{
        id: string;
        nome_tecnico: string;
        requer_rehomologacao_motivo: string | null;
        requer_rehomologacao_em: string | null;
      }>;
    },
  });
}

export function useMarcarAlertaRevisado() {
  const qc = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (input: {
      id: string;
      status: "APROVADO" | "DESCARTADO";
    }) => {
      const { error } = await supabase
        .from("anvisa_alertas_normativos")
        .update({
          status_revisao: input.status,
          lido: true,
          revisado_por: user?.id ?? null,
          revisado_em: new Date().toISOString(),
        } as never)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anvisa", "alertas-normativos-pendentes"] });
    },
  });
}

/** Dispara o monitor manualmente (teste / forçar corrida). */
export async function invocarMonitorAnvisaDiario() {
  const { data, error } = await supabase.functions.invoke("monitor-anvisa-diario", {
    body: { trigger: "manual" },
  });
  if (error) throw error;
  return data;
}
