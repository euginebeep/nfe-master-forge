/**
 * Convenção de micrograma:
 * - Símbolo padrão: µg (micro + g)
 * - Abreviação aceita: mcg (evita erros de leitura em receitas e bulas)
 */

export const SIMBOLO_MICROGRAMA = 'µg';

const MICROGRAMA_ALIASES = new Set(['mcg', 'µg', '\u03bcg', 'μg']);

/** Normaliza entrada (µg, μg, mcg, MCG) para "mcg" — uso interno/parsing */
export function canonicalizarUnidadeDose(unidade: string): string {
  const raw = (unidade || '').trim();
  if (!raw) return raw;

  const lower = raw.toLowerCase();
  if (lower === 'mcg' || lower === 'µg' || lower === '\u03bcg' || lower === 'μg') {
    return 'mcg';
  }

  const upper = raw.toUpperCase();
  if (upper === 'MCG') return 'mcg';

  return lower;
}

/** Verifica se a unidade representa micrograma (µg ou mcg) */
export function isUnidadeMicrograma(unidade: string): boolean {
  const u = (unidade || '').trim().toLowerCase();
  return MICROGRAMA_ALIASES.has(u) || u === 'mcg/g' || u === 'µg/g' || u === '\u03bcg/g' || u === 'μg/g';
}

/**
 * Formata unidade para exibição ao usuário.
 * MCG/mcg → µg (padrão); demais unidades mantêm convenção usual.
 */
export function formatarUnidadeInformada(unidade: string): string {
  const upper = (unidade || '').trim().toUpperCase();
  switch (upper) {
    case 'MCG':
      return SIMBOLO_MICROGRAMA;
    case 'MG':
      return 'mg';
    case 'UI':
      return 'UI';
    case 'G':
      return 'g';
    case 'ML':
      return 'mL';
    default: {
      const lower = unidade.toLowerCase();
      if (isUnidadeMicrograma(lower)) return SIMBOLO_MICROGRAMA;
      return lower;
    }
  }
}

/** Formata quantidade + unidade para exibição (ex: "100 µg") */
export function formatarQuantidadeDose(valor: number, unidade: string, opts?: { maximumFractionDigits?: number }): string {
  const digits = opts?.maximumFractionDigits ?? 2;
  const fmt = valor.toLocaleString('pt-BR', { maximumFractionDigits: digits });
  return `${fmt} ${formatarUnidadeInformada(unidade)}`;
}

/** Label para potência em micrograma por grama */
export const LABEL_MCG_POR_GRAMA = `Micrograma por grama (${SIMBOLO_MICROGRAMA}/g)`;

/** Converte unidade de laudo/NF para código interno (MG, MCG, UI, G) */
export function normalizarUnidadeInformadaCodigo(unidade: string): string {
  const c = canonicalizarUnidadeDose(unidade || 'mg');
  if (c === 'mcg') return 'MCG';
  return c.toUpperCase();
}

/** Substitui µg/μg por mcg para parsing de NF-e e descrições comerciais */
export function preprocessarUnidadeComercial(unidade: string): string {
  return (unidade || '')
    .replace(/µg/gi, 'mcg')
    .replace(/μg/gi, 'mcg')
    .replace(/\u00b5g/gi, 'mcg')
    .replace(/\u03bcg/gi, 'mcg');
}
