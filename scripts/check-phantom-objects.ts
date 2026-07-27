/**
 * Varredura de objetos fantasma: tabelas (.from) e RPCs (.rpc) usadas em src/
 * vs. schema tipado em src/integrations/supabase/types.ts.
 *
 * Uso:
 *   npx tsx scripts/check-phantom-objects.ts
 *
 * Se DATABASE_URL estiver definido, também compara com information_schema /
 * pg_proc (defesa completa). Sem DB, usa types.ts como proxy do schema.
 *
 * Exit 1 se houver referência sem objeto correspondente.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname ?? __dirname, '..');
const SRC = join(ROOT, 'src');
const TYPES = join(SRC, 'integrations/supabase/types.ts');

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(p);
  }
  return acc;
}

function extractRefs(files: string[]) {
  const tables = new Set<string>();
  const rpcs = new Set<string>();
  const fromRe = /\.from\(\s*['"`]([^'"`]+)['"`]/g;
  const rpcRe = /\.rpc\(\s*['"`]([^'"`]+)['"`]/g;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    fromRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = fromRe.exec(text))) {
      const name = m[1];
      if (!name || name.includes('${')) continue;
      tables.add(name);
    }
    rpcRe.lastIndex = 0;
    while ((m = rpcRe.exec(text))) {
      if (m[1] && !m[1].includes('${')) rpcs.add(m[1]);
    }
  }
  return { tables, rpcs };
}

/** Extrai chaves de primeiro nível dentro de um bloco `Nome: { ... }` do Database public. */
function extractTopLevelKeys(block: string): Set<string> {
  const keys = new Set<string>();
  // Indentação típica do supabase gen: 6 espaços + nome + :
  // Aceita tanto `foo: {` quanto overloads `foo:\n        | {`.
  for (const m of block.matchAll(/^\s{6}([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)) {
    keys.add(m[1]);
  }
  return keys;
}

function extractTypesSchema(typesPath: string) {
  const text = readFileSync(typesPath, 'utf8');

  // Pegar o bloco public real (o maior), não o stub inicial vazio
  const publicMatch = text.match(/public:\s*\{([\s\S]*)\n\s*\}\s*\n\s*\}/);
  const scope = publicMatch?.[1] ?? text;

  const tablesIdx = [...scope.matchAll(/^\s{4}Tables:\s*\{/gm)].map((m) => m.index!);
  const viewsIdx = [...scope.matchAll(/^\s{4}Views:\s*\{/gm)].map((m) => m.index!);
  const fnIdx = [...scope.matchAll(/^\s{4}Functions:\s*\{/gm)].map((m) => m.index!);
  const enumsIdx = [...scope.matchAll(/^\s{4}Enums:\s*\{/gm)].map((m) => m.index!);

  const sliceBetween = (start: number, endMarkers: number[]) => {
    const end = endMarkers.find((i) => i > start) ?? scope.length;
    return scope.slice(start, end);
  };

  const tablesStart = tablesIdx[tablesIdx.length - 1] ?? -1;
  const viewsStart = viewsIdx[viewsIdx.length - 1] ?? -1;
  const functionsStart = fnIdx[fnIdx.length - 1] ?? -1;
  const enumsStart = enumsIdx[enumsIdx.length - 1] ?? scope.length;

  const tables =
    tablesStart >= 0
      ? extractTopLevelKeys(sliceBetween(tablesStart, [viewsStart, functionsStart, enumsStart]))
      : new Set<string>();
  const views =
    viewsStart >= 0
      ? extractTopLevelKeys(sliceBetween(viewsStart, [functionsStart, enumsStart]))
      : new Set<string>();
  const functions =
    functionsStart >= 0
      ? extractTopLevelKeys(sliceBetween(functionsStart, [enumsStart]))
      : new Set<string>();

  return { tables, views, functions };
}

async function loadDbObjects(): Promise<{ tables: Set<string>; functions: Set<string> } | null> {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    const { default: pg } = await import('pg');
    const client = new pg.Client({
      connectionString: url,
      // Pooler Supabase apresenta cadeia self-signed; sem isso o Gate 1 aborta
      // mesmo com DATABASE_URL válido.
      ssl: { rejectUnauthorized: false },
    });
    await client.connect();
    const tablesRes = await client.query(
      `select table_name from information_schema.tables
       where table_schema = 'public' and table_type in ('BASE TABLE','VIEW')`,
    );
    const fnRes = await client.query(
      `select distinct p.proname
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'`,
    );
    await client.end();
    return {
      tables: new Set(tablesRes.rows.map((r: { table_name: string }) => r.table_name)),
      functions: new Set(fnRes.rows.map((r: { proname: string }) => r.proname)),
    };
  } catch (e) {
    console.error('[check-phantom-objects] DATABASE_URL definido mas a consulta falhou:', e);
    console.error('O Gate 1 ficaria cego validando apenas contra types.ts. Abortando.');
    process.exit(1);
  }
}

async function main() {
  const files = walk(SRC);
  const refs = extractRefs(files);
  const typed = extractTypesSchema(TYPES);
  const db = await loadDbObjects();

  const knownTables = new Set([
    ...typed.tables,
    ...typed.views,
    ...(db?.tables ?? []),
  ]);
  const knownFns = new Set([...typed.functions, ...(db?.functions ?? [])]);

  const allowlistPath = join(ROOT, 'scripts/phantom-allowlist.json');
  let allowTables = new Set<string>();
  let allowRpcs = new Set<string>();
  try {
    const al = JSON.parse(readFileSync(allowlistPath, 'utf8')) as {
      tables?: string[];
      views?: string[];
      rpcs?: string[];
    };
    allowTables = new Set([...(al.tables ?? []), ...(al.views ?? [])]);
    allowRpcs = new Set(al.rpcs ?? []);
  } catch {
    /* sem allowlist */
  }

  // Storage buckets / aliases que não são tabelas public
  const ignoreTables = new Set([
    'erp-files',
    'avatars',
    'anvisa-laudo-logos',
    'brainx-parceiros',
  ]);

  const phantomTables = [...refs.tables]
    .filter(
      (t) =>
        !ignoreTables.has(t) &&
        !allowTables.has(t) &&
        !knownTables.has(t),
    )
    .sort();
  const phantomRpcs = [...refs.rpcs]
    .filter((r) => !allowRpcs.has(r) && !knownFns.has(r))
    .sort();

  console.log(`Arquivos varridos: ${files.length}`);
  console.log(`Tabelas/views referenciadas: ${refs.tables.size}`);
  console.log(`RPCs referenciadas: ${refs.rpcs.size}`);
  console.log(
    `Schema tipado: ${typed.tables.size} tables, ${typed.views.size} views, ${typed.functions.size} functions`,
  );
  console.log(`Fonte schema: ${db ? 'types.ts + BANCO REAL' : 'types.ts APENAS (sem DATABASE_URL)'}`);

  let failed = false;
  if (phantomTables.length) {
    failed = true;
    console.error('\nTabelas/views fantasma (referenciadas em src/, ausentes do schema):');
    for (const t of phantomTables) console.error(`  - ${t}`);
  }
  if (phantomRpcs.length) {
    failed = true;
    console.error('\nRPCs fantasma (referenciadas em src/, ausentes do schema):');
    for (const r of phantomRpcs) console.error(`  - ${r}`);
  }

  if (failed) {
    console.error('\nFalha: objetos fantasma detectados.');
    process.exit(1);
  }
  console.log('\nOK: nenhuma referência fantasma detectada.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
