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

    // Primário: Google Gemini direto (OpenAI-compatible endpoint)
    if (geminiKey) {
      resp = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${geminiKey}`,
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: system },
            ...messages,
          ],
          max_tokens: 1024,
        }),
      });
      parseContent = (data) => data.choices?.[0]?.message?.content ?? "";
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