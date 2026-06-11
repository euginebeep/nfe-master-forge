import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDemoUser, demoBlockedResponse } from "../_shared/demo-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NUVEM_FISCAL_TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const NUVEM_FISCAL_API_URL = "https://api.nuvemfiscal.com.br";

let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60000) {
    return cachedToken.access_token;
  }

  const clientId = Deno.env.get("NUVEM_FISCAL_CLIENT_ID");
  const clientSecret = Deno.env.get("NUVEM_FISCAL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais da Nuvem Fiscal não configuradas.");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "empresa nfe nfce cep",
  });

  const res = await fetch(NUVEM_FISCAL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    throw new Error(`Erro ao obter token Nuvem Fiscal: ${res.status}`);
  }

  const data = await res.json();
  cachedToken = {
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return cachedToken.access_token;
}

async function nuvemFiscalRequest(
  method: string,
  path: string,
  body?: unknown
): Promise<Response> {
  const token = await getAccessToken();
  const url = `${NUVEM_FISCAL_API_URL}${path}`;

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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
    console.error("[nuvem-fiscal] audit failed:", e.message);
  }
}

async function validateTenantAccess(supabase: any, nuvemFiscalId: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("validar_acesso_nota_saida", {
    p_nuvem_fiscal_id: nuvemFiscalId
  });
  return !!data && !error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, user } = await authenticateUser(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    const writeActions = new Set(["emitir-nfe", "cancelar-nfe", "carta-correcao", "cadastrar-empresa"]);
    if (action && writeActions.has(action)) {
      if (await isDemoUser(req.headers.get("Authorization"))) {
        return demoBlockedResponse(corsHeaders, "emissão fiscal real");
      }
    }

    // Tenant validation for ID based actions
    const idBasedActions = new Set(["consultar-nfe", "danfe", "xml", "cancelar-nfe", "carta-correcao"]);
    const id = url.searchParams.get("id");
    if (action && idBasedActions.has(action) && id) {
      const hasAccess = await validateTenantAccess(supabase, id);
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Acesso negado à nota fiscal." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    switch (action) {
      case "cadastrar-empresa": {
        const payload = await req.json();
        const res = await nuvemFiscalRequest("POST", "/empresas", payload);
        const data = await res.json();
        if (!res.ok) {
          return new Response(JSON.stringify({ error: "Erro ao cadastrar empresa no provedor." }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "consultar-empresa": {
        const cpfCnpj = url.searchParams.get("cpf_cnpj");
        // Security check: only allow querying their own CNPJ
        const { data: profile } = await supabase.from('profiles').select('company_id').single();
        const { data: company } = await supabase.from('companies').select('cnpj').eq('id', profile?.company_id).single();
        const cleanCnpj = company?.cnpj?.replace(/\D/g, '');
        const cleanRequested = cpfCnpj?.replace(/\D/g, '');

        if (!cleanRequested || cleanRequested !== cleanCnpj) {
          return new Response(JSON.stringify({ error: "Você só pode consultar os dados da sua própria empresa." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const res = await nuvemFiscalRequest("GET", `/empresas/${cpfCnpj}`);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "emitir-nfe": {
        const payload = await req.json();
        const ambiente = payload.ambiente === "producao" ? "producao" : "homologacao";
        delete payload.ambiente;

        const modelo = payload.modelo === "65" ? "65" : "55";
        const serie = Number(payload.serie ?? 1) || 1;
        let numeroReservado: number | null = null;
        
        if (!payload.numero && !payload?.infNFe?.ide?.nNF) {
          const { data: resNum, error: rErr } = await supabase.rpc(
            "reservar_proximo_numero_nfe",
            { p_modelo: modelo, p_serie: serie },
          );
          if (!rErr && resNum) {
            numeroReservado = Number(resNum.numero || resNum[0]?.numero);
            if (numeroReservado) {
              payload.numero = numeroReservado;
              if (payload.infNFe?.ide) payload.infNFe.ide.nNF = numeroReservado;
            }
          }
        }

        const res = await nuvemFiscalRequest("POST", `/nfe?ambiente=${ambiente}`, payload);
        const data = await res.json();

        if (!res.ok) {
          await audit(supabase, "REJEICAO", {
            modelo, serie, numero: numeroReservado,
            status: String(res.status),
            payload: { error: "Rejeição na transmissão" },
          });
          if (numeroReservado) {
            await supabase.rpc("liberar_numero_nfe", {
              p_modelo: modelo, p_serie: serie, p_numero: numeroReservado,
              p_motivo: `Rejeitada (${res.status})`,
            });
          }
          return new Response(JSON.stringify({ error: "Rejeição na emissão. Verifique os dados." }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await audit(supabase, "EMISSAO", {
          modelo, serie, numero: numeroReservado,
          chave_acesso: data?.chave || data?.chave_acesso,
          protocolo: data?.protocolo || data?.numero_protocolo,
          status: data?.status || "ok",
        });

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "consultar-nfe": {
        const res = await nuvemFiscalRequest("GET", `/nfe/${id}`);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "danfe": {
        const res = await nuvemFiscalRequest("GET", `/nfe/${id}/pdf`);
        if (!res.ok) return new Response(JSON.stringify({ error: "Erro ao gerar PDF" }), { status: res.status, headers: corsHeaders });
        const blob = await res.blob();
        return new Response(blob, {
          headers: { ...corsHeaders, "Content-Type": "application/pdf" },
        });
      }

      case "xml": {
        const res = await nuvemFiscalRequest("GET", `/nfe/${id}/xml`);
        if (!res.ok) return new Response(JSON.stringify({ error: "Erro ao baixar XML" }), { status: res.status, headers: corsHeaders });
        const xml = await res.text();
        return new Response(xml, {
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        });
      }

      case "cancelar-nfe": {
        const { justificativa } = await req.json();
        if (justificativa.length < 15) throw new Error("Justificativa deve ter no mínimo 15 caracteres.");
        
        const res = await nuvemFiscalRequest("POST", `/nfe/${id}/cancelamento`, { justificativa });
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
        const { correcao } = await req.json();
        if (correcao.length < 15) throw new Error("Correção deve ter no mínimo 15 caracteres.");

        const res = await nuvemFiscalRequest("POST", `/nfe/${id}/carta-correcao`, { correcao });
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