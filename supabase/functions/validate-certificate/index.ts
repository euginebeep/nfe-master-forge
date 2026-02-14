function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (Deno.env.get('ALLOWED_ORIGINS') || '').split(',').map(s => s.trim()).filter(Boolean);
  const allowOrigin = allowed.length === 0 || allowed.includes(origin) ? origin || '*' : allowed[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { fileId, password } = await req.json();

    if (!fileId || !password) {
      return new Response(
        JSON.stringify({ valid: false, error: "ID e senha do certificado são obrigatórios" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get file metadata
    const metaRes = await fetch(`${supabaseUrl}/rest/v1/arquivos?id=eq.${fileId}&select=storage_key,nome_original`, {
      headers: { 
        'apikey': supabaseKey, 
        'Authorization': `Bearer ${supabaseKey}` 
      }
    });
    
    const arquivos = await metaRes.json();
    if (!arquivos || arquivos.length === 0) {
      return new Response(
        JSON.stringify({ valid: false, error: "Certificado não encontrado" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }
    
    const arquivo = arquivos[0];

    // Download certificate file
    const fileRes = await fetch(`${supabaseUrl}/storage/v1/object/erp-files/${arquivo.storage_key}`, {
      headers: { 'Authorization': `Bearer ${supabaseKey}` }
    });

    if (!fileRes.ok) {
      return new Response(
        JSON.stringify({ valid: false, error: "Erro ao baixar certificado" }),
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
    let subject = '';
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
    
    // Extract CN
    for (let i = 0; i < cert.length - 10; i++) {
      if (cert[i] === 0x55 && cert[i + 1] === 0x04 && cert[i + 2] === 0x03) {
        const strType = cert[i + 3];
        if (strType === 0x0c || strType === 0x13 || strType === 0x14 || strType === 0x1e) {
          const strLen = cert[i + 4];
          if (strLen > 0 && strLen < 100) {
            const cn = new TextDecoder().decode(cert.slice(i + 5, i + 5 + strLen));
            if (!subject) subject = cn;
            else if (!issuer) issuer = cn;
          }
        }
      }
    }
    
    if (!notBefore || !notAfter) {
      return new Response(
        JSON.stringify({ valid: false, error: "Não foi possível ler dados do certificado" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const now = new Date();
    const daysUntilExpiry = Math.floor((notAfter.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const isValid = now >= notBefore && now <= notAfter;
    
    const formatDate = (d: Date) => d.toLocaleDateString('pt-BR');
    
    return new Response(
      JSON.stringify({
        valid: isValid,
        subject: subject || arquivo.nome_original.replace(/\.(pfx|p12)$/i, ''),
        issuer: issuer || 'Autoridade Certificadora',
        validFrom: formatDate(notBefore),
        validTo: formatDate(notAfter),
        daysUntilExpiry,
        error: isValid ? undefined : (now < notBefore ? "Certificado ainda não válido" : "Certificado expirado")
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ valid: false, error: "Erro ao processar certificado" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
