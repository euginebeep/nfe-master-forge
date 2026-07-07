// Funções de similaridade de texto — v2
// M1: Penalidade de especificidade
// M2: Normalização de separadores numéricos
// M3: Score Jaccard bidirecional

/** Limiar mínimo (0–1) para aceitar match por EAN com validação de descrição */
export const SIMILARIDADE_MINIMA_EAN = 0.6;

/** Remove acentos, caracteres especiais e normaliza espaços */
function normalizar(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s%]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** [M2] Normaliza separadores numéricos antes de tokenizar */
function normalizarNumeros(str: string): string {
  return str
    .replace(/(\d)\.(\d{3})/g, "$1$2")
    .replace(/(\d),(\d)/g, "$1$2");
}

const STOPWORDS = new Set(["ext", "seco", "seca", "extrato", "de", "do", "da", "e", "em", "com", "para"]);

function palavrasChave(str: string): string[] {
  return normalizar(normalizarNumeros(str))
    .split(" ")
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

/**
 * Calcula score de similaridade entre descrições.
 * Retorna valor de 0 a 100.
 */
export function calcularSimilaridade(xmlDesc: string, itemDesc: string): number {
  const xmlPalavras = palavrasChave(xmlDesc);
  const itemPalavras = palavrasChave(itemDesc);

  if (xmlPalavras.length === 0 || itemPalavras.length === 0) return 0;

  const xmlSet = new Set(xmlPalavras);
  const itemSet = new Set(itemPalavras);

  const intersecao = [...xmlSet].filter((p) => itemSet.has(p)).length;
  const uniao = new Set([...xmlSet, ...itemSet]).size;
  const jaccard = uniao > 0 ? intersecao / uniao : 0;

  const coberturaXml = xmlPalavras.filter((p) => itemSet.has(p)).length / xmlPalavras.length;
  const scoreBase = jaccard * 0.5 + coberturaXml * 0.5;

  const bonusPrimeira = xmlPalavras[0] === itemPalavras[0] ? 0.15 : 0;

  const xmlPerc = normalizar(normalizarNumeros(xmlDesc)).match(/\d+%/g) || [];
  const itemPerc = normalizar(normalizarNumeros(itemDesc)).match(/\d+%/g) || [];
  const bonusPerc =
    xmlPerc.length > 0 && xmlPerc.some((p) => itemPerc.includes(p)) ? 0.1 : 0;

  const palavrasExclusivasItem = [...itemSet].filter((p) => !xmlSet.has(p)).length;
  const penalidade = Math.min(0.20, palavrasExclusivasItem * 0.07);

  return Math.min(100, Math.max(0, Math.round((scoreBase + bonusPrimeira + bonusPerc - penalidade) * 100)));
}

/** Valida se a descrição do XML é suficientemente similar à do item para aceitar match por EAN */
export function similaridadeAceitaParaEan(
  xmlDesc?: string | null,
  itemDesc?: string | null
): boolean {
  if (!xmlDesc?.trim() || !itemDesc?.trim()) return false;
  return calcularSimilaridade(xmlDesc, itemDesc) / 100 >= SIMILARIDADE_MINIMA_EAN;
}
