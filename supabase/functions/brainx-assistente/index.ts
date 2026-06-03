// BrainX Assistente — Edge function usando Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { system, messages } = await req.json();
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!lovableKey && !anthropicKey) {
      console.error("[brainx-assistente] Nenhuma chave de IA configurada");
      return new Response(
        JSON.stringify({ error: "Nenhuma chave de IA configurada. Configure LOVABLE_API_KEY ou ANTHROPIC_API_KEY nos secrets." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let resp: Response;
    let parseContent: (data: any) => string;

    if (lovableKey) {
      resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${lovableKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: system },
            ...messages,
          ],
        }),
      });
      parseContent = (data) => data.choices?.[0]?.message?.content ?? "";
    } else {
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
        return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }), {
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