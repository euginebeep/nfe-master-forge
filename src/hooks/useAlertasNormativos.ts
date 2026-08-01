/**
 * Alertas normativos ANVISA (monitor diário).
 * Só leitura + marcar revisado — nunca publica base sozinho.
 * Validação de nomes: fonte única anvisa_consultar.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { rpcAnvisaConsultar } from "@/lib/anvisa-consultar";
import { invokeEdge } from "@/lib/edge-invoke";

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

interface MonitorAnvisaDiarioResponse {
  total_mudancas?: number;
  total_fontes_inacessiveis?: number;
}

/** Confere um nome citado no alerta contra a fonte única. */
export async function validarNomeNoAlerta(nome: string) {
  return rpcAnvisaConsultar({ termo: nome });
}

export function useAlertasNormativosPendentes() {
  return useQuery({
    queryKey: ["anvisa", "alertas-normativos-pendentes"],
    queryFn: async (): Promise<AlertaNormativo[]> => {
      const { data, error } = await supabase
        .from("anvisa_alertas_normativos")
        .select("*")
        .eq("status_revisao" as never, "PENDENTE" as never)
        .order("critico", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
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
        consulta_status?: string;
        consulta_mensagem?: string;
      }>
    > => {
      const { data, error } = await supabase
        .from("anvisa_constituintes")
        .select("id, nome_tecnico, requer_rehomologacao_motivo, requer_rehomologacao_em")
        .eq("requer_rehomologacao" as never, true as never)
        .order("nome_tecnico")
        .limit(100);
      if (error) {
        if (error.message?.includes("requer_rehomologacao") || error.code === "42703") {
          return [];
        }
        throw error;
      }
      const rows = (data ?? []) as Array<{
        id: string;
        nome_tecnico: string;
        requer_rehomologacao_motivo: string | null;
        requer_rehomologacao_em: string | null;
      }>;

      const enriched = await Promise.all(
        rows.slice(0, 30).map(async (r) => {
          const c = await rpcAnvisaConsultar({ termo: r.nome_tecnico });
          return {
            ...r,
            consulta_status: c.status,
            consulta_mensagem: c.mensagem,
          };
        }),
      );
      return [...enriched, ...rows.slice(30)];
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

export async function invocarMonitorAnvisaDiario() {
  const { data, error } = await invokeEdge<MonitorAnvisaDiarioResponse>("monitor-anvisa-diario", { trigger: "manual" });
  if (error) throw new Error(error);
  return data;
}
