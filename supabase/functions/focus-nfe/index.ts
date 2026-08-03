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

const normAmbiente = (v: unknown) =>
  String(v ?? "").trim().toLowerCase() === "producao" ? "producao" : "homologacao";

/** Caminhos Focus relativos (/arquivos/...) → URL absoluta. Absolutos ficam inalterados. */
function urlArquivoFocus(caminho: string | null | undefined, ambiente: string): string {
  const c = String(caminho ?? "").trim();
  if (!c) return c;
  if (c.startsWith("http://") || c.startsWith("https://")) return c;
  const base = host(ambiente);
  return c.startsWith("/") ? `${base}${c}` : `${base}/${c}`;
}

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

/** A Focus devolve chave_nfe com prefixo "NFe" (47 chars). DANFE, devolucao e
 *  consulta na SEFAZ exigem os 44 digitos limpos. */
function chave44(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  return /^[0-9]{44}$/.test(d) ? d : null;
}

function mapStatus(s: string): string {
  return ({ processando_autorizacao: "PROCESSANDO", autorizado: "AUTORIZADO",
    erro_autorizacao: "REJEITADO", cancelado: "CANCELADO",
    denegado: "DENEGADO" } as any)[s] || String(s ?? "").toUpperCase();
}

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } });
}

async function tokenDoTenant(companyId: string): Promise<{ token: string | null; origem: string }> {
  try {
    const { data, error } = await admin().rpc("get_company_focus_token", { p_company_id: companyId });
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
  const url = urlArquivoFocus(caminho, ambiente);
  return fetch(url, { headers: { Authorization: `Basic ${btoa(`${token}:`)}` } });
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
  const { data: profile } = await supabase
    .from("profiles").select("company_id").eq("id", user.id).maybeSingle();
  if (!profile?.company_id) throw new Error("Perfil sem empresa vinculada.");
  return { supabase, user, authHeader, companyId: profile.company_id as string };
}

async function registrarRetorno(supabase: any, notaId: string, resposta: any, ambiente: string, ref?: string) {
  try {
    const { data, error } = await supabase.rpc("registrar_retorno_focus", {
      p_nota_saida_id: notaId, p_resposta: resposta,
      p_ambiente: ambiente, p_ref: ref ?? null,
    });
    if (error) console.error("[focus-nfe] registrar_retorno_focus:", error.message);
    return data;
  } catch (e) {
    console.error("[focus-nfe] registrar_retorno_focus:", (e as Error).message);
    return null;
  }
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

    const idActions = new Set(["consultar-nfe","danfe","xml","cancelar-nfe","carta-correcao","consultar-status","reenviar-email"]);
    if (idActions.has(action!) && id) {
      const { data: ok } = await supabase.rpc("validar_acesso_nota_saida_focus", { p_focus_nfe_id: id });
      if (!ok) return json({ error: "Acesso negado a esta nota." }, 403);
    }

    switch (action) {

      // Previsao de numeracao. A Focus e quem atribui na transmissao, mas o
      // usuario precisa saber QUAL numero a nota provavelmente recebera.
      // E previsao, nao reserva: em contingencia pode haver pulo.
      case "proximo-numero": {
        const { data: emp } = await supabase.from("company")
          .select("focus_nfe_empresa_id, nfe_ambiente").eq("id", companyId).maybeSingle();
        if (!emp?.focus_nfe_empresa_id) {
          return json({ error: "Empresa sem cadastro na Focus." }, 404);
        }

        const r = await focusReq("GET", `/empresas/${emp.focus_nfe_empresa_id}`, "producao", token);
        if (!r.ok) return json({ error: "Nao foi possivel consultar a numeracao na Focus." }, r.status);
        const dados = limpar(await r.json().catch(() => ({})));

        try {
          await admin().rpc("atualizar_numeracao_focus", {
            p_company_id: companyId,
            p_serie_producao: dados?.serie_nfe_producao ?? null,
            p_proximo_producao: dados?.proximo_numero_nfe_producao ?? null,
            p_serie_homologacao: dados?.serie_nfe_homologacao ?? null,
            p_proximo_homologacao: dados?.proximo_numero_nfe_homologacao ?? null,
          });
        } catch (e) { console.error("[focus-nfe] cache numeracao:", (e as Error).message); }

        const producao = normAmbiente(emp.nfe_ambiente) === "producao";
        return json({
          ambiente: producao ? "producao" : "homologacao",
          serie: producao ? dados?.serie_nfe_producao : dados?.serie_nfe_homologacao,
          proximo_numero: producao ? dados?.proximo_numero_nfe_producao
                                   : dados?.proximo_numero_nfe_homologacao,
          observacao: "Previsao. A numeracao definitiva e atribuida na transmissao e pode pular em contingencia.",
          atualizado_em: new Date().toISOString(),
        });
      }

      case "emitir-nota": {
        const { nota_saida_id, dry_run } = await req.json();
        if (!nota_saida_id) return json({ error: "nota_saida_id nao informado." }, 400);

        const { data: nota, error: nErr } = await supabase.from("notas_saida")
          .select("id, modelo, serie, status, finalidade, ambiente, focus_nfe_id")
          .eq("id", nota_saida_id).maybeSingle();
        if (nErr || !nota) return json({ error: "Nota nao encontrada ou acesso negado." }, 404);

        // A Focus permite reenvio com a mesma ref quando o status e erro_autorizacao.
        const BLOQUEADOS = new Set(["AUTORIZADO", "CANCELADO", "DENEGADO", "PROCESSANDO"]);
        if (BLOQUEADOS.has(String(nota.status).toUpperCase())) {
          return json({ error: `Nota em status ${nota.status}. `
            + (nota.status === "PROCESSANDO"
               ? "Aguarde o processamento ou consulte o status."
               : "Notas autorizadas, canceladas ou denegadas nao podem ser retransmitidas.") }, 409);
        }

        const { data: payload, error: pErr } = await supabase
          .rpc("montar_payload_focus", { p_nota_saida_id: nota_saida_id });
        if (pErr || !payload) return json({ error: `Falha ao montar o payload: ${pErr?.message}` }, 400);

        const { data: emp } = await supabase.from("company")
          .select("nfe_ambiente").eq("id", companyId).maybeSingle();
        const ambiente = normAmbiente(nota.ambiente ?? emp?.nfe_ambiente);

        const ref = nota.focus_nfe_id ?? `ns-${String(nota_saida_id).replace(/-/g, "")}`;
        const qs = `?ref=${ref}` + (dry_run ? "&dry_run=1" : "");

        const r = await focusReq("POST", `/nfe${qs}`, ambiente, token, payload);
        const texto = await r.text();
        let data: any; try { data = JSON.parse(texto); } catch { data = { texto: texto.slice(0, 800) }; }
        data = limpar(data);

        if (!r.ok) {
          // already_processed: a SEFAZ já autorizou — consultar e gravar, nunca marcar REJEITADO.
          const codigoFocus = String(data?.codigo ?? data?.status ?? "").toLowerCase();
          const msgFocus = String(data?.mensagem ?? data?.message ?? "").toLowerCase();
          const already =
            codigoFocus.includes("already_processed")
            || msgFocus.includes("already_processed")
            || msgFocus.includes("ja foi processado")
            || msgFocus.includes("já foi processado");

          if (already && !dry_run) {
            const c = await focusReq("GET", `/nfe/${ref}?completa=1`, ambiente, token);
            const consultado = limpar(await c.json().catch(() => ({})));
            const reg = await registrarRetorno(supabase, nota_saida_id, consultado, ambiente, ref);
            await audit(supabase, "CONSULTA", {
              nota_id: nota_saida_id,
              status: "already_processed",
              chave_acesso: chave44(consultado.chave_nfe),
              protocolo: consultado.protocolo,
              payload: { ambiente, ref, origemToken, already_processed: true },
            });
            return json({
              ...consultado,
              id: ref,
              ref,
              ambiente,
              chave_acesso: chave44(consultado.chave_nfe),
              status_interno: mapStatus(consultado.status ?? "autorizado"),
              link_pdf: consultado.caminho_danfe ? urlArquivoFocus(consultado.caminho_danfe, ambiente) : null,
              link_xml: consultado.caminho_xml_nota_fiscal
                ? urlArquivoFocus(consultado.caminho_xml_nota_fiscal, ambiente)
                : null,
              registro: reg,
              already_processed: true,
              origem_token: origemToken,
            });
          }

          if (!dry_run) {
            await supabase.from("notas_saida").update({
              status: "REJEITADO",
              status_sefaz: data?.codigo ?? data?.status_sefaz ?? String(r.status),
              mensagem_sefaz: data?.mensagem
                ?? data?.erros?.map((e: any) => e.mensagem).join(" | ")
                ?? "Rejeicao na emissao",
              focus_nfe_id: ref, consultado_em: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }).eq("id", nota_saida_id);
          }
          await audit(supabase, "REJEICAO", { nota_id: nota_saida_id,
            status: String(r.status), payload: { detalhes: data, ambiente, origemToken } });
          return json({ error: "Rejeicao na emissao.", detalhes: data, ambiente, ref }, r.status);
        }

        let reg: any = null;
        if (!dry_run) reg = await registrarRetorno(supabase, nota_saida_id, data, ambiente, ref);

        await audit(supabase, "EMISSAO", { nota_id: nota_saida_id,
          numero: data.numero ?? null, serie: data.serie ?? null,
          chave_acesso: chave44(data.chave_nfe), protocolo: data.protocolo,
          status: data.status ?? "ok",
          payload: { ambiente, ref, origemToken, dry_run: !!dry_run } });

        return json({ ...data, id: ref, ref, ambiente,
          chave_acesso: chave44(data.chave_nfe),
          status_interno: mapStatus(data.status ?? ""),
          link_pdf: data.caminho_danfe ? urlArquivoFocus(data.caminho_danfe, ambiente) : null,
          link_xml: data.caminho_xml_nota_fiscal ? urlArquivoFocus(data.caminho_xml_nota_fiscal, ambiente) : null,
          registro: reg, dry_run: !!dry_run, origem_token: origemToken });
      }

      case "consultar-nfe":
      case "consultar-status": {
        if (!id) throw new Error("ID (ref) nao informado.");
        const ambiente = normAmbiente(url.searchParams.get("ambiente"));
        // completa=1: unica forma documentada de obter tpEmis, dhCont e xJust
        const r = await focusReq("GET", `/nfe/${id}?completa=1`, ambiente, token);
        const data = limpar(await r.json().catch(() => ({})));

        let reg: any = null;
        if (r.ok && data.status) {
          const { data: nota } = await supabase.from("notas_saida")
            .select("id").eq("focus_nfe_id", id).maybeSingle();
          if (nota?.id) reg = await registrarRetorno(supabase, nota.id, data, ambiente, id);
        }

        return json({ ...data, ambiente,
          status_interno: mapStatus(data.status ?? ""),
          chave_acesso: chave44(data.chave_nfe),
          link_pdf: data.caminho_danfe ? urlArquivoFocus(data.caminho_danfe, ambiente) : null,
          link_xml: data.caminho_xml_nota_fiscal ? urlArquivoFocus(data.caminho_xml_nota_fiscal, ambiente) : null,
          registro: reg }, r.status);
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
        if (!justificativa || justificativa.length < 15 || justificativa.length > 255) {
          throw new Error("Justificativa deve ter entre 15 e 255 caracteres.");
        }
        const ambiente = normAmbiente(url.searchParams.get("ambiente"));
        const r = await focusReq("DELETE", `/nfe/${id}`, ambiente, token, { justificativa });
        const data = limpar(await r.json().catch(() => ({})));
        if (r.ok) {
          await supabase.from("notas_saida").update({
            status: "CANCELADO", motivo_cancelamento: justificativa,
            status_sefaz: data.status_sefaz ?? null,
            mensagem_sefaz: data.mensagem_sefaz ?? null,
            caminho_xml_cancelamento: data.caminho_xml_cancelamento ?? null,
            data_cancelamento: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("focus_nfe_id", id);
        }
        await audit(supabase, "CANCELAMENTO", { chave_acesso: id,
          status: r.ok ? "ok" : "erro", observacao: justificativa, payload: { ambiente } });
        return json({ ...data, status_interno: r.ok ? "CANCELADO" : "ERRO_CANCELAMENTO" }, r.status);
      }

      case "carta-correcao": {
        if (!id) throw new Error("ID (ref) nao informado.");
        const { correcao } = await req.json();
        if (!correcao || correcao.length < 15 || correcao.length > 1000) {
          throw new Error("Correcao deve ter entre 15 e 1000 caracteres.");
        }
        const ambiente = normAmbiente(url.searchParams.get("ambiente"));
        const r = await focusReq("POST", `/nfe/${id}/carta_correcao`, ambiente, token, { correcao });
        const data = limpar(await r.json().catch(() => ({})));
        if (r.ok) {
          await supabase.from("notas_saida").update({
            numero_carta_correcao: data.numero_carta_correcao ?? null,
            caminho_pdf_carta_correcao: data.caminho_pdf_carta_correcao ?? null,
            updated_at: new Date().toISOString(),
          }).eq("focus_nfe_id", id);
        }
        await audit(supabase, "CC_E", { chave_acesso: id, status: r.ok ? "ok" : "erro",
          observacao: correcao, payload: { ambiente } });
        return json(data, r.status);
      }

      case "reenviar-email": {
        if (!id) throw new Error("ID (ref) nao informado.");
        const body = await req.json().catch(() => ({}));
        const ambiente = normAmbiente(url.searchParams.get("ambiente"));
        const emails: string[] = Array.isArray(body.emails) ? body.emails : [];
        if (emails.length === 0) throw new Error("Informe ao menos um e-mail.");
        const r = await focusReq("POST", `/nfe/${id}/email`, ambiente, token, { emails });
        const data = limpar(await r.json().catch(() => ({})));
        if (r.ok) {
          await supabase.from("notas_saida").update({
            email_enviado_em: new Date().toISOString(),
            email_enviado_para: emails.join(", "),
            updated_at: new Date().toISOString(),
          }).eq("focus_nfe_id", id);
        }
        return json(data, r.status);
      }

      case "inutilizar-nfe": {
        const b = await req.json();
        const { cnpj, serie, numero_inicial, numero_final, justificativa } = b;
        if (!cnpj || !serie || !numero_inicial || !numero_final || !justificativa) {
          throw new Error("Campos obrigatorios: cnpj, serie, numero_inicial, numero_final, justificativa.");
        }
        if (justificativa.length < 15 || justificativa.length > 255) {
          throw new Error("Justificativa deve ter entre 15 e 255 caracteres.");
        }
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