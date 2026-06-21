import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyBranding {
  razao_social: string;
  nome_fantasia: string | null;
  logo_url: string | null;
}

export function useCompanyBranding() {
  return useQuery({
    queryKey: ["company-branding"],
    queryFn: async (): Promise<CompanyBranding | null> => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();
      if (!profile?.company_id) return null;

      const { data: company } = await supabase
        .from("company")
        .select("razao_social, nome_fantasia, logo_file_id")
        .eq("id", profile.company_id)
        .single();
      if (!company) return null;

      let logo_url: string | null = null;
      if (company.logo_file_id) {
        const { data: arquivo } = await supabase
          .from("arquivos")
          .select("url")
          .eq("id", company.logo_file_id)
          .single();
        logo_url = arquivo?.url || null;
      }

      return {
        razao_social: company.razao_social,
        nome_fantasia: company.nome_fantasia,
        logo_url,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
