import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface NfeNumeracaoRow {
  id: string;
  company_id: string;
  modelo: "55" | "65";
  serie: number;
  proximo_numero: number;
  ultimo_emitido: number | null;
  ultimo_reservado_em: string | null;
  ultimo_reservado_por: string | null;
  updated_at: string;
}

/** Lista a numeração corrente (NF-e 55, NFC-e 65) do tenant logado. */
export function useNfeNumeracao() {
  return useQuery({
    queryKey: ["nfe-numeracao"],
    queryFn: async (): Promise<NfeNumeracaoRow[]> => {
      const { data, error } = await supabase
        .from("nfe_numeracao" as any)
        .select("*")
        .order("modelo")
        .order("serie");
      if (error) throw error;
      return (data || []) as unknown as NfeNumeracaoRow[];
    },
    staleTime: 15_000,
  });
}

/** Reserva atômica do próximo número (chama a RPC SECURITY DEFINER). */
export async function reservarProximoNumeroNfe(modelo: "55" | "65", serie: number) {
  const { data, error } = await supabase.rpc("reservar_proximo_numero_nfe" as any, {
    p_modelo: modelo,
    p_serie: serie,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row as { numero: number; modelo: string; serie: number };
}

/** Registra inutilização (libera) do número reservado quando a SEFAZ rejeita. */
export async function liberarNumeroNfe(
  modelo: "55" | "65",
  serie: number,
  numero: number,
  motivo: string,
) {
  const { error } = await supabase.rpc("liberar_numero_nfe" as any, {
    p_modelo: modelo,
    p_serie: serie,
    p_numero: numero,
    p_motivo: motivo,
  });
  if (error) throw error;
}