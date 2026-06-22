import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDemoUser, demoBlockedResponse } from "../_shared/demo-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FOCUS_NFE_API_URL = "https://api.focusnfe.com.br/v2";

async function focusNfeRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const token = Deno.env.get("FOCUS_NFE_TOKEN");
  
  if (!token) {
    throw new Error("Token da Focus NFe não configurado.");
  }

  const url = `${FOCUS_NFE_API_URL}${path}`;
  const authString = btoa(`${token}:`); // Basic Auth com senha vazia

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/json",
    },
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
}

async function authenticateUser(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Unauthorized");
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Unauthorized");
  }

  return { supabase, user };
}

async function audit(
  supabase: any,
  evento: string,
  extra: any = {},
) {
  try {
    await supabase.rpc("registrar_evento_nfe", {
      p_evento: evento,
      p_nota_id: extra.nota_id ?? null,
      p_modelo: extra.modelo ?? null,
      p_serie: extra.serie ?? null,
      p_numero: extra.numero ?? null,
      p_chave_acesso: extra.chave_acesso ?? null,
      p_protocolo: extra.protocolo ?? null,
      p_status: extra.status ?? null,
      p_payload: extra.payload ?? {},
      p_observacao: extra.observacao ?? null,
    });
  } catch (e) {
    console.error("[focus-nfe] audit failed:", e.message);
  }
}

async function validateTenantAccess(supabase: any, focusNfeId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("validar_acesso_nota_saida", {
    p_focus_nfe_id: focusNfeId
  });
  
  if (error || !data) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const id = url.searchParams.get("id");

    const { supabase, user } = await authenticateUser(req);

    if (await isDemoUser(supabase, user.id)) {
      return demoBlockedResponse();
    }

    switch (action) {
      case "cadastrar-empresa": {
        const payload = await req.json();
        
        // Cadastra empresa na Focus NFe
        const res = await focusNfeRequest("POST", "/empresas", payload);
        const data = await res.json();

        if (!res.ok) {
          return new Response(JSON.stringify({ error: "Erro ao cadastrar empresa na Focus NFe.", detalhes: data }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "consultar-empresa": {
        const cnpj = url.searchParams.get("cnpj");
        
        // Security check: only allow querying their own CNPJ
        const { data: profile } = await supabase.from('profiles').select('company_id').single();
        const { data: company } = await supabase.from('companies').select('cnpj').eq('id', profile?.company_id).single();
        
        const cleanCnpj = company?.cnpj?.replace(/\D/g, '');
        const cleanRequested = cnpj?.replace(/\D/g, '');
        
        if (!cleanRequested || cleanRequested !== cleanCnpj) {
          return new Response(JSON.stringify({ error: "Você só pode consultar os dados da sua própria empresa." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Na Focus NFe, a busca é por query param cnpj
        const res = await focusNfeRequest("GET", `/empresas?cnpj=${cnpj}`);
        const data = await res.json();

        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "emitir-nfe": {
        const payload = await req.json();
        
        // Focus NFe usa ref na URL para idempotência e rastreamento
        const ref = payload.ref || `nfe-${Date.now()}`;
        delete payload.ref;
        
        const modelo = payload.modelo === "65" ? "65" : "55";
        const serie = Number(payload.serie ?? 1) || 1;
        
        let numeroReservado: number | null = null;

        if (!payload.numero) {
          const { data: resNum, error: rErr } = await supabase.rpc(
            "reservar_proximo_numero_nfe",
            { p_modelo: modelo, p_serie: serie },
          );

          if (!rErr && resNum) {
            numeroReservado = Number(resNum.numero || resNum[0]?.numero);
            if (numeroReservado) {
              payload.numero = numeroReservado;
            }
          }
        }

        // Emite a NFe na Focus NFe
        const res = await focusNfeRequest("POST", `/nfe?ref=${ref}`, payload);
        const data = await res.json();

        if (!res.ok) {
          await audit(supabase, "REJEICAO", {
            modelo, serie, numero: numeroReservado,
            status: String(res.status),
            payload: { error: "Rejeição na transmissão", detalhes: data },
          });

          if (numeroReservado) {
            await supabase.rpc("liberar_numero_nfe", {
              p_modelo: modelo, p_serie: serie, p_numero: numeroReservado,
              p_motivo: `Rejeitada (${res.status})`,
            });
          }

          return new Response(JSON.stringify({ error: "Rejeição na emissão. Verifique os dados.", detalhes: data }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await audit(supabase, "EMISSAO", {
          modelo, serie, numero: numeroReservado,
          chave_acesso: data?.chave_nfe,
          protocolo: data?.protocolo,
          status: data?.status || "ok",
        });

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "consultar-nfe": {
        if (!id) throw new Error("ID (ref) não informado.");
        
        const res = await focusNfeRequest("GET", `/nfe/${id}`);
        const data = await res.json();

        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "cancelar-nfe": {
        if (!id) throw new Error("ID (ref) não informado.");
        const { justificativa } = await req.json();
        
        if (!justificativa || justificativa.length < 15) {
          throw new Error("Justificativa deve ter no mínimo 15 caracteres.");
        }

        const res = await focusNfeRequest("DELETE", `/nfe/${id}`, { justificativa });
        const data = await res.json();

        await audit(supabase, "CANCELAMENTO", {
          chave_acesso: id,
          status: res.ok ? "ok" : "erro",
          observacao: justificativa,
        });

        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "carta-correcao": {
        if (!id) throw new Error("ID (ref) não informado.");
        const { correcao } = await req.json();
        
        if (!correcao || correcao.length < 15) {
          throw new Error("Correção deve ter no mínimo 15 caracteres.");
        }

        const res = await focusNfeRequest("POST", `/nfe/${id}/carta_correcao`, { correcao });
        const data = await res.json();

        await audit(supabase, "CC_E", {
          chave_acesso: id,
          status: res.ok ? "ok" : "erro",
          observacao: correcao,
        });

        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: corsHeaders });
    }
  } catch (err: any) {
    const status = err.message === "Unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: err.message }), { status, headers: corsHeaders });
  }
});
