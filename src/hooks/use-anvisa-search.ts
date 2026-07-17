import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AnvisaConstituinte } from '@/types/anvisa';
import {
  detectarFormaPedida,
  filtrarResultadosPorForma,
  filtrarTermosExpandidosPorForma,
  labelFormaResultado,
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

async function buscarPorTermo(termo: string, exaustivo = false, limit?: number): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  const cap = limit ?? (exaustivo ? 60 : 20);

  const { data: fullText } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .textSearch('search_vector', termo, { type: 'websearch', config: 'portuguese' })
    .limit(cap);

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

  const { data: arraySearch } = await supabase
    .rpc('buscar_constituinte_por_nome_popular', { termo_busca: termo })
    .limit(cap);

  const all = [...(fullText || []), ...(ilike || []), ...(arraySearch || [])] as unknown as AnvisaConstituinte[];

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

function computeMatch(item: AnvisaConstituinte, termo: string, sinonimos: string[]): AnvisaMatchInfo {
  const termoN = norm(termo);
  const sinN = sinonimos.map(norm).filter((s) => s && s !== termoN);
  const allTerms = [termoN, ...sinN].filter(Boolean);

  const candidates: Array<{ field: string; values: string[] }> = [
    { field: 'nome_técnico', values: [item.nome_tecnico] },
    { field: 'nome_genérico', values: [item.nome_generico || ''] },
    { field: 'nome_rótulo', values: [item.nome_rotulo || ''] },
    { field: 'nomes_populares', values: item.nome_popular || [] },
    { field: 'sinônimos', values: item.sinonimos || [] },
    { field: 'categoria', values: [item.categoria || ''] },
    { field: 'subcategoria', values: [item.subcategoria || ''] },
    { field: 'fonte', values: [item.fonte_de || ''] },
    { field: 'CAS', values: [item.cas_number || ''] },
    { field: 'restrições', values: [item.restricoes_uso || ''] },
  ];

  const matchedFields = new Set<string>();
  const matchedSynonyms = new Set<string>();
  let score = 0;

  for (const c of candidates) {
    for (const raw of c.values) {
      const v = norm(raw);
      if (!v) continue;
      for (const t of allTerms) {
        if (!t || t.length < 2) continue;
        if (v === t) { score += 5; matchedFields.add(c.field); if (t !== termoN) matchedSynonyms.add(t); }
        else if (v.includes(t)) { score += 2; matchedFields.add(c.field); if (t !== termoN) matchedSynonyms.add(t); }
      }
    }
  }

  // Normalize to 0-100
  const normalized = Math.min(100, Math.round((score / 20) * 100));
  return {
    score: normalized,
    fields: Array.from(matchedFields),
    synonyms: Array.from(matchedSynonyms),
  };
}

async function buscarConstituintes(termo: string, exaustivo = false, limit?: number): Promise<AnvisaSearchResult[]> {
  if (!termo || termo.length < 2) return [];

  // Step 1: Use AI to resolve popular/abbreviated names to scientific names
  const termosExpandidos = await resolverNomesCientificos(termo);

  // Step 2: Search for ALL resolved terms in parallel (text search + fuzzy)
  const resultadosPorTermo = await Promise.all([
    ...termosExpandidos.map((t) => buscarPorTermo(t, exaustivo, limit)),
    ...termosExpandidos.map((t) => buscarFuzzy(t, exaustivo, limit)),
  ]);

  // Step 3: Deduplicate results by ID
  const mapa = new Map<string, AnvisaConstituinte>();
  resultadosPorTermo.flat().forEach((item) => {
    mapa.set(item.id, item);
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
  return enriched;
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
