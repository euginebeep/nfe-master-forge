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

    const body = await req.json().catch(() => ({}));
    const challengeCode = String(body?.challenge_code || "").trim().toUpperCase();
    const tempPassword = String(body?.temp_password || "").trim();

    if (!/^BRX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(challengeCode)) {
      return new Response(JSON.stringify({ error: "Código inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^\d{8}$/.test(tempPassword)) {
      return new Response(JSON.stringify({ error: "Senha deve ter 8 dígitos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service);

    const { data: challenge } = await admin
      .from("unlock_challenges")
      .select("*")
      .eq("challenge_code", challengeCode)
      .maybeSingle();

    if (!challenge) {
      return new Response(JSON.stringify({ error: "Desafio não encontrado" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (challenge.requested_by !== userId) {
      return new Response(JSON.stringify({ error: "Este desafio pertence a outro operador" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (challenge.status !== "LIBERADO") {
      return new Response(JSON.stringify({ error: `Desafio está ${challenge.status}` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (new Date(challenge.expira_em).getTime() < Date.now()) {
      await admin.from("unlock_challenges").update({ status: "EXPIRADO" }).eq("id", challenge.id);
      return new Response(JSON.stringify({ error: "Desafio expirado" }), {
        status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hash = await sha256(tempPassword);
    if (hash !== challenge.temp_password_hash) {
      return new Response(JSON.stringify({ error: "Senha incorreta" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const unlockExpira = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const { error: updErr } = await admin
      .from("unlock_challenges")
      .update({
        status: "CONSUMIDO",
        consumido_em: new Date().toISOString(),
        desbloqueio_expira_em: unlockExpira,
      })
      .eq("id", challenge.id);

    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    await admin.rpc("registrar_evento_auditoria", {
      p_tipo_evento: "OUTRO",
      p_descricao: `Modo desbloqueio ATIVADO por 30 minutos: ${challengeCode}`,
      p_entidade_tipo: "unlock_challenge",
      p_entidade_id: challenge.id,
      p_entidade_codigo: challengeCode,
      p_usuario_id: userId,
      p_usuario_nome: challenge.requested_by_nome,
      p_ip_address: ip,
      p_dados_evento: { escopo: challenge.escopo, motivo: challenge.motivo },
    }).catch(() => {});

    // Notifica admins do tenant
    const { data: tenantAdmins } = await admin
      .from("profiles")
      .select("id")
      .eq("company_id", challenge.company_id);

    if (tenantAdmins?.length) {
      const notifs = tenantAdmins
        .filter((p) => p.id !== userId)
        .map((p) => ({
          user_id: p.id,
          title: "Modo desbloqueio crítico ATIVADO",
          message: `${challenge.requested_by_nome || "Operador"} ativou desbloqueio (${challengeCode}). Válido por 30min.`,
          type: "warning",
          module: "Admin",
        }));
      if (notifs.length) await admin.from("notifications").insert(notifs).then(() => {}, () => {});
    }

    return new Response(
      JSON.stringify({
        challenge_id: challenge.id,
        challenge_code: challengeCode,
        desbloqueio_expira_em: unlockExpira,
        escopo: challenge.escopo,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("unlock-consume error:", String(e));
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});