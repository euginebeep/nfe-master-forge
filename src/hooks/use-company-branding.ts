import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyBranding {
  razao_social: string;
  nome_fantasia: string | null;
  logo_url: string | null;
  cnpj: string | null;
  endereco: string | null;
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
        .maybeSingle();
      if (!profile?.company_id) return null;

      const { data: company } = await supabase
        .from("company")
        .select("razao_social, nome_fantasia, logo_file_id, cnpj, endereco_logradouro, endereco_nro, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep")
        .eq("id", profile.company_id)
        .single();
      if (!company) return null;

      let logo_url: string | null = null;
      if (company.logo_file_id) {
        const { data: arquivo } = await supabase
          .from("arquivos")
          .select("storage_key")
          .eq("id", company.logo_file_id)
          .single();
        if (arquivo?.storage_key) {
          const { data: signed } = await supabase.storage
            .from("erp-files")
            .createSignedUrl(arquivo.storage_key, 3600);
          logo_url = signed?.signedUrl || null;
        }
      }

      const partes = [
        company.endereco_logradouro,
        company.endereco_nro,
        company.endereco_bairro,
        company.endereco_cidade && company.endereco_uf
          ? `${company.endereco_cidade}/${company.endereco_uf}`
          : company.endereco_cidade || company.endereco_uf,
        company.endereco_cep ? `CEP ${company.endereco_cep}` : null,
      ].filter(Boolean);
      const endereco = partes.length > 0 ? partes.join(", ") : null;

      return {
        razao_social: company.razao_social,
        nome_fantasia: company.nome_fantasia,
        logo_url,
        cnpj: company.cnpj || null,
        endereco,
      };
    },
    staleTime: 5 * 60 * 1000,
  });
}
