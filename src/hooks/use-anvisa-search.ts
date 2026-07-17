import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AnvisaConstituinte } from '@/types/anvisa';
import {
  detectarFormaPedida,
  filtrarResultadosPorForma,
  filtrarTermosExpandidosPorForma,
  labelFormaResultado,
  passaCorteScoreFormaEspecifica,
  prioridadeFormaGenerica,
} from '@/lib/anvisa-forma-busca';

export type AnvisaMatchInfo = {
  score: number;
  fields: string[];
  synonyms: string[];
};

export type AnvisaSearchResult = AnvisaConstituinte & {
  _match?: AnvisaMatchInfo;
  _formaLabel?: string;
};

// In-memory cache for synonym resolution (TTL 30 min) — avoids re-calling the
// AI edge function for the same term, dramatically reducing latency.
const synonymCache = new Map<string, { termos: string[]; ts: number }>();
const SYNONYM_TTL_MS = 30 * 60 * 1000;

function norm(s: string | null | undefined): string {
  return (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Termo casa como token inteiro no valor (evita "b1" casar em "b12"). */
function contemToken(valor: string, termo: string): boolean {
  if (!valor || !termo) return false;
  if (valor === termo) return true;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(termo)}(?:[^a-z0-9]|$)`).test(valor);
}

async function resolverNomesCientificos(termo: string): Promise<string[]> {
  if (!termo || termo.length < 2) return [termo];

  const key = norm(termo);
  const cached = synonymCache.get(key);
  if (cached && Date.now() - cached.ts < SYNONYM_TTL_MS) {
    return cached.termos;
  }

  try {
    const { data, error } = await supabase.functions.invoke('anvisa-resolve-name', {
      body: { termo },
    });

    if (error || !data?.termos?.length) return [termo];
    const termos = filtrarTermosExpandidosPorForma(termo, data.termos as string[]);
    synonymCache.set(key, { termos, ts: Date.now() });
    return termos;
  } catch {
    return [termo];
  }
}

/** RPC que varre sinonimos[] e nome_popular[] — fonte principal para "b12", "d3", etc. */
async function buscarPorSinonimosEPopular(
  termo: string,
  limit?: number,
): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];
  const cap = limit ?? 20;

  const { data, error } = await supabase.rpc('buscar_constituinte_por_nome_popular', {
    termo_busca: termo,
  });

  if (error) {
    console.warn('[anvisa-search] buscar_constituinte_por_nome_popular:', error.message);
    return [];
  }

  const rows = (data || []) as unknown as AnvisaConstituinte[];
  return rows.slice(0, cap);
}

async function buscarPorTermo(termo: string, exaustivo = false, limit?: number): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  const cap = limit ?? (exaustivo ? 60 : 20);

  const { data: fullText } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .textSearch('search_vector', termo, { type: 'websearch', config: 'portuguese' })
    .limit(cap);

  // text[] (sinonimos / nome_popular) não aceita ilike no PostgREST —
  // cobertos por buscarPorSinonimosEPopular (RPC).
  const orFilters = exaustivo
    ? [
        `nome_tecnico.ilike.%${termo}%`,
        `nome_generico.ilike.%${termo}%`,
        `nome_rotulo.ilike.%${termo}%`,
        `categoria.ilike.%${termo}%`,
        `subcategoria.ilike.%${termo}%`,
        `fonte_de.ilike.%${termo}%`,
        `cas_number.ilike.%${termo}%`,
        `restricoes_uso.ilike.%${termo}%`,
        `motivo_proibicao.ilike.%${termo}%`,
      ].join(',')
    : `nome_tecnico.ilike.%${termo}%,nome_generico.ilike.%${termo}%,nome_rotulo.ilike.%${termo}%`;

  const { data: ilike } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .or(orFilters)
    .limit(cap);

  const arraySearch = await buscarPorSinonimosEPopular(termo, cap);

  const all = [...(fullText || []), ...(ilike || []), ...arraySearch] as AnvisaConstituinte[];

  return filtrarResultadosPorForma(termo, all);
}

async function buscarFuzzy(termo: string, exaustivo = false, limit?: number): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  // Skip fuzzy for very common generic terms like "vitamina e" to avoid noise (but allow in exaustivo)
  if (!exaustivo) {
    const vitaminMatch = termo.trim().toLowerCase().match(/^vitamina\s+[a-z]\d?\s*$/i);
    if (vitaminMatch) return [];
  }

  const cap = limit ?? (exaustivo ? 30 : 10);

  const { data } = await supabase
    .rpc('buscar_constituinte_fuzzy', { termo_busca: termo })
    .limit(cap);

  // Filter low-relevance fuzzy results (broader threshold in exaustivo mode)
  const threshold = exaustivo ? 0.12 : 0.25;
  const fuzzy = ((data || []) as any[]).filter((d) => {
    if (d.similaridade !== undefined) return d.similaridade > threshold;
    return true;
  }) as unknown as AnvisaConstituinte[];

  return filtrarResultadosPorForma(termo, fuzzy);
}

/** Hit direto em sinonimos[] / nome_popular[] com o termo digitado. */
export function temHitSinonimoOuPopular(item: AnvisaConstituinte, termo: string): boolean {
  const termoN = norm(termo);
  if (!termoN || termoN.length < 2) return false;
  const valores = [...(item.sinonimos || []), ...(item.nome_popular || [])].map(norm);
  return valores.some((v) => contemToken(v, termoN));
}

export function computeMatch(
  item: AnvisaConstituinte,
  termo: string,
  sinonimos: string[],
): AnvisaMatchInfo {
  const termoN = norm(termo);
  const sinN = sinonimos.map(norm).filter((s) => s && s !== termoN);
  const allTerms = [termoN, ...sinN].filter(Boolean);

  const candidates: Array<{ field: string; values: string[]; isSinonimoField?: boolean }> = [
    { field: 'nome_técnico', values: [item.nome_tecnico] },
    { field: 'nome_genérico', values: [item.nome_generico || ''] },
    { field: 'nome_rótulo', values: [item.nome_rotulo || ''] },
    { field: 'nomes_populares', values: item.nome_popular || [], isSinonimoField: true },
    { field: 'sinônimos', values: item.sinonimos || [], isSinonimoField: true },
    { field: 'categoria', values: [item.categoria || ''] },
    { field: 'subcategoria', values: [item.subcategoria || ''] },
    { field: 'fonte', values: [item.fonte_de || ''] },
    { field: 'CAS', values: [item.cas_number || ''] },
    { field: 'restrições', values: [item.restricoes_uso || ''] },
  ];

  const matchedFields = new Set<string>();
  const matchedSynonyms = new Set<string>();
  let score = 0;
  let hitSinonimoExato = false;

  for (const c of candidates) {
    for (const raw of c.values) {
      const v = norm(raw);
      if (!v) continue;

      // Sinônimo / nome popular com o termo DIGITADO = confiança máxima (não pode ser cortado)
      if (c.isSinonimoField && contemToken(v, termoN)) {
        hitSinonimoExato = true;
        matchedFields.add(c.field);
      }

      for (const t of allTerms) {
        if (!t || t.length < 2) continue;
        if (v === t) {
          score += 5;
          matchedFields.add(c.field);
          if (t !== termoN) matchedSynonyms.add(t);
        } else if (contemToken(v, t) || v.includes(t)) {
          score += 2;
          matchedFields.add(c.field);
          if (t !== termoN) matchedSynonyms.add(t);
        }
      }
    }
  }

  // Normalize to 0-100; sinônimo/popular do termo original = 100%
  const normalized = hitSinonimoExato
    ? 100
    : Math.min(100, Math.round((score / 20) * 100));

  return {
    score: normalized,
    fields: Array.from(matchedFields),
    synonyms: Array.from(matchedSynonyms),
  };
}

async function buscarConstituintes(termo: string, exaustivo = false, limit?: number): Promise<AnvisaSearchResult[]> {
  if (!termo || termo.length < 2) return [];

  // Step 1: Use AI to resolve popular/abbreviated names to scientific names
  const resolvidos = await resolverNomesCientificos(termo);
  // Sempre inclui o termo original (RPC de sinônimos depende dele)
  const termosExpandidos = Array.from(new Set([termo, ...resolvidos]));

  // Step 2: Search for ALL resolved terms + garantia explícita da RPC de sinônimos
  const resultadosPorTermo = await Promise.all([
    ...termosExpandidos.map((t) => buscarPorTermo(t, exaustivo, limit)),
    ...termosExpandidos.map((t) => buscarFuzzy(t, exaustivo, limit)),
    // Sempre mescla hit direto em sinonimos/nome_popular com o termo digitado
    buscarPorSinonimosEPopular(termo, limit ?? 20).then((rows) =>
      filtrarResultadosPorForma(termo, rows),
    ),
  ]);

  // Step 3: Deduplicate results by ID
  const mapa = new Map<string, AnvisaConstituinte>();
  resultadosPorTermo.flat().forEach((item) => {
    if (item?.id) mapa.set(item.id, item);
  });

  const deduped = filtrarResultadosPorForma(termo, Array.from(mapa.values()));
  const formaGenerica = detectarFormaPedida(termo);

  // Step 4: Compute match info and sort by score desc
  const enriched: AnvisaSearchResult[] = deduped.map((item) => ({
    ...item,
    _match: computeMatch(item, termo, termosExpandidos),
    _formaLabel:
      formaGenerica === 'generico_vitamina_d' || formaGenerica === 'generico_vitamina_k'
        ? labelFormaResultado(item)
        : undefined,
  }));
  enriched.sort((a, b) => {
    if (formaGenerica === 'generico_vitamina_d' || formaGenerica === 'generico_vitamina_k') {
      const prio = prioridadeFormaGenerica(a) - prioridadeFormaGenerica(b);
      if (prio !== 0) return prio;
    }
    return (b._match?.score || 0) - (a._match?.score || 0);
  });

  return enriched.filter((item) =>
    passaCorteScoreFormaEspecifica(termo, item._match?.score),
  );
}

const PAGE_SIZE_NORMAL = 20;
const PAGE_SIZE_EXAUSTIVO = 20;

export function useAnvisaSearch() {
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const [exaustivo, setExaustivo] = useState(false);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const timeout = setTimeout(() => setTermoDebounced(termo), 400);
    return () => clearTimeout(timeout);
  }, [termo]);

  // Reset pagination whenever the term or mode changes
  useEffect(() => { setPage(1); }, [termoDebounced, exaustivo]);

  const { data: resultados, isLoading, isError } = useQuery({
    queryKey: ['anvisa-search', termoDebounced, exaustivo],
    queryFn: () => buscarConstituintes(termoDebounced, exaustivo),
    enabled: termoDebounced.length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const buscar = useCallback((novoTermo: string) => {
    setTermo(novoTermo);
  }, []);

  const limpar = useCallback(() => {
    setTermo('');
    setTermoDebounced('');
  }, []);

  const all = resultados || [];
  const pageSize = exaustivo ? PAGE_SIZE_EXAUSTIVO : PAGE_SIZE_NORMAL;
  const visibleCount = Math.min(all.length, page * pageSize);
  const resultadosVisiveis = all.slice(0, visibleCount);
  const podeCarregarMais = visibleCount < all.length;
  const carregarMais = useCallback(() => setPage((p) => p + 1), []);

  return {
    termo,
    resultados: resultadosVisiveis,
    resultadosTotal: all.length,
    podeCarregarMais,
    carregarMais,
    isLoading,
    isError,
    buscar,
    limpar,
    exaustivo,
    setExaustivo,
  };
}
