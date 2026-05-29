import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { op_id, company_id } = await req.json();
    if (!op_id) {
      return new Response(JSON.stringify({ error: "op_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let effectiveCompanyId = company_id as string | null;
    if (!effectiveCompanyId) {
      const { data: op } = await supabase
        .from("ordens_producao_industrial")
        .select("company_id")
        .eq("id", op_id)
        .maybeSingle();
      effectiveCompanyId = op?.company_id ?? null;
    }

    const { data: itens } = await supabase
      .from("pedido_vendedor_itens")
      .select("id, pedido_id")
      .eq("op_id", op_id);

    if (!itens?.length) {
      return new Response(JSON.stringify({ ok: true, linked: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("pedido_vendedor_itens")
      .update({ status_item: "PRONTO" })
      .eq("op_id", op_id);

    const pedidoId = itens[0].pedido_id;

    const { data: todosItens } = await supabase
      .from("pedido_vendedor_itens")
      .select("status_item")
      .eq("pedido_id", pedidoId);

    const todosProntos =
      todosItens?.every(
        (i: any) => i.status_item === "PRONTO" || i.status_item === "RESERVADO"
      ) ?? false;

    if (todosProntos) {
      await supabase
        .from("pedidos_vendedor")
        .update({ status: "PRONTO", updated_at: new Date().toISOString() })
        .eq("id", pedidoId);

      if (effectiveCompanyId) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", effectiveCompanyId);

        if (profs?.length) {
          await supabase.from("notifications").insert(
            profs.map((p: any) => ({
              user_id: p.id,
              title: "Pedido pronto para expedição",
              message:
                "Pedido vinculado à OP foi concluído e está pronto para separação.",
              type: "info",
              module: "Expedição",
              link: "/expedicao",
            }))
          );
        }
      }
    }

    return new Response(
      JSON.stringify({ ok: true, pedido_pronto: todosProntos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});