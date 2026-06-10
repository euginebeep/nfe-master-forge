import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type EventoNfe =
  | "RESERVA_NUMERO"
  | "EMISSAO"
  | "PROTOCOLO"
  | "REJEICAO"
  | "CANCELAMENTO"
  | "CC_E"
  | "INUTILIZACAO"
  | "REIMPRESSAO"
  | "PREVIEW"
  | "XML_DOWNLOAD";

export interface NfeAuditoriaRow {
  id: string;
  company_id: string;
  nota_id: string | null;
  modelo: string | null;
  serie: number | null;
  numero: number | null;
  chave_acesso: string | null;
  protocolo: string | null;
  evento: EventoNfe;
  status: string | null;
  usuario_id: string | null;
  usuario_nome: string | null;
  ip_address: string | null;
  user_agent: string | null;
  payload: Record<string, unknown>;
  observacao: string | null;
  created_at: string;
}

export interface AuditoriaFilters {
  evento?: EventoNfe | "ALL";
  modelo?: "55" | "65" | "ALL";
  desde?: string; // ISO date
  ate?: string;
  chave?: string;
  nota_id?: string;
  limit?: number;
}

export function useNfeAuditoria(filters: AuditoriaFilters = {}) {
  return useQuery({
    queryKey: ["nfe-auditoria", filters],
    queryFn: async (): Promise<NfeAuditoriaRow[]> => {
      let q = supabase
        .from("nfe_auditoria" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(filters.limit ?? 200);

      if (filters.evento && filters.evento !== "ALL") q = q.eq("evento", filters.evento);
      if (filters.modelo && filters.modelo !== "ALL") q = q.eq("modelo", filters.modelo);
      if (filters.desde) q = q.gte("created_at", filters.desde);
      if (filters.ate) q = q.lte("created_at", filters.ate);
      if (filters.chave) q = q.ilike("chave_acesso", `%${filters.chave}%`);
      if (filters.nota_id) q = q.eq("nota_id", filters.nota_id);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as NfeAuditoriaRow[];
    },
    staleTime: 10_000,
  });
}

/** Registra evento via RPC (recomendado: usa SECURITY DEFINER para preencher usuario/company). */
export async function registrarEventoNfe(input: {
  evento: EventoNfe;
  nota_id?: string | null;
  modelo?: string | null;
  serie?: number | null;
  numero?: number | null;
  chave_acesso?: string | null;
  protocolo?: string | null;
  status?: string | null;
  payload?: Record<string, unknown>;
  observacao?: string | null;
}) {
  const { data, error } = await supabase.rpc("registrar_evento_nfe" as any, {
    p_evento: input.evento,
    p_nota_id: input.nota_id ?? null,
    p_modelo: input.modelo ?? null,
    p_serie: input.serie ?? null,
    p_numero: input.numero ?? null,
    p_chave_acesso: input.chave_acesso ?? null,
    p_protocolo: input.protocolo ?? null,
    p_status: input.status ?? null,
    p_payload: input.payload ?? {},
    p_observacao: input.observacao ?? null,
    p_ip_address: null,
    p_user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
  });
  if (error) throw error;
  return data as string;
}

/** Conta eventos por tipo no período. */
export function useNfeAuditoriaResumo(desde?: string) {
  return useQuery({
    queryKey: ["nfe-auditoria-resumo", desde],
    queryFn: async () => {
      let q = supabase
        .from("nfe_auditoria" as any)
        .select("evento, created_at");
      if (desde) q = q.gte("created_at", desde);
      const { data, error } = await q;
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data || []) as unknown as Array<{ evento: string }>) {
        counts[row.evento] = (counts[row.evento] || 0) + 1;
      }
      return counts;
    },
    staleTime: 30_000,
  });
}