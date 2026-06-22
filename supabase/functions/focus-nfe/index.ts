import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDemoUser, demoBlockedResponse } from "../_shared/demo-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FOCUS_NFE_API_PROD = "https://api.focusnfe.com.br/v2";
const FOCUS_NFE_API_HOMOLOG = "https://homologacao.focusnfe.com.br/v2";

function getBaseUrl(ambiente: string): string {
  return ambiente === "producao" ? FOCUS_NFE_API_PROD : FOCUS_NFE_API_HOMOLOG;
}

async function focusNfeRequest(
  method: string,
  path: string,
  ambiente: string,
  body?: unknown
): Promise<Response> {
  const token = Deno.env.get("FOCUS_NFE_TOKEN");
  if (!token) {
    throw new Error("Token da Focus NFe não configurado. Configure FOCUS_NFE_TOKEN nos secrets do Supabase.");
  }

  const baseUrl = getBaseUrl(ambiente);
  const url = `${baseUrl}${path}`;
  const authString = btoa(`${token}:`); // Basic Auth com senha vazia

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Basic ${authString}`,
      "Content-Type": "application/json",
    },
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")) {
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

async function audit(supabase: any, evento: string, extra: any = {}) {
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const id = url.searchParams.get("id"); // ref da nota na Focus NFe

    const { supabase, user } = await authenticateUser(req);

    if (await isDemoUser(supabase, user.id)) {
      return demoBlockedResponse();
    }

    // Ações que exigem validação de acesso à nota
    const idBasedActions = new Set(["consultar-nfe", "danfe", "xml", "cancelar-nfe", "carta-correcao"]);
    if (idBasedActions.has(action!) && id) {
      const { data: hasAccess } = await supabase.rpc("validar_acesso_nota_saida_focus", {
        p_focus_nfe_id: id
      });
      if (!hasAccess) {
        return new Response(JSON.stringify({ error: "Acesso negado a esta nota." }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    switch (action) {

      // ─── EMPRESA ────────────────────────────────────────────────────────────
      case "cadastrar-empresa": {
        const payload = await req.json();
        // A Focus NFe usa o mesmo endpoint para produção e homologação
        // mas a empresa é cadastrada uma vez e serve ambos os ambientes
        const res = await focusNfeRequest("POST", "/empresas", "producao", payload);
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
        const cpfCnpj = url.searchParams.get("cpf_cnpj");
        // Segurança: só permite consultar o próprio CNPJ
        const { data: profile } = await supabase.from("profiles").select("company_id").single();
        const { data: company } = await supabase.from("companies").select("cnpj").eq("id", profile?.company_id).single();
        const cleanCnpj = company?.cnpj?.replace(/\D/g, "");
        const cleanRequested = cpfCnpj?.replace(/\D/g, "");
        if (!cleanRequested || cleanRequested !== cleanCnpj) {
          return new Response(JSON.stringify({ error: "Você só pode consultar os dados da sua própria empresa." }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        // Focus NFe: busca por query param cnpj
        const res = await focusNfeRequest("GET", `/empresas?cnpj=${cleanRequested}`, "producao");
        const data = await res.json();
        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── EMISSÃO ─────────────────────────────────────────────────────────────
      case "emitir-nfe": {
        const payload = await req.json();
        const ambiente = payload.ambiente === "producao" ? "producao" : "homologacao";
        delete payload.ambiente;

        const modelo = payload.modelo === "65" ? "65" : "55";
        const serie = Number(payload.serie ?? 1) || 1;

        // Reservar número sequencial
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

        // Focus NFe: ref é gerada pelo ERP para idempotência
        // Usar o número da nota como ref para facilitar rastreamento
        const ref = `nfe-${modelo}-${serie}-${payload.numero || Date.now()}`;

        const res = await focusNfeRequest("POST", `/nfe?ref=${ref}`, ambiente, payload);
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

        // Normalizar resposta para o mesmo formato que o frontend espera
        // Focus NFe retorna: { status, ref, chave_nfe, numero, serie, protocolo, caminho_danfe, caminho_xml_nota_fiscal }
        const normalized = {
          ...data,
          id: ref,                                          // compatibilidade: frontend usa resultado.id
          chave_acesso: data.chave_nfe || data.chave_acesso, // normalizar nome do campo
          link_pdf: data.caminho_danfe                       // compatibilidade com campo danfe_url
            ? `https://api.focusnfe.com.br${data.caminho_danfe}`
            : null,
          link_xml: data.caminho_xml_nota_fiscal
            ? `https://api.focusnfe.com.br${data.caminho_xml_nota_fiscal}`
            : null,
        };

        await audit(supabase, "EMISSAO", {
          modelo, serie, numero: numeroReservado,
          chave_acesso: data.chave_nfe,
          protocolo: data.protocolo,
          status: data.status || "ok",
        });

        return new Response(JSON.stringify(normalized), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── CONSULTA ────────────────────────────────────────────────────────────
      case "consultar-nfe": {
        if (!id) throw new Error("ID (ref) não informado.");
        const ambiente = url.searchParams.get("ambiente") || "homologacao";
        const res = await focusNfeRequest("GET", `/nfe/${id}`, ambiente);
        const data = await res.json();

        // Normalizar campos de resposta
        const normalized = {
          ...data,
          chave_acesso: data.chave_nfe || data.chave_acesso,
          protocolo: data.protocolo,
          // Mapear status da Focus NFe para o padrão do ERP
          status: mapStatus(data.status),
          link_pdf: data.caminho_danfe
            ? `https://api.focusnfe.com.br${data.caminho_danfe}`
            : null,
          link_xml: data.caminho_xml_nota_fiscal
            ? `https://api.focusnfe.com.br${data.caminho_xml_nota_fiscal}`
            : null,
        };

        return new Response(JSON.stringify(normalized), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ─── DANFE (PDF) ─────────────────────────────────────────────────────────
      case "danfe": {
        if (!id) throw new Error("ID (ref) não informado.");
        const ambiente = url.searchParams.get("ambiente") || "homologacao";

        // Primeiro consultar para obter o caminho do DANFE
        const consultaRes = await focusNfeRequest("GET", `/nfe/${id}`, ambiente);
        const consultaData = await consultaRes.json();

        if (!consultaData.caminho_danfe) {
          return new Response(JSON.stringify({ error: "DANFE não disponível. A nota pode ainda estar em processamento." }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Baixar o PDF diretamente do servidor da Focus NFe
        const token = Deno.env.get("FOCUS_NFE_TOKEN")!;
        const authString = btoa(`${token}:`);
        const pdfRes = await fetch(`https://api.focusnfe.com.br${consultaData.caminho_danfe}`, {
          headers: { Authorization: `Basic ${authString}` },
        });

        if (!pdfRes.ok) {
          return new Response(JSON.stringify({ error: "Erro ao baixar DANFE." }), {
            status: pdfRes.status,
            headers: corsHeaders,
          });
        }

        const blob = await pdfRes.blob();
        return new Response(blob, {
          headers: { ...corsHeaders, "Content-Type": "application/pdf" },
        });
      }

      // ─── XML ─────────────────────────────────────────────────────────────────
      case "xml": {
        if (!id) throw new Error("ID (ref) não informado.");
        const ambiente = url.searchParams.get("ambiente") || "homologacao";

        const consultaRes = await focusNfeRequest("GET", `/nfe/${id}`, ambiente);
        const consultaData = await consultaRes.json();

        if (!consultaData.caminho_xml_nota_fiscal) {
          return new Response(JSON.stringify({ error: "XML não disponível." }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const token = Deno.env.get("FOCUS_NFE_TOKEN")!;
        const authString = btoa(`${token}:`);
        const xmlRes = await fetch(`https://api.focusnfe.com.br${consultaData.caminho_xml_nota_fiscal}`, {
          headers: { Authorization: `Basic ${authString}` },
        });

        if (!xmlRes.ok) {
          return new Response(JSON.stringify({ error: "Erro ao baixar XML." }), {
            status: xmlRes.status,
            headers: corsHeaders,
          });
        }

        const xml = await xmlRes.text();
        return new Response(xml, {
          headers: { ...corsHeaders, "Content-Type": "application/xml" },
        });
      }

      // ─── CANCELAMENTO ────────────────────────────────────────────────────────
      case "cancelar-nfe": {
        if (!id) throw new Error("ID (ref) não informado.");
        const { justificativa } = await req.json();
        if (!justificativa || justificativa.length < 15) {
          throw new Error("Justificativa deve ter no mínimo 15 caracteres.");
        }
        const ambiente = url.searchParams.get("ambiente") || "homologacao";

        // Focus NFe: DELETE /nfe/:ref com body
        const res = await focusNfeRequest("DELETE", `/nfe/${id}`, ambiente, { justificativa });
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

      // ─── CARTA DE CORREÇÃO ───────────────────────────────────────────────────
      case "carta-correcao": {
        if (!id) throw new Error("ID (ref) não informado.");
        const { correcao } = await req.json();
        if (!correcao || correcao.length < 15) {
          throw new Error("Correção deve ter no mínimo 15 caracteres.");
        }
        const ambiente = url.searchParams.get("ambiente") || "homologacao";

        // Focus NFe: POST /nfe/:ref/carta_correcao (underscore, não hífen)
        const res = await focusNfeRequest("POST", `/nfe/${id}/carta_correcao`, ambiente, { correcao });
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

      // ─── STATUS SEFAZ ────────────────────────────────────────────────────────
      case "status-sefaz": {
        const cpfCnpj = url.searchParams.get("cpf_cnpj");
        const ambiente = url.searchParams.get("ambiente") || "homologacao";
        if (!cpfCnpj) throw new Error("CNPJ não informado.");

        // Focus NFe: GET /nfe/status_sefaz?cnpj=:cnpj
        const res = await focusNfeRequest("GET", `/nfe/status_sefaz?cnpj=${cpfCnpj.replace(/\D/g, "")}`, ambiente);
        const data = await res.json();

        return new Response(JSON.stringify(data), {
          status: res.status,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Ação inválida." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err: any) {
    const status = err.message === "Unauthorized" ? 401 : 400;
    return new Response(JSON.stringify({ error: err.message }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/**
 * Mapeia os status da Focus NFe para o padrão interno do BrainX ERP.
 * Focus NFe usa: processando_autorizacao, autorizado, erro_autorizacao, cancelado, denegado
 * Nuvem Fiscal usava: processando, autorizado, rejeitado, cancelado, denegado
 */
function mapStatus(status: string): string {
  const map: Record<string, string> = {
    processando_autorizacao: "processando",
    autorizado: "autorizado",
    erro_autorizacao: "rejeitado",
    cancelado: "cancelado",
    denegado: "denegado",
  };
  return map[status] || status;
}
