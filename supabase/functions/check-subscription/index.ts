import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

const TRIAL_DAYS = 14;

type SubscriptionPayload = {
  subscribed: boolean;
  is_in_trial: boolean;
  trial_days_remaining: number;
  product_id: string | null;
  plan_name: string | null;
  subscription_end: string | null;
  auth_invalid?: boolean;
  error?: string;
};

const createResponse = (payload: SubscriptionPayload, status = 200) =>
  new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const createUnsubscribedPayload = (
  isInTrial: boolean,
  trialDaysRemaining: number,
): SubscriptionPayload => ({
  subscribed: false,
  is_in_trial: isInTrial,
  trial_days_remaining: trialDaysRemaining,
  product_id: null,
  plan_name: null,
  subscription_end: null,
});

const isAuthError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("user from sub claim") ||
    normalized.includes("user_not_found") ||
    normalized.includes("no authorization header") ||
    normalized.includes("not authenticated")
  );
};

const createAuthInvalidResponse = (message: string) =>
  createResponse({
    ...createUnsubscribedPayload(false, 0),
    auth_invalid: true,
    error: message,
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      const message = "Authentication error: No authorization header provided";
      logStep("AUTH_INVALID", { message });
      return createAuthInvalidResponse(message);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      const message = `Authentication error: ${userError.message}`;
      if (isAuthError(userError.message)) {
        logStep("AUTH_INVALID", { message });
        return createAuthInvalidResponse(message);
      }
      throw new Error(message);
    }

    const user = userData.user;
    if (!user?.email) {
      const message = "Authentication error: User not authenticated or email not available";
      logStep("AUTH_INVALID", { message });
      return createAuthInvalidResponse(message);
    }

    logStep("User authenticated", { userId: user.id, email: user.email });

    const createdAt = new Date(user.created_at);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const trialDaysRemaining = Math.max(0, TRIAL_DAYS - diffDays);
    const isInTrial = trialDaysRemaining > 0;
    logStep("Trial check", { diffDays, trialDaysRemaining, isInTrial });

    // ── BYPASS 1: saas_super_devs (donos do SaaS) nunca são bloqueados ──
    const { data: superDevRow } = await supabaseClient
      .from('saas_super_devs')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (superDevRow) {
      logStep("saas_super_dev bypass — acesso irrestrito", { userId: user.id });
      return createResponse({
        subscribed: true,
        is_in_trial: false,
        trial_days_remaining: 0,
        product_id: null,
        plan_name: 'Super Dev',
        subscription_end: null,
      });
    }

    // ── BYPASS 2: saas_owner no user_roles também tem acesso irrestrito ──
    const { data: ownerRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'saas_owner')
      .maybeSingle();
    if (ownerRole) {
      logStep("saas_owner bypass — acesso irrestrito", { userId: user.id });
      return createResponse({
        subscribed: true,
        is_in_trial: false,
        trial_days_remaining: 0,
        product_id: null,
        plan_name: 'SaaS Owner',
        subscription_end: null,
      });
    }

    // Check if admin granted manual access override
    const { data: profileData } = await supabaseClient
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileData?.company_id) {
      const { data: companyData } = await supabaseClient
        .from('company')
        .select('acesso_liberado_ate')
        .eq('id', profileData.company_id)
        .single();

      if (companyData?.acesso_liberado_ate) {
        const liberadoAte = new Date(companyData.acesso_liberado_ate);
        if (liberadoAte > now) {
          const daysRemaining = Math.ceil((liberadoAte.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          logStep("Admin override active", { acesso_liberado_ate: companyData.acesso_liberado_ate, daysRemaining });
          return createResponse({
            subscribed: true,
            is_in_trial: false,
            trial_days_remaining: 0,
            product_id: null,
            plan_name: `Liberado (${daysRemaining}d)`,
            subscription_end: companyData.acesso_liberado_ate,
          });
        }
      }
    }


    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      logStep("No Stripe customer found");
      return createResponse(createUnsubscribedPayload(isInTrial, trialDaysRemaining));
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    let activeSub = subscriptions.data[0] || null;
    if (!activeSub) {
      const trialingSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "trialing",
        limit: 1,
      });
      activeSub = trialingSubs.data[0] || null;
    }

    if (!activeSub) {
      logStep("No active subscription");
      return createResponse(createUnsubscribedPayload(isInTrial, trialDaysRemaining));
    }

    const productId = activeSub.items.data[0].price.product as string;
    const subscriptionEnd = new Date(activeSub.current_period_end * 1000).toISOString();

    const planMap: Record<string, string> = {
      "prod_U2vuAu7msHlX8l": "Mensal",
      "prod_U2xEoU9GApSWsN": "Semestral",
      "prod_U2xYcHyM6q5PhG": "Anual",
    };
    const planName = planMap[productId] || "Desconhecido";

    logStep("Active subscription found", { productId, planName, subscriptionEnd });

    return createResponse({
      subscribed: true,
      is_in_trial: false,
      trial_days_remaining: 0,
      product_id: productId,
      plan_name: planName,
      subscription_end: subscriptionEnd,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (isAuthError(errorMessage)) {
      logStep("AUTH_INVALID", { message: errorMessage });
      return createAuthInvalidResponse(errorMessage);
    }

    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
