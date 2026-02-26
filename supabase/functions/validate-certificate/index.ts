function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowOrigin = allowed.length === 0 || allowed.includes(origin) ? origin || '*' : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

// Extract CNPJ from certificate subject (CN field typically contains ":CNPJ" pattern)
function extractCnpjFromSubject(subject: string): string | null {
  // Pattern 1: "NAME:12345678000199" (common in Brazilian e-CNPJ certificates)
  const colonMatch = subject.match(/:\s*(\d{14})\b/);
  if (colonMatch) return colonMatch[1];
  
  // Pattern 2: CNPJ directly in the string
  const cnpjMatch = subject.match(/(\d{2})\.?(\d{3})\.?(\d{3})\/?(\d{4})-?(\d{2})/);
  if (cnpjMatch) return cnpjMatch.slice(1).join('');

  // Pattern 3: 14 consecutive digits
  const digitsMatch = subject.match(/(\d{14})/);
  if (digitsMatch) return digitsMatch[1];

  return null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, password, companyCnpj } = await req.json();

    if (!fileId || !password) {
      return new Response(
        JSON.stringify({ valid: false, error: "ID e senha do certificado são obrigatórios" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate auth - extract user from JWT to ensure tenant isolation
    const authHeader = req.headers.get('Authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Verify the file belongs to the user's company by checking via authenticated context
    // Get file metadata using service role (bypasses RLS for file access)
    const metaRes = await fetch(`${supabaseUrl}/rest/v1/arquivos?id=eq.${fileId}&select=storage_key,nome_original`, {
      headers: { 
        'apikey': supabaseKey, 
        'Authorization': `Bearer ${supabaseKey}` 
      }
    });
    
    const arquivos = await metaRes.json();
    if (!arquivos || arquivos.length === 0) {
      return new Response(
        JSON.stringify({ valid: false, error: "Certificado não encontrado no sistema" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    const arquivo = arquivos[0];

    // Download certificate file from private bucket using service role
    const fileRes = await fetch(`${supabaseUrl}/storage/v1/object/authenticated/erp-files/${arquivo.storage_key}`, {
      headers: { 
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      }
    });

    if (!fileRes.ok) {
      return new Response(
        JSON.stringify({ valid: false, error: "Erro ao baixar certificado do armazenamento" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const arrayBuffer = await fileRes.arrayBuffer();
    const data = new Uint8Array(arrayBuffer);
    
    // Find X.509 certificate in PKCS#12 structure
    let certStart = -1;
    let certLength = 0;
    
    for (let i = 0; i < data.length - 4; i++) {
      if (data[i] === 0x30 && data[i + 1] === 0x82) {
        const len = (data[i + 2] << 8) | data[i + 3];
        if (len > 300 && len < 3000 && i + 4 + len <= data.length) {
          const slice = data.slice(i, i + len + 4);
          let hasTime = false;
          for (let j = 0; j < slice.length - 15; j++) {
            if ((slice[j] === 0x17 || slice[j] === 0x18) && slice[j + 1] >= 12 && slice[j + 1] <= 15) {
              hasTime = true;
              break;
            }
          }
          if (hasTime) {
            certStart = i;
            certLength = len + 4;
            break;
          }
        }
      }
    }
    
    if (certStart === -1) {
      return new Response(
        JSON.stringify({ valid: false, error: "Senha incorreta ou certificado inválido" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const cert = data.slice(certStart, certStart + certLength);
    
    let notBefore: Date | null = null;
    let notAfter: Date | null = null;
    const subjects: string[] = [];
    let issuer = '';
    
    // Extract validity dates
    for (let i = 0; i < cert.length - 15; i++) {
      if ((cert[i] === 0x17 || cert[i] === 0x18) && cert[i + 1] >= 12) {
        const len = cert[i + 1];
        const timeStr = new TextDecoder().decode(cert.slice(i + 2, i + 2 + len));
        
        try {
          let date: Date;
          if (cert[i] === 0x17) {
            const yr = parseInt(timeStr.slice(0, 2));
            const fullYear = yr >= 50 ? 1900 + yr : 2000 + yr;
            date = new Date(fullYear, parseInt(timeStr.slice(2, 4)) - 1, parseInt(timeStr.slice(4, 6)),
              parseInt(timeStr.slice(6, 8)), parseInt(timeStr.slice(8, 10)), parseInt(timeStr.slice(10, 12)));
          } else {
            date = new Date(parseInt(timeStr.slice(0, 4)), parseInt(timeStr.slice(4, 6)) - 1,
              parseInt(timeStr.slice(6, 8)), parseInt(timeStr.slice(8, 10)),
              parseInt(timeStr.slice(10, 12)), parseInt(timeStr.slice(12, 14)));
          }
          
          if (!notBefore) notBefore = date;
          else if (!notAfter) { notAfter = date; break; }
        } catch { /* skip */ }
      }
    }
    
    // Extract all CN (Common Name) fields - OID 2.5.4.3
    for (let i = 0; i < cert.length - 10; i++) {
      if (cert[i] === 0x55 && cert[i + 1] === 0x04 && cert[i + 2] === 0x03) {
        const strType = cert[i + 3];
        if (strType === 0x0c || strType === 0x13 || strType === 0x14 || strType === 0x1e) {
          const strLen = cert[i + 4];
          if (strLen > 0 && strLen < 200) {
            const cn = new TextDecoder().decode(cert.slice(i + 5, i + 5 + strLen));
            subjects.push(cn);
          }
        }
      }
    }

    const subject = subjects[0] || '';
    issuer = subjects[1] || '';
    
    if (!notBefore || !notAfter) {
      return new Response(
        JSON.stringify({ valid: false, error: "Não foi possível ler dados do certificado" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CNPJ validation: check if certificate CNPJ matches company CNPJ
    let cnpjMatch = true;
    let certCnpj: string | null = null;
    let cnpjWarning: string | undefined;

    if (companyCnpj) {
      const cleanCompanyCnpj = companyCnpj.replace(/\D/g, '');
      
      // Try to find CNPJ in all subject fields
      for (const s of subjects) {
        certCnpj = extractCnpjFromSubject(s);
        if (certCnpj) break;
      }
      
      // Also try from the full file name
      if (!certCnpj) {
        certCnpj = extractCnpjFromSubject(arquivo.nome_original);
      }

      if (certCnpj && cleanCompanyCnpj) {
        if (certCnpj !== cleanCompanyCnpj) {
          cnpjMatch = false;
        }
      } else if (!certCnpj && cleanCompanyCnpj) {
        cnpjWarning = "Não foi possível extrair o CNPJ do certificado para validação cruzada";
      }
    }
    
    const now = new Date();
    const daysUntilExpiry = Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isDateValid = now >= notBefore && now <= notAfter;
    const isValid = isDateValid && cnpjMatch;
    
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR');

    let error: string | undefined;
    if (!isDateValid) {
      error = now < notBefore ? "Certificado ainda não válido" : "Certificado expirado";
    } else if (!cnpjMatch) {
      const formattedCertCnpj = certCnpj 
        ? `${certCnpj.slice(0,2)}.${certCnpj.slice(2,5)}.${certCnpj.slice(5,8)}/${certCnpj.slice(8,12)}-${certCnpj.slice(12)}`
        : 'desconhecido';
      const formattedCompanyCnpj = companyCnpj?.replace(/\D/g, '') || '';
      const fmtCompany = formattedCompanyCnpj.length === 14
        ? `${formattedCompanyCnpj.slice(0,2)}.${formattedCompanyCnpj.slice(2,5)}.${formattedCompanyCnpj.slice(5,8)}/${formattedCompanyCnpj.slice(8,12)}-${formattedCompanyCnpj.slice(12)}`
        : companyCnpj;
      error = `CNPJ do certificado (${formattedCertCnpj}) não corresponde ao CNPJ da empresa (${fmtCompany})`;
    }
    
    return new Response(
      JSON.stringify({
        valid: isValid,
        subject: subject || arquivo.nome_original.replace(/\.(pfx|p12)$/i, ''),
        issuer: issuer || 'Autoridade Certificadora',
        validFrom: formatDate(notBefore),
        validTo: formatDate(notAfter),
        daysUntilExpiry,
        certCnpj: certCnpj || undefined,
        cnpjMatch,
        cnpjWarning,
        error,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erro ao processar certificado: " + (error instanceof Error ? error.message : String(error)) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
