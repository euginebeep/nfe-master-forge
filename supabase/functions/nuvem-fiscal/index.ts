import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDemoUser, demoBlockedResponse } from "../_shared/demo-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const NUVEM_FISCAL_TOKEN_URL = "https://auth.nuvemfiscal.com.br/oauth/token";
const NUVEM_FISCAL_API_URL = "https://api.nuvemfiscal.com.br";

// Cache token in memory (edge function lifetime)
let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expires_at - 60000) {
    return cachedToken.access_token;
  }

  const clientId = Deno.env.get("NUVEM_FISCAL_CLIENT_ID");
  const clientSecret = Deno.env.get("NUVEM_FISCAL_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais da Nuvem Fiscal não configuradas. Configure NUVEM_FISCAL_CLIENT_ID e NUVEM_FISCAL_CLIENT_SECRET.");
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
    const errorText = await res.text();
    throw new Error(`Erro ao obter token Nuvem Fiscal: ${res.status} - ${errorText}`);
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

// Authenticate user
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

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) {
    throw new Error("Unauthorized");
  }

  return { supabase, userId: data.claims.sub as string };
}

// Audit helper — best-effort, never blocks the main flow
async function audit(
  supabase: any,
  evento: string,
  extra: {
    nota_id?: string | null;
    modelo?: string | null;
    serie?: number | null;
    numero?: number | null;
    chave_acesso?: string | null;
    protocolo?: string | null;
    status?: string | null;
    payload?: unknown;
    observacao?: string | null;
  } = {},
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
      p_ip_address: null,
      p_user_agent: null,
    });
  } catch (e) {
    console.error("[nuvem-fiscal] audit failed:", (e as Error).message);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { supabase, userId } = await authenticateUser(req);
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Bloqueio de ações reais para conta demo
    const writeActions = new Set(["emitir-nfe", "cancelar-nfe", "carta-correcao", "cadastrar-empresa"]);
    if (action && writeActions.has(action)) {
      if (await isDemoUser(req.headers.get("Authorization"))) {
        return demoBlockedResponse(corsHeaders, "emissão fiscal real");
      }
    }

    switch (action) {
      // ─── Cadastrar empresa na Nuvem Fiscal ───
      case "cadastrar-empresa": {
        const payload = await req.json();
        const res = await nuvemFiscalRequest("POST", "/empresas", payload);
        const data = await res.json();
        if (!res.ok) {
          return new Response(JSON.stringify({ error: data }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── Consultar empresa cadastrada ───
      case "consultar-empresa": {
        const cpfCnpj = url.searchParams.get("cpf_cnpj");
        if (!cpfCnpj) {
          return new Response(JSON.stringify({ error: "cpf_cnpj obrigatório" }), {
            status: 400,
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

      // ─── Emitir NF-e ───
      case "emitir-nfe": {
        const payload = await req.json();
        const ambiente = payload.ambiente === "producao" ? "producao" : "homologacao";
        delete payload.ambiente;

        // Reserva atômica de número (se cliente não enviar número explícito)
        const modelo: "55" | "65" = payload.modelo === "65" ? "65" : "55";
        const serie: number = Number(
          payload.serie ?? payload?.infNFe?.ide?.serie ?? 1,
        ) || 1;
        let numeroReservado: number | null = null;
        if (!payload.numero && !payload?.infNFe?.ide?.nNF) {
          try {
            const { data: res, error: rErr } = await supabase.rpc(
              "reservar_proximo_numero_nfe",
              { p_modelo: modelo, p_serie: serie },
            );
            if (rErr) throw rErr;
            const row = Array.isArray(res) ? res[0] : res;
            numeroReservado = Number(row?.numero);
            if (numeroReservado) {
              payload.numero = numeroReservado;
              if (payload.infNFe?.ide) payload.infNFe.ide.nNF = numeroReservado;
            }
          } catch (e) {
            return new Response(
              JSON.stringify({ error: `Falha ao reservar número: ${(e as Error).message}` }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }

        const res = await nuvemFiscalRequest(
          "POST",
          `/nfe?ambiente=${ambiente}`,
          payload
        );
        const data = await res.json();

        if (!res.ok) {
          await audit(supabase, "REJEICAO", {
            modelo,
            serie,
            numero: numeroReservado,
            status: String(res.status),
            payload: { request: payload, response: data, ambiente },
            observacao: "Rejeição na transmissão Nuvem Fiscal",
          });
          if (numeroReservado) {
            try {
              await supabase.rpc("liberar_numero_nfe", {
                p_modelo: modelo,
                p_serie: serie,
                p_numero: numeroReservado,
                p_motivo: `Rejeitada (HTTP ${res.status})`,
              });
            } catch (_) {/* noop */}
          }
          return new Response(JSON.stringify({ error: data }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        await audit(supabase, "EMISSAO", {
          modelo,
          serie,
          numero: numeroReservado,
          chave_acesso: data?.chave ?? data?.chave_acesso ?? null,
          protocolo: data?.protocolo ?? data?.numero_protocolo ?? null,
          status: data?.status || "ok",
          payload: { request: payload, response: data, ambiente },
        });

        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── Consultar NF-e emitida ───
      case "consultar-nfe": {
        const nfeId = url.searchParams.get("id");
        if (!nfeId) {
          return new Response(JSON.stringify({ error: "id obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const res = await nuvemFiscalRequest("GET", `/nfe/${nfeId}`);
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── Baixar PDF (DANFE) ───
      case "danfe": {
        const nfeId = url.searchParams.get("id");
        if (!nfeId) {
          return new Response(JSON.stringify({ error: "id obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const res = await nuvemFiscalRequest("GET", `/nfe/${nfeId}/pdf`);
        if (!res.ok) {
          const errData = await res.text();
          return new Response(JSON.stringify({ error: errData }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const blob = await res.blob();
        return new Response(blob, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="danfe-${nfeId}.pdf"`,
          },
        });
      }

      // ─── Baixar XML ───
      case "xml": {
        const nfeId = url.searchParams.get("id");
        if (!nfeId) {
          return new Response(JSON.stringify({ error: "id obrigatório" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const res = await nuvemFiscalRequest("GET", `/nfe/${nfeId}/xml`);
        if (!res.ok) {
          const errData = await res.text();
          return new Response(JSON.stringify({ error: errData }), {
            status: res.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const xml = await res.text();
        return new Response(xml, {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/xml",
            "Content-Disposition": `attachment; filename="nfe-${nfeId}.xml"`,
          },
        });
      }

      // ─── Cancelar NF-e ───
      case "cancelar-nfe": {
        const nfeId = url.searchParams.get("id");
        const { justificativa } = await req.json();
        if (!nfeId || !justificativa) {
          return new Response(
            JSON.stringify({ error: "id e justificativa obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const res = await nuvemFiscalRequest(
          "POST",
          `/nfe/${nfeId}/cancelamento`,
          { justificativa }
        );
        const data = await res.json();
        await audit(supabase, "CANCELAMENTO", {
          chave_acesso: nfeId,
          status: res.ok ? "ok" : String(res.status),
          observacao: justificativa,
          payload: { response: data },
        });
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── Carta de Correção ───
      case "carta-correcao": {
        const nfeId = url.searchParams.get("id");
        const { correcao } = await req.json();
        if (!nfeId || !correcao) {
          return new Response(
            JSON.stringify({ error: "id e correcao obrigatórios" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const res = await nuvemFiscalRequest(
          "POST",
          `/nfe/${nfeId}/carta-correcao`,
          { correcao }
        );
        const data = await res.json();
        await audit(supabase, "CC_E", {
          chave_acesso: nfeId,
          status: res.ok ? "ok" : String(res.status),
          observacao: correcao,
          payload: { response: data },
        });
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── Verificar status do serviço SEFAZ ───
      case "status-sefaz": {
        const uf = url.searchParams.get("uf") || "SP";
        const ambiente = url.searchParams.get("ambiente") || "homologacao";
        const res = await nuvemFiscalRequest(
          "GET",
          `/nfe/sefaz/status?cpf_cnpj=${url.searchParams.get("cpf_cnpj")}&ambiente=${ambiente}`
        );
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (err: any) {
    const status = err.message === "Unauthorized" ? 401 : 500;
    return new Response(
      JSON.stringify({ error: err.message }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
