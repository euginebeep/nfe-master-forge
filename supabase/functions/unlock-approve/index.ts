import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateTempPassword(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => (b % 10).toString()).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(url, service);

    // Apenas admin global (SaaS) pode aprovar
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso restrito a administradores SaaS" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const challengeCode = String(body?.challenge_code || "").trim().toUpperCase();
    if (!/^BRX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(challengeCode)) {
      return new Response(JSON.stringify({ error: "Código de desafio inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: challenge, error: cErr } = await admin
      .from("unlock_challenges")
      .select("*")
      .eq("challenge_code", challengeCode)
      .maybeSingle();

    if (cErr || !challenge) {
      return new Response(JSON.stringify({ error: "Desafio não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(challenge.expira_em).getTime() < Date.now()) {
      await admin.from("unlock_challenges").update({ status: "EXPIRADO" }).eq("id", challenge.id);
      return new Response(JSON.stringify({ error: "Desafio expirado" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (challenge.status === "LIBERADO" && challenge.temp_password_visualizada_em) {
      return new Response(JSON.stringify({ error: "Senha já foi visualizada para este código. Solicite ao operador um novo." }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (challenge.status !== "AGUARDANDO_ADMIN" && challenge.status !== "LIBERADO") {
      return new Response(JSON.stringify({ error: `Desafio está ${challenge.status}` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tempPassword = generateTempPassword();
    const hash = await sha256(tempPassword);
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const { data: adminProfile } = await admin
      .from("profiles")
      .select("nome_completo")
      .eq("id", userId)
      .maybeSingle();

    const { error: updErr } = await admin
      .from("unlock_challenges")
      .update({
        status: "LIBERADO",
        temp_password_hash: hash,
        temp_password_visualizada_em: new Date().toISOString(),
        aprovado_por: userId,
        aprovado_por_nome: adminProfile?.nome_completo ?? null,
        aprovado_em: new Date().toISOString(),
        ip_aprovador: ip,
      })
      .eq("id", challenge.id);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.rpc("registrar_evento_auditoria", {
      p_tipo_evento: "OUTRO",
      p_descricao: `Desbloqueio liberado pelo SaaS: ${challengeCode}`,
      p_entidade_tipo: "unlock_challenge",
      p_entidade_id: challenge.id,
      p_entidade_codigo: challengeCode,
      p_usuario_id: userId,
      p_usuario_nome: adminProfile?.nome_completo ?? null,
      p_ip_address: ip,
    }).catch(() => {});

    return new Response(
      JSON.stringify({
        challenge_code: challengeCode,
        temp_password: tempPassword,
        valido_ate: challenge.expira_em,
        empresa_id: challenge.company_id,
        operador: challenge.requested_by_nome,
        motivo: challenge.motivo,
        escopo: challenge.escopo,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("unlock-approve error:", String(e));
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});