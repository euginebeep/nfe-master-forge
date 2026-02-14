import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useOnboardingCheck() {
  const [needsOnboarding, setNeedsOnboarding] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function check() {
      try {
        const { data, error } = await supabase
          .from('company')
          .select('id')
          .limit(1);

        if (error) {
          console.error('Erro ao verificar empresa:', error);
          setNeedsOnboarding(false);
        } else {
          setNeedsOnboarding(!data || data.length === 0);
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
