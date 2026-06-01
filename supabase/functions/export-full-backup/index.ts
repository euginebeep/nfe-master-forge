import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import JSZip from "https://esm.sh/jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Tabelas multi-tenant (filtradas por company_id)
const TENANT_TABLES = [
  "alertas_executivos","ambiental_config","ambiental_sensores","anomalias_operacionais",
  "anvisa_search_log","arquivos","audit_log","audit_trail_imutavel","chat_messages",
  "config_capacidade_producao","config_custos_producao","contas_pagar","contas_receber",
  "contratos_templates","crm_interacoes","entidades","estoque_lotes","estoque_movimentacoes",
  "expedicao_romaneio","formulas","itens","kpis_executivos","log_validacoes_anvisa",
  "notas_entrada","notas_entrada_itens","notas_saida","oportunidades","orcamentos",
  "ordens_producao_industrial","pedido_vendedor_itens","pedidos_venda","pedidos_vendedor",
  "previsoes_producao","profiles","qc_analises","qc_calibracoes","qc_desvios",
  "regras_anvisa","responsaveis_tecnicos","sensor_readings","simulacoes_producao",
  "sugestoes_otimizacao","trilha_auditoria_tecnica","vendedor_tabela_precos",
  "vendedores_externos","versoes_parametros_industriais",
];

// Buckets de Storage cujos arquivos serão incluídos
const STORAGE_BUCKETS = ["erp-files", "avatars"];

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
  return `${head}\n${body}\n`;
}

async function listAllFiles(
  admin: ReturnType<typeof createClient>,
  bucket: string,
  prefix: string,
): Promise<string[]> {
  const out: string[] = [];
  const stack: string[] = [prefix];
  while (stack.length) {
    const dir = stack.pop()!;
    const { data, error } = await admin.storage.from(bucket).list(dir, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error || !data) continue;
    for (const f of data) {
      const full = dir ? `${dir}/${f.name}` : f.name;
      // Folders have no id / no metadata
      if (!f.id && !f.metadata) {
        stack.push(full);
      } else {
        out.push(full);
      }
    }
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Resolve usuário e empresa
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u?.user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Apenas admin pode exportar backup completo
    const { data: roleRow } = await admin
      .from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem exportar o backup." }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await admin
      .from("profiles").select("company_id").eq("id", u.user.id).maybeSingle();
    const companyId = profile?.company_id as string | undefined;
    if (!companyId) {
      return new Response(JSON.stringify({ error: "Empresa não vinculada ao usuário." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const zip = new JSZip();
    const summary: Record<string, number | string> = {};

    // 1) Empresa (linha única)
    const { data: company } = await admin
      .from("company").select("*").eq("id", companyId).maybeSingle();
    if (company) {
      // Não exportar senha SMTP cifrada
      const safe = { ...company } as Record<string, unknown>;
      delete safe["smtp_pass_ciphertext"];
      delete safe["smtp_pass_encrypted"];
      zip.file("tables/company.csv", toCSV([safe]));
      zip.file("tables/company.json", JSON.stringify(safe, null, 2));
      summary["company"] = 1;
    }

    // 2) Tabelas multi-tenant
    for (const t of TENANT_TABLES) {
      try {
        const { data, error } = await admin.from(t).select("*").eq("company_id", companyId);
        if (error) {
          summary[t] = `erro: ${error.message}`;
          continue;
        }
        const rows = (data || []) as Record<string, unknown>[];
        zip.file(`tables/${t}.csv`, toCSV(rows));
        zip.file(`tables/${t}.json`, JSON.stringify(rows, null, 2));
        summary[t] = rows.length;
      } catch (e) {
        summary[t] = `falha: ${e instanceof Error ? e.message : "?"}`;
      }
    }

    // 3) XMLs das notas fiscais (xml_raw)
    try {
      const { data: nfes } = await admin
        .from("notas_entrada")
        .select("id, chave_acesso, numero, xml_raw")
        .eq("company_id", companyId);
      let xmlCount = 0;
      for (const n of (nfes || []) as Array<Record<string, unknown>>) {
        const xml = (n.xml_raw as string | null) || "";
        if (!xml) continue;
        const name = (n.chave_acesso as string) || (n.id as string);
        zip.file(`nfe-xmls/${name}.xml`, xml);
        xmlCount++;
      }
      summary["nfe_xmls"] = xmlCount;
    } catch (e) {
      summary["nfe_xmls"] = `falha: ${e instanceof Error ? e.message : "?"}`;
    }

    // 4) Arquivos do Storage (escopo da empresa)
    for (const bucket of STORAGE_BUCKETS) {
      try {
        // Convenção do projeto: arquivos ficam em <bucket>/<company_id>/...
        const paths = await listAllFiles(admin, bucket, companyId);
        let count = 0;
        for (const p of paths) {
          const { data: blob, error } = await admin.storage.from(bucket).download(p);
          if (error || !blob) continue;
          const buf = new Uint8Array(await blob.arrayBuffer());
          zip.file(`storage/${bucket}/${p}`, buf);
          count++;
        }
        summary[`storage:${bucket}`] = count;
      } catch (e) {
        summary[`storage:${bucket}`] = `falha: ${e instanceof Error ? e.message : "?"}`;
      }
    }

    // 5) Manifesto
    const manifest = {
      generated_at: new Date().toISOString(),
      company_id: companyId,
      generated_by: u.user.email,
      tables: summary,
      notes: [
        "CSV e JSON por tabela em /tables.",
        "XMLs originais de NF-e em /nfe-xmls.",
        "Arquivos de storage em /storage/<bucket>/<company_id>/...",
        "Senha SMTP cifrada foi intencionalmente removida do export.",
      ],
    };
    zip.file("MANIFEST.json", JSON.stringify(manifest, null, 2));

    const blob: Uint8Array = await zip.generateAsync({
      type: "uint8array",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    });

    const filename = `backup-${companyId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.zip`;

    return new Response(blob, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido";
    console.error("[export-full-backup] internal error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});