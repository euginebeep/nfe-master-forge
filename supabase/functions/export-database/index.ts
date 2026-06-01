// Edge Function: export-database
// Exporta schema, dados (paginado) e metadados de storage do projeto de origem
// usando exclusivamente secrets INTERNOS já disponíveis no runtime:
//   - SUPABASE_DB_URL
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//
// Autenticação: exige JWT válido + papel 'admin' (public.has_role).
//
// Modos (query param ?mode=...):
//   manifest        -> lista de tabelas com row counts + buckets de storage
//   schema          -> DDL (CREATE TABLE) das tabelas públicas
//   table&name=X    -> dados de uma tabela em JSON (paginado: &offset=0&limit=1000)
//   storage-list    -> todos os objetos de todos os buckets (metadados + signed URL)
//   storage-urls&bucket=B -> signed URLs (1h) para baixar binários sem service_role

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { Client as PgClient } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function assertAdmin(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) throw new Response("Missing JWT", { status: 401 });
  const token = auth.slice(7);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const supa = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: user, error } = await supa.auth.getUser();
  if (error || !user?.user) throw new Response("Invalid JWT", { status: 401 });

  const { data: isAdmin, error: rErr } = await supa.rpc("has_role", {
    _user_id: user.user.id,
    _role: "admin",
  });
  if (rErr || !isAdmin) throw new Response("Admin only", { status: 403 });

  return user.user;
}

async function withPg<T>(fn: (c: PgClient) => Promise<T>): Promise<T> {
  const c = new PgClient(Deno.env.get("SUPABASE_DB_URL")!);
  await c.connect();
  try {
    return await fn(c);
  } finally {
    await c.end();
  }
}

// ---------- modes ----------

async function modeManifest() {
  const tables = await withPg(async (c) => {
    const res = await c.queryObject<{ schemaname: string; relname: string; n_live_tup: number }>(
      `SELECT schemaname, relname, n_live_tup
       FROM pg_stat_user_tables
       WHERE schemaname = 'public'
       ORDER BY n_live_tup DESC`,
    );
    return res.rows;
  });

  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const buckets = await fetch(`${url}/storage/v1/bucket`, {
    headers: { Authorization: `Bearer ${srk}`, apikey: srk },
  }).then((r) => r.json());

  return json({
    generated_at: new Date().toISOString(),
    tables,
    buckets,
    total_rows: tables.reduce((a, t) => a + Number(t.n_live_tup), 0),
  });
}

async function modeSchema() {
  // DDL via pg_dump não está disponível no runtime; reconstruímos a partir do catálogo.
  const ddl = await withPg(async (c) => {
    const tables = await c.queryObject<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema='public' AND table_type='BASE TABLE'
       ORDER BY table_name`,
    );

    const parts: string[] = [
      "-- Schema dump (reconstruído via information_schema)",
      "-- Gerado em " + new Date().toISOString(),
      "",
    ];

    for (const t of tables.rows) {
      const cols = await c.queryObject<{
        column_name: string;
        data_type: string;
        udt_name: string;
        is_nullable: string;
        column_default: string | null;
        character_maximum_length: number | null;
      }>(
        `SELECT column_name, data_type, udt_name, is_nullable, column_default, character_maximum_length
         FROM information_schema.columns
         WHERE table_schema='public' AND table_name=$1
         ORDER BY ordinal_position`,
        [t.table_name],
      );

      parts.push(`CREATE TABLE IF NOT EXISTS public.${t.table_name} (`);
      const colLines = cols.rows.map((c) => {
        const type =
          c.data_type === "USER-DEFINED" || c.data_type === "ARRAY"
            ? c.udt_name
            : c.character_maximum_length
            ? `${c.data_type}(${c.character_maximum_length})`
            : c.data_type;
        const nn = c.is_nullable === "NO" ? " NOT NULL" : "";
        const def = c.column_default ? ` DEFAULT ${c.column_default}` : "";
        return `  ${c.column_name} ${type}${nn}${def}`;
      });
      parts.push(colLines.join(",\n"));
      parts.push(");");
      parts.push("");
    }

    // Indexes
    const idx = await c.queryObject<{ indexdef: string }>(
      `SELECT indexdef FROM pg_indexes WHERE schemaname='public' ORDER BY tablename, indexname`,
    );
    parts.push("-- INDEXES");
    for (const i of idx.rows) parts.push(i.indexdef + ";");

    return parts.join("\n");
  });

  return new Response(ddl, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": 'attachment; filename="schema.sql"',
    },
  });
}

async function modeTable(name: string, offset: number, limit: number) {
  if (!/^[a-z0-9_]+$/i.test(name)) return json({ error: "invalid table name" }, 400);
  if (limit > 5000) limit = 5000;

  const rows = await withPg(async (c) => {
    const r = await c.queryObject(
      `SELECT * FROM public.${name} ORDER BY 1 OFFSET $1 LIMIT $2`,
      [offset, limit],
    );
    return r.rows;
  });

  const total = await withPg(async (c) => {
    const r = await c.queryObject<{ count: bigint }>(
      `SELECT count(*)::bigint FROM public.${name}`,
    );
    return Number(r.rows[0]?.count ?? 0);
  });

  return json({
    table: name,
    offset,
    limit,
    returned: rows.length,
    total,
    next_offset: offset + rows.length < total ? offset + rows.length : null,
    rows,
  });
}

async function listAllObjects(bucket: string) {
  // Pagina via SQL (mais confiável que API quando há muitos objetos)
  return await withPg(async (c) => {
    const r = await c.queryObject<{
      name: string;
      id: string;
      updated_at: string;
      created_at: string;
      metadata: unknown;
    }>(
      `SELECT name, id::text, updated_at::text, created_at::text, metadata
       FROM storage.objects WHERE bucket_id=$1 ORDER BY name`,
      [bucket],
    );
    return r.rows;
  });
}

async function modeStorageList() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const buckets: Array<{ id: string; name: string; public: boolean }> = await fetch(
    `${url}/storage/v1/bucket`,
    { headers: { Authorization: `Bearer ${srk}`, apikey: srk } },
  ).then((r) => r.json());

  const out: Record<string, unknown> = {};
  for (const b of buckets) {
    out[b.id] = {
      bucket: b,
      objects: await listAllObjects(b.id),
    };
  }
  return json({ generated_at: new Date().toISOString(), buckets: out });
}

async function modeStorageUrls(bucket: string) {
  if (!/^[a-z0-9_-]+$/i.test(bucket)) return json({ error: "invalid bucket" }, 400);
  const url = Deno.env.get("SUPABASE_URL")!;
  const srk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supa = createClient(url, srk);

  const objs = await listAllObjects(bucket);
  // Signed URLs em lote (1h). Limita 1000 por chamada para não estourar.
  const sliced = objs.slice(0, 1000);
  const paths = sliced.map((o) => o.name);
  const { data, error } = await supa.storage.from(bucket).createSignedUrls(paths, 3600);
  if (error) return json({ error: error.message }, 500);

  return json({
    bucket,
    total: objs.length,
    returned: sliced.length,
    note: objs.length > 1000 ? "Apenas os primeiros 1000 retornados. Repita com offset (não implementado, use storage-list para a lista completa)." : null,
    urls: data,
  });
}

// ---------- entry ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    await assertAdmin(req);
  } catch (e) {
    if (e instanceof Response) {
      return new Response(await e.text(), { status: e.status, headers: corsHeaders });
    }
    return json({ error: String(e) }, 500);
  }

  try {
    const u = new URL(req.url);
    const mode = u.searchParams.get("mode") ?? "manifest";

    switch (mode) {
      case "manifest":
        return await modeManifest();
      case "schema":
        return await modeSchema();
      case "table": {
        const name = u.searchParams.get("name");
        if (!name) return json({ error: "missing ?name=" }, 400);
        const offset = Number(u.searchParams.get("offset") ?? "0");
        const limit = Number(u.searchParams.get("limit") ?? "1000");
        return await modeTable(name, offset, limit);
      }
      case "storage-list":
        return await modeStorageList();
      case "storage-urls": {
        const bucket = u.searchParams.get("bucket");
        if (!bucket) return json({ error: "missing ?bucket=" }, 400);
        return await modeStorageUrls(bucket);
      }
      default:
        return json({ error: `unknown mode: ${mode}` }, 400);
    }
  } catch (e) {
    console.error("export-database error", e);
    return json({ error: String((e as Error).message ?? e) }, 500);
  }
});