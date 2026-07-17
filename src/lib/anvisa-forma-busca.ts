import type { AnvisaConstituinte } from '@/types/anvisa';

/** Formas que nunca podem se misturar na busca (hard rule, igual ao match por âncora). */
export type FormaDiscriminada =
  | 'd3'
  | 'd2'
  | 'k1'
  | 'k2'
  | 'b1'
  | 'b2'
  | 'b3'
  | 'b5'
  | 'b6'
  | 'b7'
  | 'b9'
  | 'b12'
  | 'generico_vitamina_d'
  | 'generico_vitamina_k';

export function normFormaBusca(s: string | null | undefined): string {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

const RE_D3 = /(colecalciferol|calcitriol|vitamina\s*d3|\bd3\b)/;
const RE_D2 = /(ergocalciferol|vitamina\s*d2|\bd2\b)/;
const RE_K1 = /(filoquinona|vitamina\s*k1|\bk1\b)/;
const RE_K2 = /(menaquinona|vitamina\s*k2|\bk2\b)/;

const RE_B: Record<Exclude<FormaDiscriminada, 'd3' | 'd2' | 'k1' | 'k2' | 'generico_vitamina_d' | 'generico_vitamina_k'>, RegExp> = {
  b12: /(cobalamina|cianocobalamina|metilcobalamina|vitamina\s*b12|\bb12\b)/,
  b6: /(piridox|vitamina\s*b6|\bb6\b)/,
  b1: /(tiamina|vitamina\s*b1|\bb1\b)/,
  b2: /(riboflavina|vitamina\s*b2|\bb2\b)/,
  b3: /(niacina|nicotinamida|vitamina\s*b3|\bb3\b)/,
  b5: /(pantoten|vitamina\s*b5|\bb5\b)/,
  b7: /(biotina|vitamina\s*b7|vitamina\s*h|\bb7\b)/,
  b9: /(folic|folato|metilfolato|vitamina\s*b9|\bb9\b)/,
};

const B_FORMAS = ['b12', 'b9', 'b7', 'b6', 'b5', 'b3', 'b2', 'b1'] as const;

/** Detecta a forma pedida no termo de busca (null = sem discriminação). */
export function detectarFormaPedida(termo: string): FormaDiscriminada | null {
  const n = normFormaBusca(termo);
  if (!n) return null;

  if (RE_D3.test(n)) return 'd3';
  if (RE_D2.test(n)) return 'd2';
  if (/vitamina\s*d\b/.test(n) && !RE_D2.test(n) && !RE_D3.test(n)) return 'generico_vitamina_d';

  if (RE_K1.test(n)) return 'k1';
  if (RE_K2.test(n)) return 'k2';
  if (/vitamina\s*k\b/.test(n) && !RE_K1.test(n) && !RE_K2.test(n)) return 'generico_vitamina_k';

  for (const b of B_FORMAS) {
    if (RE_B[b].test(n)) return b;
  }

  const vitMatch = n.match(/^vitamina\s+([a-z]\d*)\s*$/);
  if (vitMatch) {
    const v = vitMatch[1];
    if (v === 'd') return 'generico_vitamina_d';
    if (v === 'k') return 'generico_vitamina_k';
    if (v in RE_B) return v as FormaDiscriminada;
  }

  const compact = n.replace(/\s+/g, '');
  if (/^(d3|d2|k1|k2|b12|b9|b7|b6|b5|b3|b2|b1)$/.test(compact)) {
    return compact as FormaDiscriminada;
  }

  return null;
}

export function textoResultadoConstituinte(item: AnvisaConstituinte): string {
  return normFormaBusca(
    [
      item.nome_tecnico,
      item.nome_generico,
      item.nome_rotulo,
      ...(item.nome_popular || []),
      ...(item.sinonimos || []),
      item.fonte_de,
      item.categoria,
      item.subcategoria,
    ]
      .filter(Boolean)
      .join(' '),
  );
}

export function extrairFormasResultado(texto: string): Set<FormaDiscriminada> {
  const formas = new Set<FormaDiscriminada>();
  if (RE_D3.test(texto)) formas.add('d3');
  if (RE_D2.test(texto)) formas.add('d2');
  if (RE_K1.test(texto)) formas.add('k1');
  if (RE_K2.test(texto)) formas.add('k2');
  for (const b of B_FORMAS) {
    if (RE_B[b].test(texto)) formas.add(b);
  }
  return formas;
}

function conflitaFormaD(forma: 'd3' | 'd2', texto: string, formas: Set<FormaDiscriminada>): boolean {
  if (forma === 'd3') {
    return formas.has('d2') || RE_D2.test(texto);
  }
  return formas.has('d3') || RE_D3.test(texto);
}

function conflitaFormaK(forma: 'k1' | 'k2', texto: string, formas: Set<FormaDiscriminada>): boolean {
  if (forma === 'k1') {
    return formas.has('k2') || RE_K2.test(texto);
  }
  return formas.has('k1') || RE_K1.test(texto);
}

function conflitaFormaB(forma: (typeof B_FORMAS)[number], texto: string, formas: Set<FormaDiscriminada>): boolean {
  for (const b of B_FORMAS) {
    if (b === forma) continue;
    if (formas.has(b) || RE_B[b].test(texto)) return true;
  }
  return false;
}

/** Resultado é compatível com a forma pedida? */
export function resultadoCompativelComForma(
  formaPedida: FormaDiscriminada,
  item: AnvisaConstituinte,
): boolean {
  if (formaPedida === 'generico_vitamina_d' || formaPedida === 'generico_vitamina_k') {
    return true;
  }

  const texto = textoResultadoConstituinte(item);
  const formas = extrairFormasResultado(texto);

  if (formaPedida === 'd3' || formaPedida === 'd2') {
    if (conflitaFormaD(formaPedida, texto, formas)) return false;
    return formaPedida === 'd3'
      ? RE_D3.test(texto) || /vitamina\s*d\b/.test(texto)
      : RE_D2.test(texto);
  }

  if (formaPedida === 'k1' || formaPedida === 'k2') {
    if (conflitaFormaK(formaPedida, texto, formas)) return false;
    return formaPedida === 'k1' ? RE_K1.test(texto) : RE_K2.test(texto);
  }

  if (formaPedida in RE_B) {
    const b = formaPedida as (typeof B_FORMAS)[number];
    if (conflitaFormaB(b, texto, formas)) return false;
    return RE_B[b].test(texto);
  }

  return true;
}

export function filtrarResultadosPorForma<T extends AnvisaConstituinte>(
  termo: string,
  items: T[],
): T[] {
  const forma = detectarFormaPedida(termo);
  if (!forma || forma === 'generico_vitamina_d' || forma === 'generico_vitamina_k') {
    return items;
  }

  return items.filter((item) => resultadoCompativelComForma(forma, item));
}

/** Filtra sinônimos expandidos que cruzam formas incompatíveis. */
export function filtrarTermosExpandidosPorForma(termo: string, termos: string[]): string[] {
  const forma = detectarFormaPedida(termo);
  if (!forma || forma === 'generico_vitamina_d' || forma === 'generico_vitamina_k') {
    return termos;
  }

  const kept = termos.filter((t) => {
    const formaTermo = detectarFormaPedida(t);
    if (!formaTermo || formaTermo === 'generico_vitamina_d' || formaTermo === 'generico_vitamina_k') {
      return true;
    }
    return formaTermo === forma;
  });

  return kept.length > 0 ? kept : [termo];
}

/** Rótulo de forma para buscas genéricas (ex.: vitamina d → D3 vs D2). */
export function labelFormaResultado(item: AnvisaConstituinte): string | undefined {
  const formas = extrairFormasResultado(textoResultadoConstituinte(item));
  if (formas.has('d3')) return 'Vitamina D3 (Colecalciferol)';
  if (formas.has('d2')) return 'Vitamina D2 (Ergocalciferol)';
  if (formas.has('k1')) return 'Vitamina K1 (Filoquinona)';
  if (formas.has('k2')) return 'Vitamina K2 (Menaquinona)';
  return undefined;
}

export function prioridadeFormaGenerica(item: AnvisaConstituinte): number {
  const formas = extrairFormasResultado(textoResultadoConstituinte(item));
  if (formas.has('d3')) return 0;
  if (formas.has('d2')) return 1;
  if (formas.has('k1')) return 0;
  if (formas.has('k2')) return 1;
  return 2;
}
