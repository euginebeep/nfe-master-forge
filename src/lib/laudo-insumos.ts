import { supabase } from '@/integrations/supabase/client';
import { normalizarUnidadeInformadaCodigo } from '@/lib/unidades-dose';

export type AtivoLaudo = { nome: string; dose: number; unit: string; key?: string };

export { normalizarUnidadeInformadaCodigo };

export type TipoMatch = 'exato' | 'similar' | 'ia' | 'nenhum';

export interface ResultadoMatch {
  insumoId: string | null;
  tipo: TipoMatch;
  sugestaoNome?: string;
}

export const norm = (s: string) =>
  (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Normalização forte para match de laudo (remove %, graus farmacêuticos, expande abreviações) */
export function normForte(s: string): string {
  let t = norm(s);
  t = t.replace(/\d+([.,]\d+)?\s*%/g, ' ');
  t = t.replace(/\b(usp|dl-|l-|ph\.eur|bp)\b/gi, ' ');
  t = t.replace(/[.,;:()[\]]/g, ' ');
  t = t.replace(/\bvit\b/g, 'vitamina');
  return t.replace(/\s+/g, ' ').trim();
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

/** Camada 1 — match exato / includes (como antes) */
export function casarCamadaExata(
  nome: string,
  insumos: InsumoParaCasamento[],
): ResultadoMatch {
  const n = norm(nome);
  const hit =
    insumos.find((i) => norm(i.descricao_interna) === n) ||
    insumos.find((i) => {
      const ni = norm(i.descricao_interna);
      return ni.includes(n) || n.includes(ni);
    });

  if (hit) {
    return { insumoId: hit.id, tipo: 'exato', sugestaoNome: hit.descricao_interna };
  }
  return { insumoId: null, tipo: 'nenhum' };
}

/** Compatibilidade — retorna só o id */
export function casarInsumoPorNome(
  nome: string,
  insumos: InsumoParaCasamento[],
): string | null {
  return casarCamadaExata(nome, insumos).insumoId;
}

interface InsumoSimilarRow {
  id: string;
  descricao_interna: string;
  sim: number;
}

/** Camada 2 — similaridade pg_trgm via RPC */
export async function casarPorSimilaridade(
  nome: string,
  companyId: string | null,
): Promise<ResultadoMatch> {
  if (!companyId) return { insumoId: null, tipo: 'nenhum' };

  const termo = normForte(nome);
  if (!termo) return { insumoId: null, tipo: 'nenhum' };

  const { data, error } = await supabase.rpc('buscar_insumos_similares', {
    termo,
    comp: companyId,
  });

  if (error || !data?.length) return { insumoId: null, tipo: 'nenhum' };

  const topo = (data as InsumoSimilarRow[])[0];
  if (!topo?.id || topo.sim <= 0.3) return { insumoId: null, tipo: 'nenhum' };

  return {
    insumoId: topo.id,
    tipo: 'similar',
    sugestaoNome: topo.descricao_interna,
  };
}

/** Camada 3 — sinônimos via anvisa-resolve-name, depois camadas 1+2 */
export async function casarPorIA(
  nome: string,
  insumos: InsumoParaCasamento[],
  companyId: string | null,
): Promise<ResultadoMatch> {
  const termo = nome.trim();
  if (!termo) return { insumoId: null, tipo: 'nenhum' };

  try {
    const { data, error } = await supabase.functions.invoke('anvisa-resolve-name', {
      body: { termo },
    });
    if (error) return { insumoId: null, tipo: 'nenhum' };

    const termos: string[] = Array.isArray(data?.termos) ? data.termos : [];
    const candidatos = [termo, ...termos].filter(Boolean);

    for (const candidato of candidatos) {
      const exato = casarCamadaExata(candidato, insumos);
      if (exato.insumoId) {
        return { ...exato, tipo: 'ia' };
      }

      const sim = await casarPorSimilaridade(candidato, companyId);
      if (sim.insumoId) {
        return { ...sim, tipo: 'ia' };
      }
    }
  } catch {
    // IA é auxiliar — falha silenciosa
  }

  return { insumoId: null, tipo: 'nenhum' };
}

/** Resolve match em camadas: exato → similar → IA */
export async function resolverMatchLaudo(
  nome: string,
  insumos: InsumoParaCasamento[],
  companyId: string | null,
): Promise<ResultadoMatch> {
  const exato = casarCamadaExata(nome, insumos);
  if (exato.insumoId) return exato;

  const similar = await casarPorSimilaridade(nome, companyId);
  if (similar.insumoId) return similar;

  return casarPorIA(nome, insumos, companyId);
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
