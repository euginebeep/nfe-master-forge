import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CandidatoPremix = {
  constituinte_id: string;
  nome_tecnico: string;
  categoria: string | null;
  limite_max_num: number | null;
  limite_unidade: string | null;
  exige_premix: boolean;
  proporcao_sugerida: string | null;
  fator_diluicao_sugerido: number | null;
  solubilidade_sugerida: string | null;
  origem: "RT" | "AUTO" | string;
};

export function useConstituintesCandidatosPremix() {
  return useQuery({
    queryKey: ["premix", "candidatos"],
    queryFn: async (): Promise<CandidatoPremix[]> => {
      const { data, error } = await (supabase as any).rpc(
        "constituintes_candidatos_premix",
      );
      if (error) throw error;
      return (data ?? []) as CandidatoPremix[];
    },
  });
}
