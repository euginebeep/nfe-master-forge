import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();

    if (!cnpj || cnpj.replace(/\D/g, '').length !== 14) {
      return new Response(JSON.stringify({ error: 'CNPJ inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanCnpj = cnpj.replace(/\D/g, '');

    // Try BrasilAPI first, fallback to ReceitaWS
    let data = null;
    let lastError = '';

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (response.ok) {
        data = await response.json();
      } else {
        lastError = `BrasilAPI: ${response.status}`;
      }
    } catch (e) {
      lastError = `BrasilAPI: ${e.message}`;
    }

    // Fallback to ReceitaWS
    if (!data) {
      try {
        const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (response.ok) {
          const rwData = await response.json();
          if (rwData.status !== 'ERROR') {
            // Map ReceitaWS format to BrasilAPI format
            data = {
              cnpj: cleanCnpj,
              razao_social: rwData.nome || '',
              nome_fantasia: rwData.fantasia || '',
              cnae_fiscal: parseInt(rwData.atividade_principal?.[0]?.code?.replace(/\D/g, '') || '0'),
              cnae_fiscal_descricao: rwData.atividade_principal?.[0]?.text || '',
              logradouro: rwData.logradouro || '',
              numero: rwData.numero || '',
              complemento: rwData.complemento || '',
              bairro: rwData.bairro || '',
              cep: rwData.cep?.replace(/\D/g, '') || '',
              uf: rwData.uf || '',
              municipio: rwData.municipio || '',
              codigo_municipio: 0,
              email: rwData.email || '',
              telefone: rwData.telefone || '',
              porte: rwData.porte || '',
              opcao_pelo_simples: rwData.simples?.optante === true,
              opcao_pelo_mei: rwData.simei?.optante === true,
              data_abertura: rwData.abertura || '',
            };
          } else {
            lastError += ` | ReceitaWS: ${rwData.message}`;
          }
        }
      } catch (e) {
        lastError += ` | ReceitaWS: ${e.message}`;
      }
    }

    if (!data) {
      return new Response(JSON.stringify({ error: `CNPJ não encontrado. ${lastError}` }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
