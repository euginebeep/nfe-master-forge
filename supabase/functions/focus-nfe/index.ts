import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isDemoUser, demoBlockedResponse } from "../_shared/demo-guard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const HOST_PROD = "https://api.focusnfe.com.br";
const HOST_HOMOLOG = "https://homologacao.focusnfe.com.br";
const host = (amb: string) => (amb === "producao" ? HOST_PROD : HOST_HOMOLOG);
const baseUrl = (amb: string) => `${host(amb)}/v2`;

// O banco grava nfe_ambiente em MAIUSCULO; a comparacao era case-sensitive e caia
// silenciosamente em homologacao. Default homologacao: falha para o lado seguro.
const normAmbiente = (v: unknown) =>
  String(v ?? "").trim().toLowerCase() === "producao" ? "producao" : "homologacao";

const SENSIVEIS = ["token_producao","token_homologacao","senha_certificado","csc_nfce_producao",
  "csc_nfce_homologacao","id_token_nfce_producao","id_token_nfce_homologacao",
  "smtp_senha","senha_responsavel","arquivo_certificado_base64","arquivo_logo_base64"];

function limpar(o: any): any {
  if (!o || typeof o !== "object") return o;
  if (Array.isArray(o)) return o.map(limpar);
  const r: any = {};
  for (const [k, v] of Object.entries(o)) if (!SENSIVEIS.includes(k)) r[k] = limpar(v);
  return r;
}

async function tokenDoTenant(companyId: string): Promise<{ token: string | null; origem: string }> {
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );
    const { data, error } = await admin.rpc("get_company_focus_token", { p_company_id: companyId });
    if (!error && data) return { token: data as string, origem: "TENANT" };
  } catch (e) {
    console.error("[focus-nfe] token do tenant:", (e as Error).message);
  }
  const env = Deno.env.get("FOCUS_NFE_TOKEN");
  return env ? { token: env, origem: "ENV_FALLBACK" } : { token: null, origem: "AUSENTE" };
}

async function focusReq(method: string, path: string, ambiente: string, token: string, body?: unknown) {
  const opts: RequestInit = {
    method,
    headers: { Authorization: `Basic ${btoa(`${token}:`)}`, "Content-Type": "application/json" },
  };
  if (body && method !== "GET") opts.body = JSON.stringify(body);
  return fetch(`${baseUrl(ambiente)}${path}`, opts);
}

async function baixarArquivo(caminho: string, ambiente: string, token: string) {
  return fetch(`${host(ambiente)}${caminho}`, { headers: { Authorization: `Basic ${btoa(`${token}:`)}` } });
}

async function auth(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Unauthorized");
  // .single() sem filtro falha aqui: a policy deixa ver todos os perfis da empresa.
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile?.company_id) throw new Error("Perfil sem empresa vinculada.");
  return { supabase, user, authHeader, companyId: profile.company_id as string };
}

async function audit(supabase: any, evento: string, extra: any = {}) {
  try {
    await supabase.rpc("registrar_evento_nfe", {
      p_evento: evento, p_nota_id: extra.nota_id ?? null, p_modelo: extra.modelo ?? null,
      p_serie: extra.serie ?? null, p_numero: extra.numero ?? null,
      p_chave_acesso: extra.chave_acesso ?? null, p_protocolo: extra.protocolo ?? null,
      p_status: extra.status ?? null, p_payload: extra.payload ?? {},
      p_observacao: extra.observacao ?? null,
    });
  } catch (e) { console.error("[focus-nfe] audit:", (e as Error).message); }
}

function mapStatus(s: string): string {
  return ({ processando_autorizacao: "processando", autorizado: "autorizado",
    erro_autorizacao: "rejeitado", cancelado: "cancelado", denegado: "denegado" } as any)[s] || s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");
    const id = url.searchParams.get("id");

    const { supabase, authHeader, companyId } = await auth(req);

    if (await isDemoUser(authHeader)) {
      return demoBlockedResponse(corsHeaders, "emiss\u00e3o de nota fiscal");
    }

    const { token, origem: origemToken } = await tokenDoTenant(companyId);
    if (!token) return json({ error: "Nenhum token da Focus configurado para esta empresa." }, 400);

    const idActions = new Set(["consultar-nfe","danfe","xml","cancelar-nfe","carta-correcao","consultar-status"]);
    if (idActions.has(action!) && id) {
      const { data: ok } = await supabase.rpc("validar_acesso_nota_saida_focus", { p_focus_nfe_id: id });
      if (!ok) return json({ error: "Acesso negado a esta nota." }, 403);
    }

    switch (action) {

      case "emitir-nota": {
        const { nota_saida_id, dry_run } = await req.json();
        if (!nota_saida_id) return json({ error: "nota_saida_id nao informado." }, 400);

        const { data: nota, error: nErr } = await supabase.from("notas_saida")
          .select("id, modelo, serie, status, finalidade, ambiente, focus_nfe_id")
          .eq("id", nota_saida_id).maybeSingle();
        if (nErr || !nota) return json({ error: "Nota nao encontrada ou acesso negado." }, 404);
        if (nota.status !== "RASCUNHO") {
          return json({ error: `Nota ja esta em status ${nota.status}; apenas rascunhos podem ser transmitidos.` }, 409);
        }

        const { data: payload, error: pErr } = await supabase
          .rpc("montar_payload_focus", { p_nota_saida_id: nota_saida_id });
        if (pErr || !payload) return json({ error: `Falha ao montar o payload: ${pErr?.message}` }, 400);

        const { data: emp } = await supabase.from("company")
          .select("nfe_ambiente").eq("id", companyId).maybeSingle();
        const ambiente = normAmbiente(nota.ambiente ?? emp?.nfe_ambiente);

        // NUMERACAO: delegada a Focus.
        // A documentacao recomenda deixar serie e numero em branco. Alem disso, em
        // indisponibilidade da SEFAZ a Focus reenvia em contingencia e pode cancelar
        // a tentativa anterior, gerando "pulo" de numeracao. Um contador proprio no
        // ERP nao tem como acompanhar isso e sairia do sincronismo com a SEFAZ.
        // A ref usa o id da nota, que ja e unico e idempotente por token.
        const ref = `ns-${String(nota_saida_id).replace(/-/g, "")}`;
        const qs = `?ref=${ref}` + (dry_run ? "&dry_run=1" : "");

        const r = await focusReq("POST", `/nfe${qs}`, ambiente, token, payload);
        const texto = await r.text();
        let data: any; try { data = JSON.parse(texto); } catch { data = { texto: texto.slice(0, 800) }; }
        data = limpar(data);

        if (!r.ok) {
          await audit(supabase, "REJEICAO", { nota_id: nota_saida_id,
            status: String(r.status), payload: { detalhes: data, ambiente, origemToken } });
          return json({ error: "Rejeicao na emissao.", detalhes: data, ambiente, ref }, r.status);
        }

        // Serie e numero passam a vir da resposta da Focus, nao de contador local.
        if (!dry_run) {
          await supabase.from("notas_saida").update({
            focus_nfe_id: ref,
            numero: data.numero ? Number(data.numero) : null,
            serie:  data.serie  ? String(data.serie)  : nota.serie,
            chave_acesso: data.chave_nfe ?? null,
            protocolo_autorizacao: data.protocolo ?? null,
            status: mapStatus(data.status ?? "processando").toUpperCase(),
            ambiente: ambiente.toUpperCase(),
            data_emissao: new Date().toISOString(),
            danfe_url: data.caminho_danfe ? `${host(ambiente)}${data.caminho_danfe}` : null,
            updated_at: new Date().toISOString(),
          }).eq("id", nota_saida_id);
        }

        await audit(supabase, "EMISSAO", { nota_id: nota_saida_id,
          numero: data.numero ?? null, serie: data.serie ?? null,
          chave_acesso: data.chave_nfe, protocolo: data.protocolo,
          status: data.status ?? "ok",
          payload: { ambiente, ref, origemToken, dry_run: !!dry_run } });

        return json({ ...data, id: ref, ref, ambiente,
          chave_acesso: data.chave_nfe ?? data.chave_acesso,
          status_interno: mapStatus(data.status ?? ""),
          link_pdf: data.caminho_danfe ? `${host(ambiente)}${data.caminho_danfe}` : null,
          link_xml: data.caminho_xml_nota_fiscal ? `${host(ambiente)}${data.caminho_xml_nota_fiscal}` : null,
          dry_run: !!dry_run, origem_token: origemToken });
      }

      case "consultar-nfe":
      case "consultar-status": {
        if (!id) throw new Error("ID (ref) nao informado.");
        const ambiente = normAmbiente(url.searchParams.get("ambiente"));
        const r = await focusReq("GET", `/nfe/${id}`, ambiente, token);
        const data = limpar(await r.json().catch(() => ({})));
        const st = mapStatus(data.status ?? "");

        // Reconcilia o ERP com a SEFAZ, inclusive numeracao alterada por contingencia.
        if (r.ok && data.status) {
          await supabase.from("notas_saida").update({
            status: st.toUpperCase(),
            numero: data.numero ? Number(data.numero) : null,
            serie:  data.serie  ? String(data.serie)  : null,
            chave_acesso: data.chave_nfe ?? null,
            protocolo_autorizacao: data.protocolo ?? null,
            updated_at: new Date().toISOString(),
          }).eq("focus_nfe_id", id);
        }

        return json({ ...data, ambiente, status: st, status_interno: st,
          chave_acesso: data.chave_nfe ?? data.chave_acesso,
          link_pdf: data.caminho_danfe ? `${host(ambiente)}${data.caminho_danfe}` : null,
          link_xml: data.caminho_xml_nota_fiscal ? `${host(ambiente)}${data.caminho_xml_nota_fiscal}` : null },
          r.status);
      }

      case "danfe":
      case "xml": {
        if (!id) throw new Error("ID (ref) nao informado.");
        const ambiente = normAmbiente(url.searchParams.get("ambiente"));
        const c = await focusReq("GET", `/nfe/${id}`, ambiente, token);
        const cd = await c.json().catch(() => ({}));
        const caminho = action === "danfe" ? cd.caminho_danfe : cd.caminho_xml_nota_fiscal;
        if (!caminho) {
          return json({ error: `${action === "danfe" ? "DANFE" : "XML"} nao disponivel. A nota pode estar em processamento.` }, 404);
        }
        const f = await baixarArquivo(caminho, ambiente, token);
        if (!f.ok) return json({ error: "Erro ao baixar o arquivo." }, f.status);
        return action === "danfe"
          ? new Response(await f.blob(), { headers: { ...corsHeaders, "Content-Type": "application/pdf" } })
          : new Response(await f.text(), { headers: { ...corsHeaders, "Content-Type": "application/xml" } });
      }

      case "cancelar-nfe": {
        if (!id) throw new Error("ID (ref) nao informado.");
        const { justificativa } = await req.json();
        if (!justificativa || justificativa.length < 15) {
          throw new Error("Justificativa deve ter no minimo 15 caracteres.");
        }
        const ambiente = normAmbiente(url.searchParams.get("ambiente"));
        const r = await focusReq("DELETE", `/nfe/${id}`, ambiente, token, { justificativa });
        const data = limpar(await r.json().catch(() => ({})));
        if (r.ok) {
          await supabase.from("notas_saida").update({
            status: "CANCELADO", motivo_cancelamento: justificativa,
            data_cancelamento: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("focus_nfe_id", id);
        }
        await audit(supabase, "CANCELAMENTO", { chave_acesso: id,
          status: r.ok ? "ok" : "erro", observacao: justificativa, payload: { ambiente } });
        return json(data, r.status);
      }

      case "carta-correcao": {
        if (!id) throw new Error("ID (ref) nao informado.");
        const { correcao } = await req.json();
        if (!correcao || correcao.length < 15) throw new Error("Correcao deve ter no minimo 15 caracteres.");
        const ambiente = normAmbiente(url.searchParams.get("ambiente"));
        const r = await focusReq("POST", `/nfe/${id}/carta_correcao`, ambiente, token, { correcao });
        const data = limpar(await r.json().catch(() => ({})));
        await audit(supabase, "CC_E", { chave_acesso: id, status: r.ok ? "ok" : "erro",
          observacao: correcao, payload: { ambiente } });
        return json(data, r.status);
      }

      case "inutilizar-nfe": {
        const b = await req.json();
        const { cnpj, serie, numero_inicial, numero_final, justificativa } = b;
        if (!cnpj || !serie || !numero_inicial || !numero_final || !justificativa) {
          throw new Error("Campos obrigatorios: cnpj, serie, numero_inicial, numero_final, justificativa.");
        }
        if (justificativa.length < 15) throw new Error("Justificativa deve ter no minimo 15 caracteres.");
        const ambiente = normAmbiente(b.ambiente);
        const r = await focusReq("POST", "/nfe/inutilizacao", ambiente, token, {
          cnpj: String(cnpj).replace(/\D/g, ""), serie: String(serie),
          numero_inicial: String(numero_inicial), numero_final: String(numero_final), justificativa,
        });
        const data = limpar(await r.json().catch(() => ({})));
        await audit(supabase, "INUTILIZACAO", { status: r.ok ? "ok" : "erro",
          observacao: `Serie ${serie} n. ${numero_inicial}-${numero_final}: ${justificativa}`,
          payload: { ambiente } });
        return json(data, r.status);
      }

      case "consultar-empresa": {
        const { data: emp } = await supabase.from("company")
          .select("cnpj, focus_nfe_empresa_id").eq("id", companyId).maybeSingle();
        if (!emp?.focus_nfe_empresa_id) return json({ error: "Empresa sem cadastro na Focus." }, 404);
        const r = await focusReq("GET", `/empresas/${emp.focus_nfe_empresa_id}`, "producao", token);
        const data = limpar(await r.json().catch(() => ({})));
        return json(data, r.status);
      }

      default:
        return json({ error: "Acao invalida." }, 400);
    }
  } catch (err: any) {
    const status = err.message === "Unauthorized" ? 401 : 400;
    console.error("[focus-nfe] erro:", err.message, err.stack);
    return json({ error: err.message }, status);
  }
});