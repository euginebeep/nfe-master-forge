import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/types/erp";
import { toast } from "sonner";

export function useCompany() {
  return useQuery({
    queryKey: ["company"],
    queryFn: async () => {
      // Buscar o company_id do profile do usuário logado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (!profile?.company_id) {
        // Fallback: buscar qualquer company (para retrocompatibilidade)
        const { data, error } = await supabase
          .from("company")
          .select("*")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data as Company | null;
      }

      const { data, error } = await supabase
        .from("company")
        .select("*")
        .eq("id", profile.company_id)
        .single();

      if (error) throw error;
      return data as Company | null;
    },
  });
}

export function useUpsertCompany() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (company: Partial<Company>) => {
      const existing = await supabase
        .from("company")
        .select("id")
        .limit(1)
        .maybeSingle();

      if (existing.data?.id) {
        const { data, error } = await supabase
          .from("company")
          .update(company)
          .eq("id", existing.data.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("company")
          .insert(company as Company)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Empresa salva com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao salvar empresa: " + error.message);
    },
  });
}
