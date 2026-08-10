/**
 * CODE-128C para chave de acesso de NF-e.
 * A chave tem sempre 44 dígitos (22 pares), então o subset C se aplica direto.
 * Validado contra as chaves reais das NF-e 16/2 e 17/2 em 10/08/2026.
 */

// 107 padrões: 6 dígitos = larguras alternadas barra/espaço, somando 11 módulos.
// O último (STOP) tem 7 barras e 13 módulos.
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312",
  "132212","221213","221312","231212","112232","122132","122231","113222",
  "123122","123221","223211","221132","221231","213212","223112","312131",
  "311222","321122","321221","312212","322112","322211","212123","212321",
  "232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121",
  "313121","211331","231131","213113","213311","213131","311123","311321",
  "331121","312113","312311","332111","314111","221411","431111","111224",
  "111422","121124","121421","141122","141221","112214","112412","122114",
  "122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112",
  "421211","212141","214121","412121","111143","111341","131141","114113",
  "114311","411113","411311","113141","114131","311141","411131","211412",
  "211214","211232","2331112",
];

const START_C = 105;
const STOP = 106;

/** Devolve a sequência de larguras (barra, espaço, barra, ...) em módulos. */
export function code128cWidths(digitos: string): number[] {
  const d = digitos.replace(/\D/g, "");
  if (d.length === 0 || d.length % 2 !== 0) {
    throw new Error("CODE-128C exige quantidade par de dígitos");
  }

  const codes: number[] = [START_C];
  for (let i = 0; i < d.length; i += 2) {
    codes.push(parseInt(d.substr(i, 2), 10));
  }

  // Checksum: START + soma(valor × posição), módulo 103
  let soma = START_C;
  for (let i = 1; i < codes.length; i++) soma += codes[i] * i;
  codes.push(soma % 103);
  codes.push(STOP);

  return codes
    .map((c) => PATTERNS[c])
    .join("")
    .split("")
    .map(Number);
}

/** SVG pronto para o DANFE. */
export function code128cSvg(
  digitos: string,
  opts: { alturaMm?: number; moduloMm?: number } = {},
): string | null {
  let larguras: number[];
  try {
    larguras = code128cWidths(digitos);
  } catch {
    return null;
  }

  // 0,33 mm por módulo: dentro da faixa que o MOC admite e legível em laser comum
  const mod = opts.moduloMm ?? 0.33;
  const altura = opts.alturaMm ?? 13;
  const totalModulos = larguras.reduce((a, b) => a + b, 0);
  const largura = totalModulos * mod;

  let x = 0;
  const barras: string[] = [];
  larguras.forEach((w, i) => {
    // Índices pares são barras; ímpares, espaços
    if (i % 2 === 0) {
      barras.push(`<rect x="${x.toFixed(3)}" y="0" width="${(w * mod).toFixed(3)}" height="${altura}" fill="#000"/>`);
    }
    x += w * mod;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura.toFixed(2)}mm" height="${altura}mm" viewBox="0 0 ${largura.toFixed(3)} ${altura}" preserveAspectRatio="none" shape-rendering="crispEdges">${barras.join("")}</svg>`;
}
