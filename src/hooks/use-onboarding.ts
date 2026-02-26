import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Verifica se o usuário logado já tem um company_id vinculado ao seu profile.
 * Se não tem → precisa de onboarding.
 * Isso é seguro para multi-tenant: não vaza dados entre empresas.
 */
export function useOnboardingCheck() {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setNeedsOnboarding(false);
          return;
        }

        const { data: profile, error } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erro ao verificar empresa do usuário:', error);
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(!profile?.company_id);
        }
      } catch {
        setNeedsOnboarding(false);
      } finally {
        setIsLoading(false);
      }
    }
    check();
  }, []);

  return { needsOnboarding, isLoading };
}
