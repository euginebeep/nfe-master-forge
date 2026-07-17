import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export interface PremixPoliticaOverride {
  id: string;
  constituinte_id: string;
  exige_premix: boolean;
  solubilidade: string | null;
  fator_diluicao: number | null;
  veiculo: string | null;
  precisa_antioxidante: boolean;
  precisa_protecao_luz: boolean;
  ajustado_por: string | null;
  ajustado_em: string;
}

/** Client sem tipagem da tabela nova (ainda fora do types.ts gerado). */
const db = () => supabase as unknown as {
  from: (t: string) => any;
};

export function usePremixPoliticaOverride(constituinteId: string | null | undefined) {
  return useQuery({
    queryKey: ["premix-politica", constituinteId],
    enabled: !!constituinteId,
    queryFn: async (): Promise<PremixPoliticaOverride | null> => {
      const { data, error } = await db()
        .from("premix_politica_constituinte")
        .select(
          "id, constituinte_id, exige_premix, solubilidade, fator_diluicao, veiculo, precisa_antioxidante, precisa_protecao_luz, ajustado_por, ajustado_em",
        )
        .eq("constituinte_id", constituinteId)
        .maybeSingle();
      if (error) throw error;
      return (data as PremixPoliticaOverride) ?? null;
    },
  });
}

export function useSalvarPremixPolitica() {
  const qc = useQueryClient();
  const { profile, user } = useAuth();

  return useMutation({
    mutationFn: async (input: {
      constituinteId: string;
      exige_premix: boolean;
      solubilidade: string | null;
      fator_diluicao: number | null;
      veiculo: string | null;
      precisa_antioxidante: boolean;
      precisa_protecao_luz: boolean;
    }) => {
      const payload = {
        company_id: profile?.company_id,
        constituinte_id: input.constituinteId,
        exige_premix: input.exige_premix,
        solubilidade: input.solubilidade,
        fator_diluicao: input.fator_diluicao,
        veiculo: input.veiculo,
        precisa_antioxidante: input.precisa_antioxidante,
        precisa_protecao_luz: input.precisa_protecao_luz,
        ajustado_por: profile?.nome_completo || user?.email || user?.id || "RT",
        ajustado_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await db()
        .from("premix_politica_constituinte")
        .upsert(payload, { onConflict: "company_id,constituinte_id" })
        .select()
        .single();
      if (error) throw error;
      return data as PremixPoliticaOverride;
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["premix-politica", vars.constituinteId] });
      qc.invalidateQueries({ queryKey: ["premix", "candidatos"] });
    },
  });
}
