import type { AnvisaConstituinte } from '@/types/anvisa';

/** Formas que nunca podem se misturar na busca (hard rule, igual ao match por âncora). */
export type FormaDiscriminada =
  | 'd3'
  | 'd2'
  | 'calcidiol'
  | 'calcitriol'
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

export type FormaEspecifica = Exclude<
  FormaDiscriminada,
  'generico_vitamina_d' | 'generico_vitamina_k'
>;

/** Match fraco (<50%) não aparece quando o termo pede forma específica. */
export const SCORE_MINIMO_FORMA_ESPECIFICA = 50;

export function normFormaBusca(s: string | null | undefined): string {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Apenas Colecalciferol / Vitamina D3 — NÃO inclui metabólitos. */
const RE_COLECALCIFEROL = /(colecalciferol|vitamina\s*d3|\bd3\b)/;
const RE_ERGOCALCIFEROL = /(ergocalciferol|vitamina\s*d2|\bd2\b)/;
const RE_CALCIDIOL = /(calcidiol|25[\s-]?hidroxi|25\(oh\)|hidroxicolecalciferol)/;
const RE_CALCITRIOL = /(calcitriol|1[\s,]?25[\s-]?di.*hidroxi)/;
const RE_K1 = /(filoquinona|vitamina\s*k1|\bk1\b)/;
const RE_K2 = /(menaquinona|vitamina\s*k2|\bk2\b)/;

/** Outras formas/metabólitos de D — incompatíveis com busca por d3/colecalciferol. */
const RE_OUTRAS_FORMAS_D = new RegExp(
  [
    RE_ERGOCALCIFEROL.source,
    RE_CALCIDIOL.source,
    RE_CALCITRIOL.source,
  ].join('|'),
);

const RE_B: Record<
  Exclude<
    FormaDiscriminada,
    'd3' | 'd2' | 'calcidiol' | 'calcitriol' | 'k1' | 'k2' | 'generico_vitamina_d' | 'generico_vitamina_k'
  >,
  RegExp
> = {
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

export function isFormaEspecifica(forma: FormaDiscriminada | null): forma is FormaEspecifica {
  return forma != null && forma !== 'generico_vitamina_d' && forma !== 'generico_vitamina_k';
}

/** Detecta a forma pedida no termo de busca (null = sem discriminação). */
export function detectarFormaPedida(termo: string): FormaDiscriminada | null {
  const n = normFormaBusca(termo);
  if (!n) return null;

  if (RE_CALCIDIOL.test(n)) return 'calcidiol';
  if (RE_CALCITRIOL.test(n)) return 'calcitriol';
  if (RE_COLECALCIFEROL.test(n)) return 'd3';
  if (RE_ERGOCALCIFEROL.test(n)) return 'd2';
  if (/vitamina\s*d\b/.test(n) && !RE_ERGOCALCIFEROL.test(n) && !RE_COLECALCIFEROL.test(n)) {
    return 'generico_vitamina_d';
  }

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
  if (RE_CALCIDIOL.test(texto)) formas.add('calcidiol');
  if (RE_CALCITRIOL.test(texto)) formas.add('calcitriol');
  if (RE_COLECALCIFEROL.test(texto)) formas.add('d3');
  if (RE_ERGOCALCIFEROL.test(texto)) formas.add('d2');
  if (RE_K1.test(texto)) formas.add('k1');
  if (RE_K2.test(texto)) formas.add('k2');
  for (const b of B_FORMAS) {
    if (RE_B[b].test(texto)) formas.add(b);
  }
  return formas;
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

function compativelFormaD(formaPedida: 'd3' | 'd2' | 'calcidiol' | 'calcitriol', texto: string): boolean {
  switch (formaPedida) {
    case 'd3':
      if (RE_OUTRAS_FORMAS_D.test(texto)) return false;
      return RE_COLECALCIFEROL.test(texto);
    case 'd2':
      if (RE_COLECALCIFEROL.test(texto) || RE_CALCIDIOL.test(texto) || RE_CALCITRIOL.test(texto)) {
        return false;
      }
      return RE_ERGOCALCIFEROL.test(texto);
    case 'calcidiol':
      return RE_CALCIDIOL.test(texto) && !RE_COLECALCIFEROL.test(texto) && !RE_ERGOCALCIFEROL.test(texto);
    case 'calcitriol':
      return RE_CALCITRIOL.test(texto) && !RE_COLECALCIFEROL.test(texto) && !RE_ERGOCALCIFEROL.test(texto);
    default:
      return false;
  }
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

  if (formaPedida === 'd3' || formaPedida === 'd2' || formaPedida === 'calcidiol' || formaPedida === 'calcitriol') {
    return compativelFormaD(formaPedida, texto) && !conflitaOutrasFormasD(formaPedida, formas);
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

function conflitaOutrasFormasD(
  formaPedida: 'd3' | 'd2' | 'calcidiol' | 'calcitriol',
  formas: Set<FormaDiscriminada>,
): boolean {
  const outras: FormaDiscriminada[] = ['d3', 'd2', 'calcidiol', 'calcitriol'];
  for (const f of outras) {
    if (f !== formaPedida && formas.has(f)) return true;
  }
  return false;
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

function termoExpandidoCompativel(forma: FormaEspecifica, termo: string): boolean {
  const n = normFormaBusca(termo);
  const formaTermo = detectarFormaPedida(termo);

  if (formaTermo && isFormaEspecifica(formaTermo) && formaTermo !== forma) {
    return false;
  }

  if (forma === 'd3') {
    if (RE_OUTRAS_FORMAS_D.test(n)) return false;
    if (/vitamina\s*d\b/.test(n) && !RE_COLECALCIFEROL.test(n)) return false;
    return true;
  }

  if (forma === 'd2') {
    if (RE_COLECALCIFEROL.test(n) || RE_CALCIDIOL.test(n) || RE_CALCITRIOL.test(n)) return false;
    return true;
  }

  if (forma === 'k1' && RE_K2.test(n)) return false;
  if (forma === 'k2' && RE_K1.test(n)) return false;

  if (forma in RE_B) {
    for (const b of B_FORMAS) {
      if (b !== forma && RE_B[b].test(n)) return false;
    }
  }

  return true;
}

/** Filtra sinônimos expandidos que cruzam formas incompatíveis ou metabólitos. */
export function filtrarTermosExpandidosPorForma(termo: string, termos: string[]): string[] {
  const forma = detectarFormaPedida(termo);
  if (!forma || forma === 'generico_vitamina_d' || forma === 'generico_vitamina_k') {
    return termos;
  }

  const kept = termos.filter((t) => termoExpandidoCompativel(forma, t));
  return kept.length > 0 ? kept : [termo];
}

export function passaCorteScoreFormaEspecifica(termo: string, score: number | undefined): boolean {
  const forma = detectarFormaPedida(termo);
  if (!isFormaEspecifica(forma)) return true;
  return (score ?? 0) >= SCORE_MINIMO_FORMA_ESPECIFICA;
}

/** Rótulo de forma para buscas genéricas (ex.: vitamina d → D3 vs D2). */
export function labelFormaResultado(item: AnvisaConstituinte): string | undefined {
  const formas = extrairFormasResultado(textoResultadoConstituinte(item));
  if (formas.has('d3')) return 'Vitamina D3 (Colecalciferol)';
  if (formas.has('calcidiol')) return 'Calcidiol (25-hidroxi-D3)';
  if (formas.has('calcitriol')) return 'Calcitriol';
  if (formas.has('d2')) return 'Vitamina D2 (Ergocalciferol)';
  if (formas.has('k1')) return 'Vitamina K1 (Filoquinona)';
  if (formas.has('k2')) return 'Vitamina K2 (Menaquinona)';
  return undefined;
}

export function prioridadeFormaGenerica(item: AnvisaConstituinte): number {
  const formas = extrairFormasResultado(textoResultadoConstituinte(item));
  if (formas.has('d3')) return 0;
  if (formas.has('calcidiol')) return 1;
  if (formas.has('calcitriol')) return 2;
  if (formas.has('d2')) return 3;
  if (formas.has('k1')) return 0;
  if (formas.has('k2')) return 1;
  return 4;
}
