// coa-densidade-parser v7 — casamento forte + company_id explicito no qc_analises.
// Divide o COA pelo marcador 'Insumo:' (estrutura real). Casa nome->item real da nota
// (via estoque_lotes). Grava densidade no item + registro de auditoria no lote.
// Body: { nf?, dry_run?, limit?, offset? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.11.0";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};
const DENS_MIN = 0.1,
  DENS_MAX = 2.0,
  MIN_SCORE = 0.6;

function norm(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function score(itemNome: string, coaNome: string): number {
  const ta = new Set(norm(itemNome).split(" ").filter((w) => w.length > 1));
  const tb = new Set(norm(coaNome).split(" ").filter((w) => w.length > 1));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / new Set([...ta, ...tb]).size;
}
function densidadeDoBloco(bloco: string): number | null {
  const ap =
    bloco.match(
      /densidade\s+aparente\s+densidade\s+aparente\s+([0-9]+[.,][0-9]+)/i,
    ) ||
    bloco.match(/densidade\s+aparente[^0-9]{0,15}([0-9]+[.,][0-9]+)/i);
  if (ap) {
    const n = parseFloat(ap[1].replace(",", "."));
    if (n >= DENS_MIN && n <= DENS_MAX) return n;
  }
  const d =
    bloco.match(/densidade\s+densidade\s+([0-9]+[.,][0-9]+)/i) ||
    bloco.match(/densidade[^0-9]{0,12}([0-9]+[.,][0-9]+)\s*g\/m?l/i);
  if (d) {
    const n = parseFloat(d[1].replace(",", "."));
    if (n >= DENS_MIN && n <= DENS_MAX) return n;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let body: any = {};
  try {
    body = await req.json();
  } catch {}
  const soNf = body.nf ?? null,
    dryRun = body.dry_run === true;
  const limit = Math.min(body.limit ?? 3, 4),
    offset = body.offset ?? 0;

  const { data: laudos } = await supabase
    .from("laudos_notas")
    .select("id, nota_entrada_id, url_laudo, nome_arquivo")
    .not("nota_entrada_id", "is", null);
  let fontes = laudos ?? [];
  if (soNf) {
    const { data: ne } = await supabase
      .from("notas_entrada")
      .select("id")
      .eq("numero", soNf)
      .maybeSingle();
    fontes = ne
      ? fontes.filter((l: any) => l.nota_entrada_id === ne.id)
      : [];
  }
  const total = fontes.length;
  fontes = fontes.slice(offset, offset + limit);

  const report: any = {
    total_laudos: total,
    offset,
    limit,
    processados: 0,
    blocos_insumo: 0,
    densidades_extraidas: 0,
    itens_casados: 0,
    gravados: 0,
    qc_gravados: 0,
    escaneados: 0,
    erros: 0,
    proximo_offset: offset + limit,
    tem_mais: offset + limit < total,
    matches: [] as any[],
    rejeitados: [] as any[],
  };

  for (const l of fontes) {
    report.processados++;
    try {
      const { data: nei } = await supabase
        .from("notas_entrada_itens")
        .select("id")
        .eq("nota_entrada_id", l.nota_entrada_id);
      const alvos: any[] = [];
      for (const ni of nei ?? []) {
        const { data: el } = await supabase
          .from("estoque_lotes")
          .select("id, item_id, numero_lote")
          .eq("nota_entrada_item_id", ni.id)
          .limit(1)
          .maybeSingle();
        if (el) {
          const { data: it } = await supabase
            .from("itens")
            .select("id, descricao_interna, densidade_aparente, company_id")
            .eq("id", el.item_id)
            .maybeSingle();
          if (it)
            alvos.push({
              item_id: it.id,
              nome: it.descricao_interna,
              company_id: it.company_id,
              lote_id: el.id,
              numero_lote: el.numero_lote,
              densidade_atual: it.densidade_aparente,
            });
        }
      }

      const { data: notaRow } = await supabase
        .from("notas_entrada")
        .select("company_id")
        .eq("id", l.nota_entrada_id)
        .maybeSingle();
      const companyId =
        notaRow?.company_id || alvos[0]?.company_id || null;

      const path = (
        l.url_laudo ||
        (l.nome_arquivo && companyId
          ? `${companyId}/${l.nome_arquivo}`
          : l.nome_arquivo || "")
      ).replace(/^.*erp-files\//, "");
      if (!path) {
        report.erros++;
        continue;
      }
      const { data: blob, error } = await supabase.storage
        .from("erp-files")
        .download(path);
      if (error || !blob) {
        report.erros++;
        continue;
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      let texto = "";
      try {
        const pdf = await getDocumentProxy(buf);
        const r = await extractText(pdf, { mergePages: true });
        texto = Array.isArray(r.text) ? r.text.join(" ") : (r.text ?? "");
      } catch {
        texto = "";
      }
      if (!texto || texto.trim().length < 20) {
        report.escaneados++;
        continue;
      }
      const t = texto.replace(/\s+/g, " ");

      const re = /Insumo:\s*(.+?)\s*C[oó]digo:/gi;
      const marcadores: { nome: string; pos: number }[] = [];
      let m: RegExpExecArray | null;
      while ((m = re.exec(t)) !== null)
        marcadores.push({ nome: m[1].trim(), pos: m.index });
      report.blocos_insumo += marcadores.length;

      const jaGravado = new Set<string>();
      for (let i = 0; i < marcadores.length; i++) {
        const ini = marcadores[i].pos,
          fim = i + 1 < marcadores.length ? marcadores[i + 1].pos : t.length;
        const dens = densidadeDoBloco(t.slice(ini, fim));
        if (dens == null) continue;
        report.densidades_extraidas++;
        let melhor: any = null,
          best = 0;
        for (const a of alvos) {
          const s = score(a.nome, marcadores[i].nome);
          if (s > best) {
            best = s;
            melhor = a;
          }
        }
        if (melhor && best >= MIN_SCORE && !jaGravado.has(melhor.item_id)) {
          report.itens_casados++;
          jaGravado.add(melhor.item_id);
          report.matches.push({
            coa_nome: marcadores[i].nome,
            item: melhor.nome,
            densidade: dens,
            score: +best.toFixed(2),
            lote: melhor.numero_lote,
          });
          if (!dryRun) {
            if (melhor.lote_id && melhor.company_id) {
              const { error: qErr } = await supabase.from("qc_analises").insert({
                company_id: melhor.company_id,
                lote_id: melhor.lote_id,
                item_id: melhor.item_id,
                tipo_analise: "COA_DENSIDADE",
                parametro: "Densidade aparente",
                resultado: `${dens} g/mL`,
                especificacao: "densidade_aparente",
                status: "EXTRAIDO_COA",
                data_analise: new Date().toISOString(),
                observacoes: `COA nota, Insumo:'${marcadores[i].nome}' score ${best.toFixed(2)}.`,
              });
              if (!qErr) report.qc_gravados++;
            }
            if (melhor.densidade_atual == null || melhor.densidade_atual === 0) {
              await supabase
                .from("itens")
                .update({ densidade_aparente: dens })
                .eq("id", melhor.item_id);
              report.gravados++;
              melhor.densidade_atual = dens;
            }
          }
        } else if (best < MIN_SCORE) {
          report.rejeitados.push({
            coa_nome: marcadores[i].nome,
            densidade: dens,
            melhor_item: melhor?.nome,
            score: +best.toFixed(2),
          });
        }
      }
    } catch (e) {
      report.erros++;
      report.matches.push({ erro: String(e) });
    }
  }
  return new Response(JSON.stringify(report, null, 2), {
    headers: { ...CORS, "Content-Type": "application/json" },
  });
});
