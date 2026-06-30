import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Company } from "@/types/erp";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";

export function useCompany() {
  const { user, profile, isAuthenticated, isLoading: authLoading } = useAuthContext();

  return useQuery({
    queryKey: ["company", user?.id ?? "anonymous", profile?.company_id ?? "no-company"],
    enabled: isAuthenticated && !authLoading,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Check demo mode from multiple sources
      const isDemoSession = sessionStorage.getItem('brainx_demo_mode') === 'true' || 
                           user.email === 'demo@brainxerp.com';

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id, is_demo")
        .eq("id", user.id)
        .single();

      const isDemo = profile?.is_demo || isDemoSession;
      const companyId = profile?.company_id || (isDemo ? '00000000-0000-0000-0000-000000000001' : null);

      if (!companyId) return null;

      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
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
          .from("companies")
          .update(company)
          .eq("id", profile.company_id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        // Try to create; handle duplicate CNPJ from a previous failed attempt
        const newCompanyId = crypto.randomUUID();
        const { error } = await supabase
          .from("companies")
          .insert({ ...(company as Company), id: newCompanyId });

        let companyIdToLink: string = newCompanyId;

        if (error) {
          if (error.code === '23505' && error.message.includes('company_cnpj_key')) {
            // Company already exists (orphaned from previous attempt) — reuse it
            const cnpj = (company as Company).cnpj?.replace(/\D/g, '');
            if (!cnpj) throw error;
            const { data: existing } = await supabase
              .from("companies")
              .select("id")
              .eq("cnpj", cnpj)
              .maybeSingle();
            if (!existing) throw error;
            companyIdToLink = existing.id as string;
            // Update with latest data
            await supabase.from("companies").update(company).eq("id", companyIdToLink);
          } else {
            throw error;
          }
        }

        // Link profile to the company
        const { error: profileError } = await supabase
          .from("profiles")
          .upsert(
            { id: user.id, company_id: companyIdToLink } as any,
            { onConflict: "id" }
          );

        if (profileError) throw profileError;

        return { ...(company as Company), id: companyIdToLink };
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
