import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function isDemoUser(authHeader: string | null): Promise<boolean> {
  if (!authHeader?.startsWith("Bearer ")) return false;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabase.auth.getUser(token);
    const userId = data?.user?.id;
    if (!userId) return false;
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_demo")
      .eq("id", userId)
      .maybeSingle();
    return profile?.is_demo === true;
  } catch {
    return false;
  }
}

export function demoBlockedResponse(corsHeaders: Record<string, string>, acao = "esta ação") {
  return new Response(
    JSON.stringify({
      error: "DEMO_BLOCKED",
      message: `Conta demo: ${acao} está desabilitada. Crie uma conta real para usar este recurso.`,
    }),
    { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}