import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RTAtivo {
  id: string;
  nome_completo: string;
  tipo_conselho: "CRN" | "CRQ" | "CRF";
  numero_registro: string;
  uf_conselho: string;
  validade_registro: string;
}

export function useRTAtivo() {
  return useQuery({
    queryKey: ["rt-ativo"],
    queryFn: async (): Promise<RTAtivo | null> => {
      const { data, error } = await supabase
        .from("responsaveis_tecnicos")
        .select("id, nome_completo, tipo_conselho, numero_registro, uf_conselho, validade_registro")
        .eq("status", "ATIVO")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error("Erro ao buscar RT ativo:", error);
        return null;
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
