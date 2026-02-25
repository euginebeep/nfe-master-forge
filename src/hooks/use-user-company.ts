import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook para obter o company_id do usuário logado.
 * Usado em todos os hooks de criação para garantir multi-tenant.
 */
export function useUserCompanyId() {
  return useQuery({
    queryKey: ["user-company-id"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return (data?.company_id as string) || null;
    },
    staleTime: 1000 * 60 * 5, // Cache por 5 min
  });
}

/**
 * Função utilitária para obter o company_id (para uso fora de componentes React).
 */
export async function getUserCompanyId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("company_id")
    .eq("id", user.id)
    .single();

  return (data?.company_id as string) || null;
}
