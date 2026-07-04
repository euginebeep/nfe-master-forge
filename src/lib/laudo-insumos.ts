export type AtivoLaudo = { nome: string; dose: number; unit: string; key?: string };

export const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Normaliza unidade de laudo para código interno (MG, MCG, UI, G, UFC, FCC...) */
export function normalizarUnidadeInformadaCodigo(unidade: string): string {
  const raw = (unidade || '').trim();
  const lower = raw.toLowerCase();
  if (lower === 'mcg' || lower === 'µg' || lower === '\u03bcg' || lower === 'μg') return 'MCG';
  return raw.toUpperCase();
}

export function chaveAtivoLaudo(ativo: AtivoLaudo, index: number): string {
  if (ativo.key) return ativo.key;
  const nome = ativo.nome?.trim();
  if (nome) return norm(nome);
  return `ativo-${index}`;
}

export function ativoEntraNaMassa(ativo: AtivoLaudo): boolean {
  const nome = ativo.nome?.trim();
  if (!nome) return false;

  const u = normalizarUnidadeInformadaCodigo(ativo.unit || 'mg');
  if (['UFC', 'FCC'].includes(u)) return false;
  return ['MG', 'MCG', 'UI', 'G'].includes(u);
}

export interface InsumoParaCasamento {
  id: string;
  descricao_interna: string;
}

export function casarInsumoPorNome(
  nome: string,
  insumos: InsumoParaCasamento[],
): string | null {
  const n = norm(nome);
  const hit =
    insumos.find((i) => norm(i.descricao_interna) === n) ||
    insumos.find(
      (i) =>
        norm(i.descricao_interna).includes(n) ||
        n.includes(norm(i.descricao_interna)),
    );
  return hit?.id ?? null;
}

export function resolverInsumoId(
  ativo: AtivoLaudo,
  index: number,
  insumos: InsumoParaCasamento[],
  resolucoes: Record<string, string> = {},
): string | null {
  const key = chaveAtivoLaudo(ativo, index);
  return resolucoes[key] ?? casarInsumoPorNome(ativo.nome, insumos);
}

export function listarAtivosSemInsumo(
  ativos: AtivoLaudo[],
  insumos: InsumoParaCasamento[],
  resolucoes: Record<string, string> = {},
): string[] {
  const pendentes: string[] = [];
  ativos.forEach((ativo, index) => {
    if (!ativoEntraNaMassa(ativo)) return;
    if (!resolverInsumoId(ativo, index, insumos, resolucoes)) {
      pendentes.push(ativo.nome?.trim() || `Ativo ${index + 1}`);
    }
  });
  return pendentes;
}
