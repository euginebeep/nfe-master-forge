import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type LoteReservadoStatus = "PENDENTE_REGULARIZACAO" | "CONSUMIDO" | "CANCELADO";

export interface LoteReservado {
  id: string;
  company_id: string;
  codigo_curto: string;
  ano_mes: string;
  sequencia: number;
  digito_verificador: number;
  numero_completo: string;
  status: LoteReservadoStatus;
  data_fabricacao: string | null;
  descricao_produto: string | null;
  observacao: string | null;
  reservado_por: string | null;
  regularizado_em: string | null;
  cancelado_em: string | null;
  cancelado_motivo: string | null;
  created_at: string;
  updated_at: string;
  item_id: string | null;
  lote_pa_id: string | null;
  op_id: string | null;
  formula_id: string | null;
}

export function useLotesReservados(status?: LoteReservadoStatus) {
  return useQuery({
    queryKey: ["lotes_reservados", status ?? "all"],
    queryFn: async () => {
      let q = (supabase as any).from("lotes_reservados").select("*").order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as LoteReservado[];
    },
  });
}

export interface ReservarInput {
  codigo_curto: string;
  ano_mes: string;
  data_fabricacao?: string | null;
  descricao_produto?: string | null;
  observacao?: string | null;
  permitir_paralelo?: boolean;
}

export function useReservarLote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ReservarInput) => {
      const { data, error } = await (supabase as any).rpc("reservar_proximo_lote", {
        p_codigo_curto: input.codigo_curto,
        p_ano_mes: input.ano_mes,
        p_data_fabricacao: input.data_fabricacao ?? null,
        p_descricao_produto: input.descricao_produto ?? null,
        p_observacao: input.observacao ?? null,
        p_permitir_paralelo: input.permitir_paralelo ?? false,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return row as { id: string; numero_completo: string; sequencia: number; digito_verificador: number };
    },
    onSuccess: (row) => {
      toast.success(`Lote reservado: ${row.numero_completo}`);
      qc.invalidateQueries({ queryKey: ["lotes_reservados"] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || e);
      if (msg.includes("lote_pendente_regularizacao_bloqueia_nova_reserva")) {
        toast.error("Existe um lote pendente de regularização para este SKU/mês. Regularize ou cancele antes de reservar outro número.");
      } else if (msg.includes("codigo_curto_invalido")) {
        toast.error("Código curto inválido (use 2 a 8 caracteres alfanuméricos).");
      } else if (msg.includes("ano_mes_invalido")) {
        toast.error("Ano/mês inválido. Use formato AAMM (ex: 2606).");
      } else {
        toast.error("Falha ao reservar lote: " + msg);
      }
    },
  });
}

export function useCancelarLoteReservado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await (supabase as any).rpc("cancelar_lote_reservado", {
        p_reserva_id: id,
        p_motivo: motivo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reserva cancelada");
      qc.invalidateQueries({ queryKey: ["lotes_reservados"] });
    },
    onError: (e: any) => toast.error("Falha ao cancelar: " + (e?.message || e)),
  });
}

export function useRegularizarLoteReservado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { id: string; lote_pa_id?: string; op_id?: string; item_id?: string; formula_id?: string }) => {
      const { error } = await (supabase as any).rpc("regularizar_lote_reservado", {
        p_reserva_id: args.id,
        p_lote_pa_id: args.lote_pa_id ?? null,
        p_op_id: args.op_id ?? null,
        p_item_id: args.item_id ?? null,
        p_formula_id: args.formula_id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lote regularizado");
      qc.invalidateQueries({ queryKey: ["lotes_reservados"] });
    },
    onError: (e: any) => toast.error("Falha ao regularizar: " + (e?.message || e)),
  });
}

export function anoMesAtual(): string {
  const d = new Date();
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yy}${mm}`;
}