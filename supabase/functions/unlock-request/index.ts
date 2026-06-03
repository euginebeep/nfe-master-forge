import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Alfabeto sem caracteres ambíguos
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < 8; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return `BRX-${out.slice(0, 4)}-${out.slice(4, 8)}`;
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
    const { data: claims, error: authErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json().catch(() => ({}));
    const motivo = String(body?.motivo || "").trim();
    const escopo: string[] = Array.isArray(body?.escopo) ? body.escopo : [];
    if (motivo.length < 10) {
      return new Response(JSON.stringify({ error: "Motivo deve ter ao menos 10 caracteres" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (escopo.length === 0) {
      return new Response(JSON.stringify({ error: "Selecione ao menos um escopo" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(url, service);

    // Resolve company + nome
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id, nome_completo")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: "Usuário sem empresa vinculada" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gera código único (retry max 5)
    let code = "";
    for (let i = 0; i < 5; i++) {
      code = generateCode();
      const { data: exists } = await admin
        .from("unlock_challenges")
        .select("id")
        .eq("challenge_code", code)
        .maybeSingle();
      if (!exists) break;
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    const { data: inserted, error: insErr } = await admin
      .from("unlock_challenges")
      .insert({
        company_id: profile.company_id,
        challenge_code: code,
        requested_by: userId,
        requested_by_nome: profile.nome_completo,
        motivo,
        escopo,
        status: "AGUARDANDO_ADMIN",
        ip_solicitante: ip,
      })
      .select("id, challenge_code, expira_em, created_at")
      .single();

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audit
    await admin.rpc("registrar_evento_auditoria", {
      p_tipo_evento: "OUTRO",
      p_descricao: `Desbloqueio crítico solicitado: ${code}`,
      p_entidade_tipo: "unlock_challenge",
      p_entidade_id: inserted.id,
      p_entidade_codigo: code,
      p_usuario_id: userId,
      p_usuario_nome: profile.nome_completo ?? null,
      p_ip_address: ip,
      p_dados_evento: { motivo, escopo },
    }).catch(() => {});

    return new Response(JSON.stringify(inserted), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("unlock-request error:", String(e));
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});