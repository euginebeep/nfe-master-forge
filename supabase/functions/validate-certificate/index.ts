import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import forgeModule from "https://esm.sh/node-forge@1.3.1?target=deno";

const forge = (forgeModule as any).default ?? forgeModule;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function logAudit(supabase: any, companyId: string, fileId: string, action: string, result: string, details: any = {}) {
  await supabase.rpc("registrar_evento_auditoria", {
    p_entidade_tipo: 'CERTIFICADO_A1',
    p_entidade_id: fileId,
    p_acao: action,
    p_resultado: result,
    p_detalhes: details,
    p_company_id: companyId
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { fileId, password, companyCnpj } = await req.json();
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: corsHeaders });

    const { data: profile, error: profErr } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();
    if (profErr) throw new Error(`Erro ao buscar perfil: ${profErr.message}`);
    if (!profile?.company_id) throw new Error("Perfil sem empresa vinculada.");

    // Fetch file - RLS will block if it doesn't belong to the tenant
    const { data: arquivo, error: fileErr } = await supabase.from('arquivos')
      .select('storage_key, nome_original')
      .eq('id', fileId)
      .single();

    if (fileErr || !arquivo) {
      await logAudit(supabase, profile.company_id, fileId, 'VALIDATE', 'FAILURE', { error: 'Arquivo não encontrado ou acesso negado' });
      return new Response(JSON.stringify({ error: "Certificado não encontrado ou acesso negado." }), { status: 404, headers: corsHeaders });
    }

    // Download from private bucket
    const { data: blob, error: dlErr } = await supabase.storage.from('erp-files').download(arquivo.storage_key);
    if (dlErr) throw new Error("Erro ao baixar arquivo.");

    const arrayBuffer = await blob.arrayBuffer();
    if (!forge?.util?.createBuffer || !forge?.asn1?.fromDer || !forge?.pkcs12?.pkcs12FromAsn1) {
      throw new Error("Biblioteca de certificado indisponível no runtime.");
    }
    const p12Bytes = forge.util.binary.raw.encode(new Uint8Array(arrayBuffer));
    const p12Der = forge.util.createBuffer(p12Bytes);
    const p12Asn1 = forge.asn1.fromDer(p12Der);

    let p12;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    } catch (e) {
      await logAudit(supabase, profile.company_id, fileId, 'VALIDATE', 'FAILURE', { error: 'Senha incorreta' });
      return new Response(JSON.stringify({ valid: false, error: "Senha incorreta ou arquivo corrompido." }), { headers: corsHeaders });
    }

    // Extract certificate info
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const cert = certBags[forge.pki.oids.certBag][0].cert;
    
    const subject = cert.subject.getField('CN')?.value;
    const issuer = cert.issuer.getField('CN')?.value;
    const validFrom = cert.validity.notBefore;
    const validTo = cert.validity.notAfter;
    const now = new Date();

    const isDateValid = now >= validFrom && now <= validTo;
    
    // Extract CNPJ from cert. ICP-Brasil A1 stores CNPJ in CN as "NAME:CNPJ"
    // and also in subjectAltName OtherName (OID 2.16.76.1.3.3) as a 14-digit string.
    const cnFromCn = (subject || '').split(':').pop()?.replace(/\D/g, '') || '';
    let certCnpj: string | null = cnFromCn.length === 14 ? cnFromCn : null;

    if (!certCnpj) {
      // Fallback: search all subject attributes for any 14-digit sequence
      for (const attr of cert.subject.attributes) {
        const v = String(attr.value || '').replace(/\D/g, '');
        const m = v.match(/(\d{14})/);
        if (m) { certCnpj = m[1]; break; }
      }
    }

    // Always fetch the authoritative CNPJ from the company table (never trust client)
    const { data: companyRow } = await supabase
      .from('company')
      .select('cnpj')
      .eq('id', profile.company_id)
      .maybeSingle();
    const dbCompanyCnpj = (companyRow?.cnpj || '').replace(/\D/g, '');
    const cleanCompanyCnpj = dbCompanyCnpj || (companyCnpj || '').replace(/\D/g, '');
    const isCnpjMatch = !!certCnpj && certCnpj === cleanCompanyCnpj;

    const isValid = isDateValid && isCnpjMatch;

    await logAudit(supabase, profile.company_id, fileId, 'VALIDATE', isValid ? 'SUCCESS' : 'WARNING', {
      subject, certCnpj, companyCnpj: cleanCompanyCnpj, isDateValid, isCnpjMatch
    });

    return new Response(JSON.stringify({
      valid: isValid,
      subject,
      issuer,
      validFrom: validFrom.toLocaleDateString('pt-BR'),
      validTo: validTo.toLocaleDateString('pt-BR'),
      daysUntilExpiry: Math.floor((validTo - now) / (1000 * 60 * 60 * 24)),
      certCnpj,
      companyCnpj: cleanCompanyCnpj,
      cnpjMatch: isCnpjMatch,
      error: !isDateValid
        ? "Certificado fora do prazo de validade."
        : (!isCnpjMatch ? `CNPJ do certificado (${certCnpj ?? 'não identificado'}) não coincide com o da empresa (${cleanCompanyCnpj || 'não cadastrado'}).` : undefined)
    }), { headers: corsHeaders });

  } catch (err: any) {
    console.error("[validate-certificate] erro:", err?.message, err?.stack);
    return new Response(
      JSON.stringify({ error: "Erro interno ao validar certificado.", detail: err?.message ?? String(err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});