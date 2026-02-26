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
        // Sem company_id vinculado → retorna null (onboarding necessário)
        return null;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Check if user already has a company linked via profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (profile?.company_id) {
        // Update existing company
        const { data, error } = await supabase
          .from("company")
          .update(company)
          .eq("id", profile.company_id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Create new company without RETURNING to avoid SELECT RLS dependency during bootstrap
        const newCompanyId = crypto.randomUUID();
        const { error } = await supabase
          .from("company")
          .insert({ ...(company as Company), id: newCompanyId });

        if (error) throw error;

        // Ensure profile exists and is linked to the created company
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            { id: user.id, company_id: newCompanyId } as any,
            { onConflict: "id" }
          );

        if (profileError) throw profileError;

        return { ...(company as Company), id: newCompanyId };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      queryClient.invalidateQueries({ queryKey: ["user-company-id"] });
      toast.success("Empresa salva com sucesso");
    },
    onError: (error) => {
      toast.error("Erro ao salvar empresa: " + error.message);
    },
  });
}
