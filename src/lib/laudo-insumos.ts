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

const STOPWORDS_TOKENS = new Set([
  'de', 'do', 'da', 'dos', 'das', 'e', 'em', 'com', 'para', 'po', 'mp', 'pct',
]);

/** Normalização forte para match de laudo (remove %, graus farmacêuticos, expande abreviações) */
export function normForte(s: string): string {
  let t = norm(s);
  t = t.replace(/\d+([.,]\d+)?\s*%/g, ' ');
  t = t.replace(/\b(usp|dl-|l-|ph\.eur|bp|po)\b/gi, ' ');
  t = t.replace(/[.,;:()[\]/\\-]/g, ' ');
  t = t.replace(/\bvit\b/g, 'vitamina');
  t = t.replace(/\btipo\b/g, 't');
  t = t.replace(/\bhialuronico\b/g, 'hialuronico');
  t = t.replace(/\bacido\b/g, 'acido');
  return t.replace(/\s+/g, ' ').trim();
}

function tokensNormForte(s: string): string[] {
  return normForte(s)
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS_TOKENS.has(w));
}

/** Score 0–1 entre nome do laudo e descrição do cadastro */
export function scoreSimilaridadeTokens(nomeLaudo: string, descricaoCadastro: string): number {
  const ta = tokensNormForte(nomeLaudo);
  const tb = tokensNormForte(descricaoCadastro);
  if (!ta.length || !tb.length) return 0;

  const setA = new Set(ta);
  const setB = new Set(tb);
  const intersecao = [...setA].filter((t) => setB.has(t)).length;
  const uniao = new Set([...setA, ...setB]).size;
  const jaccard = uniao > 0 ? intersecao / uniao : 0;
  const cobertura = intersecao / ta.length;
  const bonusPrimeira = ta[0] === tb[0] ? 0.15 : 0;

  const exclusivasItem = [...setB].filter((t) => !setA.has(t)).length;
  const penalidade = Math.min(0.2, exclusivasItem * 0.06);

  return Math.min(1, Math.max(0, jaccard * 0.5 + cobertura * 0.5 + bonusPrimeira - penalidade));
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

/** Camada 1 — match exato / includes com norm simples */
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

/** Camada 1b — normForte (tipo→t, vit→vitamina, remove %) */
export function casarPorNormForte(
  nome: string,
  insumos: InsumoParaCasamento[],
): ResultadoMatch {
  const n = normForte(nome);
  if (!n) return { insumoId: null, tipo: 'nenhum' };

  const exato = insumos.find((i) => normForte(i.descricao_interna) === n);
  if (exato) {
    return { insumoId: exato.id, tipo: 'exato', sugestaoNome: exato.descricao_interna };
  }

  const parcial = insumos.find((i) => {
    const ni = normForte(i.descricao_interna);
    return ni.includes(n) || n.includes(ni);
  });
  if (parcial) {
    return { insumoId: parcial.id, tipo: 'similar', sugestaoNome: parcial.descricao_interna };
  }

  return { insumoId: null, tipo: 'nenhum' };
}

/** Camada 2 local — tokens/Jaccard (funciona sem RPC no banco) */
export function casarPorSimilaridadeLocal(
  nome: string,
  insumos: InsumoParaCasamento[],
  limiar = 0.5,
): ResultadoMatch {
  let melhor: { id: string; nome: string; score: number } | null = null;

  for (const insumo of insumos) {
    const score = scoreSimilaridadeTokens(nome, insumo.descricao_interna);
    if (score > (melhor?.score ?? 0)) {
      melhor = { id: insumo.id, nome: insumo.descricao_interna, score };
    }
  }

  if (melhor && melhor.score >= limiar) {
    return {
      insumoId: melhor.id,
      tipo: 'similar',
      sugestaoNome: melhor.nome,
    };
  }

  return { insumoId: null, tipo: 'nenhum' };
}

/** Compatibilidade — retorna só o id */
export function casarInsumoPorNome(
  nome: string,
  insumos: InsumoParaCasamento[],
): string | null {
  return (
    casarCamadaExata(nome, insumos).insumoId ??
    casarPorNormForte(nome, insumos).insumoId ??
    casarPorSimilaridadeLocal(nome, insumos).insumoId
  );
}

interface InsumoSimilarRow {
  id: string;
  descricao_interna: string;
  sim: number;
}

/** Camada 2b — similaridade pg_trgm via RPC (fallback para local se RPC indisponível) */
export async function casarPorSimilaridade(
  nome: string,
  companyId: string | null,
  insumos: InsumoParaCasamento[] = [],
): Promise<ResultadoMatch> {
  const termo = normForte(nome);
  if (!termo) return { insumoId: null, tipo: 'nenhum' };

  if (companyId) {
    const { data, error } = await supabase.rpc('buscar_insumos_similares', {
      termo,
      comp: companyId,
    });

    if (!error && data?.length) {
      const topo = (data as InsumoSimilarRow[])[0];
      if (topo?.id && topo.sim > 0.3) {
        return {
          insumoId: topo.id,
          tipo: 'similar',
          sugestaoNome: topo.descricao_interna,
        };
      }
    }
  }

  return casarPorSimilaridadeLocal(nome, insumos);
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
      if (exato.insumoId) return { ...exato, tipo: 'ia' };

      const normForteHit = casarPorNormForte(candidato, insumos);
      if (normForteHit.insumoId) return { ...normForteHit, tipo: 'ia' };

      const local = casarPorSimilaridadeLocal(candidato, insumos);
      if (local.insumoId) return { ...local, tipo: 'ia' };

      const sim = await casarPorSimilaridade(candidato, companyId, insumos);
      if (sim.insumoId) return { ...sim, tipo: 'ia' };
    }
  } catch {
    // IA é auxiliar — falha silenciosa
  }

  return { insumoId: null, tipo: 'nenhum' };
}

/** Resolve match em camadas: exato → normForte → tokens local → RPC → IA */
export async function resolverMatchLaudo(
  nome: string,
  insumos: InsumoParaCasamento[],
  companyId: string | null,
): Promise<ResultadoMatch> {
  if (!insumos.length) return { insumoId: null, tipo: 'nenhum' };

  const exato = casarCamadaExata(nome, insumos);
  if (exato.insumoId) return exato;

  const normForteHit = casarPorNormForte(nome, insumos);
  if (normForteHit.insumoId) return normForteHit;

  const local = casarPorSimilaridadeLocal(nome, insumos);
  if (local.insumoId) return local;

  const similar = await casarPorSimilaridade(nome, companyId, insumos);
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
