import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionState {
  subscribed: boolean;
  isInTrial: boolean;
  trialDaysRemaining: number;
  productId: string | null;
  planName: string | null;
  subscriptionEnd: string | null;
  isLoading: boolean;
  isBlocked: boolean; // trial expired + no subscription
}

export const PLANS = {
  mensal: {
    name: 'Mensal',
    priceId: 'price_1T4q2mBGcvy35NE3xWhv0tBh',
    productId: 'prod_U2vuAu7msHlX8l',
    priceMonthly: 97.30,
    interval: 'Mensal',
    description: 'Cobrança todo mês',
  },
  semestral: {
    name: 'Semestral',
    priceId: 'price_1T4rJtBGcvy35NE3pvwpmVfP',
    productId: 'prod_U2xEoU9GApSWsN',
    priceMonthly: 87.30,
    interval: 'A cada 6 meses',
    description: 'R$ 523,80 a cada 6 meses',
  },
  anual: {
    name: 'Anual',
    priceId: 'price_1T4rd3BGcvy35NE3zs2T6e4n',
    productId: 'prod_U2xYcHyM6q5PhG',
    priceMonthly: 77.30,
    interval: 'Anual',
    description: 'R$ 927,60 por ano',
  },
} as const;

export function useSubscription() {
  const [state, setState] = useState<SubscriptionState>({
    subscribed: false,
    isInTrial: true, // default to trial to avoid flash of blocked screen
    trialDaysRemaining: 14,
    productId: null,
    planName: null,
    subscriptionEnd: null,
    isLoading: true,
    isBlocked: false,
  });

  const checkSubscription = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('Error checking subscription:', error);
        // On error, don't block — assume trial
        setState(prev => ({ ...prev, isLoading: false }));
        return;
      }

      const subscribed = data.subscribed === true;
      const isInTrial = data.is_in_trial === true;
      const trialDaysRemaining = data.trial_days_remaining ?? 0;
      const isBlocked = !subscribed && !isInTrial;

      setState({
        subscribed,
        isInTrial,
        trialDaysRemaining,
        productId: data.product_id,
        planName: data.plan_name,
        subscriptionEnd: data.subscription_end,
        isLoading: false,
        isBlocked,
      });
    } catch (err) {
      console.error('Subscription check failed:', err);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    checkSubscription();
    // Refresh every 60 seconds
    const interval = setInterval(checkSubscription, 60000);
    return () => clearInterval(interval);
  }, [checkSubscription]);

  const createCheckout = async (priceId: string) => {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: { priceId },
    });
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
    }
  };

  const openCustomerPortal = async () => {
    const { data, error } = await supabase.functions.invoke('customer-portal');
    if (error) throw error;
    if (data?.url) {
      window.open(data.url, '_blank');
    }
  };

  return {
    ...state,
    checkSubscription,
    createCheckout,
    openCustomerPortal,
  };
}
