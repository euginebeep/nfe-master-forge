// BrainX ERP Assistente — Edge function usando Google Gemini (primário) + Anthropic (fallback)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { system, messages } = await req.json();
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!geminiKey && !anthropicKey) {
      console.error("[brainx-assistente] Nenhuma chave de IA configurada");
      return new Response(
        JSON.stringify({ error: "Nenhuma chave de IA configurada. Configure GEMINI_API_KEY ou ANTHROPIC_API_KEY nos secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let resp: Response;
    let parseContent: (data: any) => string;

    // Primário: Google Gemini direto (endpoint nativo generateContent)
    if (geminiKey) {
      // Converter histórico de mensagens OpenAI-style para formato Gemini nativo
      const geminiContents = messages.map((m: any) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }))
      resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: system }] },
            contents: geminiContents,
            generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
          }),
        }
      );
      parseContent = (data) => data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } else {
      // Fallback: Anthropic Claude direto
      resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": anthropicKey!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system,
          messages,
        }),
      });
      parseContent = (data) => data.content?.[0]?.text ?? "";
    }

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("[brainx-assistente] Provider respondeu com erro", {
        status: resp.status,
        statusText: resp.statusText,
        body: errText?.slice(0, 2000),
      });
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos na conta." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: `Provider ${resp.status}: ${errText || resp.statusText}` }), {
        status: resp.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    const content = parseContent(data);
    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    console.error("[brainx-assistente] Exceção não tratada:", msg, e instanceof Error ? e.stack : undefined);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});