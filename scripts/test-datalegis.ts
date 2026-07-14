// scripts/test-datalegis.ts
//
// GATE DO PR1 — rode ANTES de mergear:
//     deno run --allow-net --allow-env scripts/test-datalegis.ts
//
// Não consigo executar isto no ambiente onde o código foi escrito (rede
// bloqueada para datalegis.net). Este script é a validação real.

import { buscarAto, resolverAto, montarUrl } from "../supabase/functions/_shared/datalegis.ts";

let falhas = 0;
const ok  = (m: string) => console.log(`  ✅ ${m}`);
const bad = (m: string) => { console.error(`  ❌ ${m}`); falhas++; };

// ---------------------------------------------------------------------------
console.log("\n[1] URL canônica");
const url = montarUrl({ tipo: "RDC", numero: 843, ano: 2024, sglOrgao: "RDC/DC/ANVISA/MS" });
url.includes("num_ato=00000843") ? ok("zero-pad 8 dígitos") : bad(`zero-pad falhou: ${url}`);

// ---------------------------------------------------------------------------
console.log("\n[2] RDC 843/2024 — caso de referência (verificado manualmente em 13/07/2026)");
const rdc843 = await buscarAto({
  tipo: "RDC", numero: 843, ano: 2024, sglOrgao: "RDC/DC/ANVISA/MS", seqAto: "000",
});

rdc843.titulo.includes("843")
  ? ok(`título: ${rdc843.titulo}`)
  : bad(`título inesperado: ${rdc843.titulo}`);

// Acentuação: o teste do charset. Se falhar aqui, o hash é lixo.
/regularização/i.test(rdc843.textoConsolidado)
  ? ok("charset ISO-8859-1 → UTF-8 correto (acentos íntegros)")
  : bad("MOJIBAKE — transcode quebrado");

rdc843.statusVigencia === "vigente_com_alteracoes"
  ? ok(`status: ${rdc843.statusVigencia}`)
  : bad(`status esperado 'vigente_com_alteracoes', veio '${rdc843.statusVigencia}'`);

rdc843.hashTexto.length === 64
  ? ok(`hash: ${rdc843.hashTexto.slice(0, 16)}…`)
  : bad("hash inválido");

// ---------------------------------------------------------------------------
console.log("\n[3] Grafo de alterações — a RDC 990/2025 TEM que aparecer");
// Fato verificado: art. 32 da RDC 843/2024 tem redação dada pela RDC 990/2025.
// Se o parser não achar isso, ele não serve para o que foi feito.
const nota990 = rdc843.notas.find((n) => n.alteradorRef === "RDC 990/2025");
nota990
  ? ok(`RDC 990/2025 detectada — dispositivo: ${nota990.dispositivo} (${nota990.tipoAlteracao})`)
  : bad("RDC 990/2025 NÃO detectada — extrairNotas() precisa de ajuste");

nota990?.dispositivo?.includes("32")
  ? ok("dispositivo correto (Art. 32)")
  : bad(`dispositivo esperado 'Art. 32', veio '${nota990?.dispositivo}'`);

console.log(`  ℹ️  total de notas: ${rdc843.notas.length}`);
console.log(`  ℹ️  referências (LinkTexto): ${rdc843.referencias.length}`);

// ---------------------------------------------------------------------------
console.log("\n[4] Determinismo do hash (2ª leitura tem que bater)");
const segunda = await buscarAto({
  tipo: "RDC", numero: 843, ano: 2024, sglOrgao: "RDC/DC/ANVISA/MS", seqAto: "000",
});
segunda.hashTexto === rdc843.hashTexto
  ? ok("hash estável — sem falso positivo de alteração")
  : bad("HASH INSTÁVEL: normalizarParaHash() deixou passar ruído. Isso geraria alerta falso todo dia.");

// ---------------------------------------------------------------------------
console.log("\n[5] Resolver — IN 28/2018 (sgl_orgao/seq_ato desconhecidos)");
try {
  const in28 = await resolverAto("IN", 28, 2018);
  ok(`resolvido: sgl_orgao='${in28.ref.sglOrgao}' seq_ato='${in28.ref.seqAto}' status=${in28.statusVigencia}`);
  console.log(`  → grave estes valores no seed da migration.`);
} catch (e) {
  bad(`resolver falhou: ${(e as Error).message}`);
  console.log("  → amplie ORGAOS_CANDIDATOS em datalegis.ts com o valor real do site.");
}

// ---------------------------------------------------------------------------
console.log(`\n${falhas === 0 ? "✅ PR1 liberado para merge." : `❌ ${falhas} falha(s). NÃO mergear.`}\n`);
Deno.exit(falhas === 0 ? 0 : 1);
