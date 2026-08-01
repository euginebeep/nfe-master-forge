import forgeNs from "npm:node-forge@1.3.1";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const forge: any = (forgeNs as any)?.default ?? forgeNs;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function bin(bytes: Uint8Array): string {
  let s = ""; const C = 0x8000;
  for (let i = 0; i < bytes.length; i += C) s += String.fromCharCode(...bytes.subarray(i, i + C));
  return s;
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

function admin() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } });
}

/**
 * Token da CONTA (da BrainX), usado apenas para criar/atualizar empresas na Focus.
 * Nao confundir com o token do tenant, que serve para emitir.
 */
function tokenDaConta(): string | null {
  return Deno.env.get("FOCUS_NFE_MASTER_TOKEN") ?? Deno.env.get("FOCUS_NFE_TOKEN") ?? null;
}

/**
 * Cria ou atualiza a empresa na Focus a partir do cadastro do ERP e CAPTURA os
 * tokens devolvidos, gravando-os cifrados no tenant.
 * O usuario nunca abre o painel da Focus.
 */
async function sincronizarEmpresa(opts: {
  companyId: string; company: any; certBase64: string | null; senha: string | null;
  logoBase64: string | null; dryRun: boolean;
}) {
  const token = tokenDaConta();
  if (!token) return { status: "ERRO", erro: "Token da conta Focus nao configurado (FOCUS_NFE_MASTER_TOKEN)." };

  const c = opts.company;
  const so = (v: unknown) => String(v ?? "").replace(/\D/g, "") || undefined;

  const payload: Record<string, unknown> = {
    nome: c.razao_social,
    nome_fantasia: c.nome_fantasia ?? undefined,
    cnpj: so(c.cnpj),
    inscricao_estadual: so(c.ie),
    inscricao_municipal: so(c.im),
    regime_tributario: c.crt ? Number(c.crt) : undefined,
    logradouro: c.endereco_logradouro ?? undefined,
    numero: c.endereco_nro ? String(c.endereco_nro) : undefined,
    complemento: c.endereco_compl ?? undefined,
    bairro: c.endereco_bairro ?? undefined,
    municipio: c.endereco_cidade ?? undefined,
    uf: c.endereco_uf ?? undefined,
    cep: so(c.endereco_cep),
    telefone: so(c.telefone),
    email: c.email_fiscal ? String(c.email_fiscal).trim().toLowerCase() : undefined,
    habilita_nfe: true,
    discrimina_impostos: true,
    exibe_rastro_danfe: true,
    serie_nfe_producao: c.nfe_serie_padrao ? String(c.nfe_serie_padrao) : undefined,
  };
  if (opts.certBase64 && opts.senha) {
    payload.arquivo_certificado_base64 = opts.certBase64;
    payload.senha_certificado = opts.senha;
  }
  if (opts.logoBase64) payload.arquivo_logo_base64 = opts.logoBase64;

  const criando = !c.focus_nfe_empresa_id;
  const url = criando
    ? `https://api.focusnfe.com.br/v2/empresas${opts.dryRun ? "?dry_run=1" : ""}`
    : `https://api.focusnfe.com.br/v2/empresas/${c.focus_nfe_empresa_id}${opts.dryRun ? "?dry_run=1" : ""}`;

  try {
    const r = await fetch(url, {
      method: criando ? "POST" : "PUT",
      headers: { Authorization: `Basic ${btoa(`${token}:`)}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const t = await r.text();
    let corpo: any; try { corpo = JSON.parse(t); } catch { corpo = { texto: t.slice(0, 600) }; }

    if (!r.ok) {
      return { status: "ERRO", http: r.status, criando,
        erro: corpo?.mensagem ?? `Focus HTTP ${r.status}`, resposta: limpar(corpo) };
    }

    // CAPTURA DOS TOKENS - o unico ponto do sistema que os toca em texto claro.
    const tokenProd = corpo?.token_producao ?? null;
    const tokenHomolog = corpo?.token_homologacao ?? null;
    const empresaId = corpo?.id ? String(corpo.id) : null;
    let capturou = false;

    if (!opts.dryRun && (tokenProd || tokenHomolog || empresaId)) {
      try {
        const { error } = await admin().rpc("set_company_focus_tokens_service", {
          p_company_id: opts.companyId,
          p_token_producao: tokenProd,
          p_token_homologacao: tokenHomolog,
          p_focus_empresa_id: empresaId,
        });
        capturou = !error;
        if (error) console.error("[validate-certificate] gravar tokens:", error.message);
      } catch (e) {
        console.error("[validate-certificate] gravar tokens:", (e as Error).message);
      }
    }

    return {
      status: opts.dryRun ? "DRY_RUN" : "SINCRONIZADO",
      http: r.status, criando, tokens_capturados: capturou,
      focus_empresa_id: empresaId,
      resposta: {
        nome: corpo?.nome, email: corpo?.email,
        inscricao_estadual: corpo?.inscricao_estadual,
        certificado_valido_de: corpo?.certificado_valido_de,
        certificado_valido_ate: corpo?.certificado_valido_ate,
        certificado_cnpj: corpo?.certificado_cnpj,
        exibe_rastro_danfe: corpo?.exibe_rastro_danfe,
        serie_nfe_producao: corpo?.serie_nfe_producao,
      },
    };
  } catch (e) {
    return { status: "ERRO", erro: `Falha de rede ao chamar a Focus: ${(e as Error).message}` };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  let etapa = "inicio";
  try {
    etapa = "parse_body";
    const b = await req.json().catch(() => ({}));
    let fileId: string | null = b.fileId ?? b.file_id ?? b.certificadoFileId ?? b.arquivo_id ?? null;
    const password: string | null = b.password ?? b.senha ?? null;
    let companyCnpj: string | null = b.companyCnpj ?? b.cnpj ?? null;
    const onlyStatus = b.only_status === true || b.onlyStatus === true;
    const dryRun = b.dry_run === true || b.dryRun === true;
    const pularFocus = b.pular_focus === true;

    etapa = "auth";
    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: aErr } = await supabase.auth.getUser();
    if (aErr || !user) return json({ valid: false, error: "Nao autorizado. Recarregue a pagina.", etapa }, 401);

    etapa = "perfil";
    const { data: profile, error: pErr } = await supabase
      .from("profiles").select("company_id").eq("id", user.id).maybeSingle();
    if (pErr || !profile?.company_id)
      return json({ valid: false, error: `Perfil sem empresa vinculada${pErr ? `: ${pErr.message}` : "."}`, etapa });

    etapa = "carregar_empresa";
    const { data: company } = await supabase.from("company").select(
      "cnpj, ie, im, crt, razao_social, nome_fantasia, email_fiscal, telefone, " +
      "endereco_logradouro, endereco_nro, endereco_compl, endereco_bairro, endereco_cidade, " +
      "endereco_uf, endereco_cep, certificado_a1_file_id, focus_nfe_empresa_id, " +
      "nfe_serie_padrao, logo_file_id"
    ).eq("id", profile.company_id).maybeSingle();

    if (!fileId) fileId = company?.certificado_a1_file_id ?? null;
    if (!companyCnpj) companyCnpj = company?.cnpj ?? null;

    if (onlyStatus) {
      etapa = "only_status";
      const { data: meta } = await supabase.from("company_certificado_meta").select("*")
        .eq("company_id", profile.company_id).eq("ativo", true)
        .order("extraido_em", { ascending: false }).limit(1).maybeSingle();
      const { data: integ } = await supabase.rpc("status_integracao_focus");
      if (!meta) return json({ valid: false, only_status: true, temCertificado: !!fileId,
        nuncaValidado: true, integracao: integ,
        error: fileId ? "Certificado vinculado mas nunca validado. Informe a senha." : "Nenhum certificado cadastrado." });
      const vt = new Date(meta.valido_ate);
      const dias = Math.floor((vt.getTime() - Date.now()) / 86400000);
      return json({ valid: dias >= 0, only_status: true, temCertificado: true,
        subject: meta.cn, issuer: meta.emissor, numeroSerie: meta.numero_serie,
        certCnpj: meta.cnpj_certificado,
        validFrom: new Date(meta.valido_de).toLocaleDateString("pt-BR"),
        validTo: vt.toLocaleDateString("pt-BR"), daysUntilExpiry: dias,
        focus_status: meta.focus_status, focus_sincronizado: meta.focus_status === "SINCRONIZADO",
        integracao: integ,
        error: dias < 0 ? `Certificado vencido em ${vt.toLocaleDateString("pt-BR")}.` : undefined });
    }

    if (!password) return json({ valid: false, error: "Informe a senha do certificado.", etapa });
    if (!fileId) return json({ valid: false, error: "Nenhum certificado vinculado. Envie o arquivo .pfx primeiro.", etapa });

    etapa = "buscar_arquivo";
    const { data: arq, error: fErr } = await supabase
      .from("arquivos").select("storage_key, nome_original").eq("id", fileId).maybeSingle();
    if (fErr || !arq) return json({ valid: false, error: "Certificado nao encontrado ou acesso negado.", etapa });

    etapa = "download_storage";
    const { data: blob, error: dErr } = await supabase.storage.from("erp-files").download(arq.storage_key);
    if (dErr || !blob) return json({ valid: false, error: `Erro ao baixar o arquivo: ${dErr?.message ?? "sem retorno"}`, etapa });

    etapa = "ler_pkcs12";
    const bytes = new Uint8Array(await blob.arrayBuffer());
    if (!bytes.length) return json({ valid: false, error: "Arquivo do certificado esta vazio.", etapa });
    const binario = bin(bytes);

    let p12: any;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(forge.util.createBuffer(binario, "binary")), password);
    } catch (e) {
      const msg = (e as Error).message || "";
      const senhaErrada = /mac|password|invalid|integrity/i.test(msg);
      return json({ valid: false, arquivo: arq.nome_original, etapa,
        error: senhaErrada ? `Senha incorreta para "${arq.nome_original}".`
                           : `Arquivo nao e um PKCS#12 valido: ${msg}` });
    }

    etapa = "extrair_dados";
    const bag = p12.getBags({ bagType: forge.pki.oids.certBag })?.[forge.pki.oids.certBag]?.[0];
    if (!bag?.cert) return json({ valid: false, error: "Nenhum certificado dentro do arquivo.", etapa });
    const cert = bag.cert;
    const subject = cert.subject.getField("CN")?.value ?? null;
    const issuer = cert.issuer.getField("CN")?.value ?? null;
    const vf: Date = cert.validity.notBefore, vt: Date = cert.validity.notAfter;
    const agora = new Date();
    const dataOk = agora >= vf && agora <= vt;
    const m = String(subject ?? "").match(/(\d{14})/) ?? JSON.stringify(cert.subject.attributes).match(/(\d{14})/);
    const certCnpj = m ? m[1] : null;
    const cnpjLimpo = String(companyCnpj ?? "").replace(/\D/g, "");
    const cnpjOk = !!certCnpj && !!cnpjLimpo && certCnpj === cnpjLimpo;
    const valido = dataOk && cnpjOk;
    const dias = Math.floor((vt.getTime() - agora.getTime()) / 86400000);

    // Logo: a Focus aceita PNG ate 200x200 e imprime no DANFE.
    etapa = "carregar_logo";
    let logoBase64: string | null = null;
    if (company?.logo_file_id) {
      try {
        const { data: la } = await supabase.from("arquivos")
          .select("storage_key").eq("id", company.logo_file_id).maybeSingle();
        if (la?.storage_key) {
          const { data: lb } = await supabase.storage.from("erp-files").download(la.storage_key);
          if (lb) {
            const lbytes = new Uint8Array(await lb.arrayBuffer());
            if (lbytes.length > 0 && lbytes.length < 400_000) logoBase64 = btoa(bin(lbytes));
          }
        }
      } catch (e) { console.error("[validate-certificate] logo:", (e as Error).message); }
    }

    etapa = "sincronizar_focus";
    let focus: any = { status: "SEM_INTEGRACAO" };
    if (valido && !pularFocus) {
      focus = await sincronizarEmpresa({
        companyId: profile.company_id, company,
        certBase64: btoa(binario), senha: password, logoBase64, dryRun,
      });
    } else if (!valido) {
      focus = { status: "PENDENTE", erro: "Certificado nao passou na validacao; nao foi enviado a Focus." };
    }

    etapa = "persistir_meta";
    let persistiu = true;
    try {
      await supabase.from("company_certificado_meta").update({ ativo: false }).eq("company_id", profile.company_id);
      const { error: iErr } = await supabase.from("company_certificado_meta").insert({
        company_id: profile.company_id, certificado_file_id: fileId,
        cn: subject, cnpj_certificado: certCnpj,
        razao_social_certificado: String(subject ?? "").split(":")[0] || null,
        numero_serie: cert.serialNumber ?? null, emissor: issuer,
        valido_de: vf.toISOString(), valido_ate: vt.toISOString(),
        extraido_por: user.id, ativo: valido,
        focus_status: focus.status,
        focus_sincronizado_em: focus.status === "SINCRONIZADO" ? new Date().toISOString() : null,
        focus_resposta: { http: focus.http ?? null, erro: focus.erro ?? null,
                          criando: focus.criando ?? null,
                          tokens_capturados: focus.tokens_capturados ?? null,
                          dados: focus.resposta ?? null },
      });
      if (iErr) { persistiu = false; console.error("[validate-certificate] meta:", iErr.message); }
    } catch (e) { persistiu = false; console.error("[validate-certificate] meta:", (e as Error).message); }

    try {
      await supabase.from("audit_log").insert({
        entidade: "CERTIFICADO_A1", entidade_id: fileId, acao: "VALIDATE",
        payload: { resultado: valido ? "SUCCESS" : "WARNING", subject, issuer, certCnpj,
                   dataOk, cnpjOk, dias, focus_status: focus.status,
                   tokens_capturados: focus.tokens_capturados ?? null },
        company_id: profile.company_id });
    } catch (_) { /* auditoria nao bloqueia */ }

    const { data: integ } = await supabase.rpc("status_integracao_focus");

    return json({
      valid: valido, arquivo: arq.nome_original, subject, issuer,
      numeroSerie: cert.serialNumber ?? null,
      validFrom: vf.toLocaleDateString("pt-BR"), validTo: vt.toLocaleDateString("pt-BR"),
      daysUntilExpiry: dias, certCnpj, cnpjMatch: cnpjOk, persistido: persistiu,
      focus_status: focus.status, focus_sincronizado: focus.status === "SINCRONIZADO",
      focus_erro: focus.erro ?? null, focus_dados: focus.resposta ?? null,
      empresa_criada_na_focus: focus.criando ?? null,
      tokens_capturados: focus.tokens_capturados ?? null,
      integracao: integ, dry_run: dryRun,
      error: !dataOk ? `Certificado vencido em ${vt.toLocaleDateString("pt-BR")}.`
           : (!cnpjOk ? `CNPJ do certificado (${certCnpj ?? "nao identificado"}) difere do da empresa (${cnpjLimpo || "nao informado"}).`
           : (focus.status === "ERRO" ? `Certificado valido, mas a Focus recusou: ${focus.erro}` : undefined)),
    });
  } catch (err: any) {
    console.error("[validate-certificate] etapa", etapa, err?.message, err?.stack);
    return json({ valid: false, error: `Falha na etapa "${etapa}": ${err?.message ?? "erro desconhecido"}`, etapa });
  }
});