import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * anvisa_alegacoes_detalhadas vazia = alegações na UI/PDF vieram do modelo de linguagem,
 * não da norma. Enquanto count = 0, o bloco de alegações NÃO deve ser renderizado.
 */
export function useAlegacoesBasePopulada() {
  return useQuery({
    queryKey: ["anvisa-alegacoes-detalhadas-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("anvisa_alegacoes_detalhadas")
        .select("id", { count: "exact", head: true });
      if (error) {
        console.error("Falha ao contar anvisa_alegacoes_detalhadas:", error);
        return false;
      }
      return (count ?? 0) > 0;
    },
    staleTime: 10 * 60 * 1000,
  });
}
