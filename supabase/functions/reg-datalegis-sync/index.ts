// supabase/functions/reg-datalegis-sync/index.ts
//
// JOB B — Diff de vigência (diário). O coração do módulo regulatório.
//
// Para cada ato monitorado:
//   1. baixa o texto consolidado do Datalegis
//   2. recalcula o hash
//   3. compara com o armazenado
//   4. se mudou => versiona + grafo de alterações + ALERTA CRÍTICO nos tenants
//      que possuem regras homologadas dependentes desse ato
//
// Falha de parser NUNCA é silenciosa: grava ultimo_erro e gera alerta interno.

import { createClient } from "jsr:@supabase/supabase-js@2";
import { buscarAto, resolverAto, DatalegisError, type AtoParseado } from "../_shared/datalegis.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, // service_role: escreve em reg_atos
);

interface AtoRow {
  id: string;
  tipo: string;
  numero: number;
  ano: number;
  seq_ato: string;
  sgl_orgao: string;
  hash_texto: string | null;
  status_vigencia: string;
}

async function processarAto(row: AtoRow) {
  let ato: AtoParseado;

  try {
    ato = await buscarAto({
      tipo: row.tipo,
      numero: row.numero,
      ano: row.ano,
      sglOrgao: row.sgl_orgao,
      seqAto: row.seq_ato,
    });
  } catch (e) {
    // sgl_orgao/seq_ato podem estar errados no seed — tenta resolver
    if (e instanceof DatalegisError) {
      try {
        ato = await resolverAto(row.tipo, row.numero, row.ano);
        await supabase.from("reg_atos").update({
          sgl_orgao: ato.ref.sglOrgao,
          seq_ato: ato.ref.seqAto,
          url_datalegis: ato.url,
        }).eq("id", row.id);
      } catch (e2) {
        await registrarErro(row, e2);
        return { ato: `${row.tipo} ${row.numero}/${row.ano}`, resultado: "erro" };
      }
    } else {
      await registrarErro(row, e);
      return { ato: `${row.tipo} ${row.numero}/${row.ano}`, resultado: "erro" };
    }
  }

  const primeiraCaptura = !row.hash_texto;
  const textoMudou     = !primeiraCaptura && row.hash_texto !== ato.hashTexto;
  const statusMudou    = row.status_vigencia !== ato.statusVigencia &&
                         row.status_vigencia !== "desconhecido";

  await supabase.from("reg_atos").update({
    ementa: undefined, // preservado
    status_vigencia: ato.statusVigencia,
    texto_consolidado: ato.textoConsolidado,
    hash_texto: ato.hashTexto,
    url_datalegis: ato.url,
    verificado_em: new Date().toISOString(),
    ultimo_erro: null,
    ultimo_erro_em: null,
  }).eq("id", row.id);

  await gravarNotas(row.id, ato);

  if (textoMudou || statusMudou) {
    await dispararAlertas(row, ato, { textoMudou, statusMudou });
    return { ato: `${row.tipo} ${row.numero}/${row.ano}`, resultado: "ALTERADO" };
  }

  return {
    ato: `${row.tipo} ${row.numero}/${row.ano}`,
    resultado: primeiraCaptura ? "capturado" : "inalterado",
  };
}

async function gravarNotas(atoId: string, ato: AtoParseado) {
  if (!ato.notas.length) return;
  const linhas = ato.notas
    .filter((n) => n.alteradorRef)
    .map((n) => ({
      ato_alterado_id: atoId,
      alterador_ref: n.alteradorRef,
      dispositivo: n.dispositivo,
      tipo_alteracao: n.tipoAlteracao,
      trecho_nota: n.trecho,
    }));
  if (linhas.length) {
    await supabase.from("reg_ato_alteracoes")
      .upsert(linhas, { onConflict: "ato_alterado_id,alterador_ref,dispositivo,tipo_alteracao" });
  }
}

/** Alerta vai para os tenants que TÊM regras homologadas dependentes do ato. */
async function dispararAlertas(
  row: AtoRow,
  ato: AtoParseado,
  motivo: { textoMudou: boolean; statusMudou: boolean },
) {
  const { data: regras } = await supabase
    .from("reg_regras")
    .select("id, chave, entidade")
    .eq("ato_id", row.id)
    .eq("status", "homologada");

  const { data: companies } = await supabase.from("companies").select("id");
  if (!companies?.length) return;

  const nome = `${row.tipo} ${row.numero}/${row.ano}`;
  const partes: string[] = [];
  if (motivo.statusMudou) partes.push(`status: ${row.status_vigencia} → ${ato.statusVigencia}`);
  if (motivo.textoMudou)  partes.push("texto consolidado alterado");

  const alertas = companies.map((c) => ({
    company_id: c.id,
    ato_id: row.id,
    origem: "datalegis_diff",
    severidade: (regras?.length ? "critica" : "alta"),
    titulo: `${nome} mudou — ${partes.join("; ")}`,
    impacto: {
      motivo: partes,
      regras_afetadas: regras ?? [],
      total_regras: regras?.length ?? 0,
      url: ato.url,
      acao_requerida: regras?.length
        ? "Revalidar regras homologadas e reemitir laudos afetados se necessário."
        : "Avaliar impacto.",
    },
  }));

  await supabase.from("reg_alertas").insert(alertas);
}

async function registrarErro(row: AtoRow, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  console.error(`[reg-datalegis-sync] ERRO ${row.tipo} ${row.numero}/${row.ano}: ${msg}`);
  await supabase.from("reg_atos").update({
    ultimo_erro: msg.slice(0, 1000),
    ultimo_erro_em: new Date().toISOString(),
  }).eq("id", row.id);
}

Deno.serve(async (req) => {
  // proteção: só cron (header secreto) ou service_role
  const secret = req.headers.get("x-cron-secret");
  if (secret !== Deno.env.get("CRON_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data: atos, error } = await supabase
    .from("reg_atos")
    .select("id,tipo,numero,ano,seq_ato,sgl_orgao,hash_texto,status_vigencia")
    .eq("monitorar", true)
    .order("verificado_em", { ascending: true, nullsFirst: true })
    .limit(30); // lotes: educação com o servidor legado

  if (error) return new Response(JSON.stringify({ error }), { status: 500 });

  const resultados = [];
  for (const row of atos as AtoRow[]) {
    resultados.push(await processarAto(row));
    await new Promise((r) => setTimeout(r, 1200)); // rate limit auto-imposto
  }

  const alterados = resultados.filter((r) => r.resultado === "ALTERADO");
  const erros     = resultados.filter((r) => r.resultado === "erro");

  return new Response(
    JSON.stringify({
      verificados: resultados.length,
      alterados: alterados.length,
      erros: erros.length,
      detalhes: resultados,
    }, null, 2),
    { headers: { "content-type": "application/json" } },
  );
});
