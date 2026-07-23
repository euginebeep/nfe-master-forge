import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

/**
 * Backfill: notas com xml_raw no banco mas ausentes no storage.
 * Lê v_notas_sem_xml (xml_no_banco = true) e faz upload real em
 * erp-files / nfe-xmls/{company_id}/{chave_nfe}.xml
 *
 * NÃO inserir linha em storage.objects por SQL — os bytes precisam existir no S3.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await supabaseUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pendentes, error: viewErr } = await admin
      .from("v_notas_sem_xml")
      .select("id, company_id, chave_nfe, numero, xml_no_banco, xml_no_storage, acao")
      .eq("xml_no_banco", true);

    if (viewErr) {
      return new Response(
        JSON.stringify({ error: `Falha ao ler v_notas_sem_xml: ${viewErr.message}` }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const rows = (pendentes ?? []).filter((r: any) => r.chave_nfe && r.company_id);
    let ok = 0;
    let falhas = 0;
    const detalhes: { id: string; numero: string | null; status: string; erro?: string }[] = [];

    for (const row of rows) {
      const chave = String(row.chave_nfe).replace(/\D/g, "");
      if (chave.length !== 44) {
        falhas++;
        detalhes.push({
          id: row.id,
          numero: row.numero,
          status: "erro",
          erro: "chave inválida",
        });
        continue;
      }

      const { data: nota, error: notaErr } = await admin
        .from("notas_entrada")
        .select("id, xml_raw")
        .eq("id", row.id)
        .maybeSingle();

      if (notaErr || !nota?.xml_raw) {
        falhas++;
        detalhes.push({
          id: row.id,
          numero: row.numero,
          status: "erro",
          erro: notaErr?.message || "xml_raw ausente",
        });
        continue;
      }

      const path = `nfe-xmls/${row.company_id}/${chave}.xml`;
      const { error: upErr } = await admin.storage
        .from("erp-files")
        .upload(path, new Blob([nota.xml_raw], { type: "application/xml" }), {
          contentType: "application/xml",
          upsert: true,
        });

      if (upErr) {
        falhas++;
        detalhes.push({
          id: row.id,
          numero: row.numero,
          status: "erro",
          erro: upErr.message,
        });
        continue;
      }

      ok++;
      detalhes.push({ id: row.id, numero: row.numero, status: "ok" });
    }

    const { data: aindaFaltam, error: recountErr } = await admin
      .from("v_notas_sem_xml")
      .select("id, xml_no_banco, acao");

    const recuperaveis =
      (aindaFaltam ?? []).filter(
        (r: any) => r.xml_no_banco === true || String(r.acao || "").startsWith("RECUPERAVEL"),
      ).length;
    const perdidos =
      (aindaFaltam ?? []).filter((r: any) => String(r.acao || "").startsWith("PERDIDO")).length;

    return new Response(
      JSON.stringify({
        processados: rows.length,
        ok,
        falhas,
        ainda_na_view: aindaFaltam?.length ?? null,
        recuperaveis_restantes: recuperaveis,
        perdidos_restantes: perdidos,
        recount_error: recountErr?.message ?? null,
        detalhes,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
