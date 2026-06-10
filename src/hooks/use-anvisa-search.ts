import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AnvisaConstituinte } from '@/types/anvisa';

async function resolverNomesCientificos(termo: string): Promise<string[]> {
  if (!termo || termo.length < 2) return [termo];

  try {
    const { data, error } = await supabase.functions.invoke('anvisa-resolve-name', {
      body: { termo },
    });

    if (error || !data?.termos?.length) return [termo];
    return data.termos;
  } catch {
    return [termo];
  }
}

async function buscarPorTermo(termo: string, exaustivo = false): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  const { data: fullText } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .textSearch('search_vector', termo, { type: 'websearch', config: 'portuguese' })
    .limit(exaustivo ? 100 : 20);

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
    .limit(exaustivo ? 100 : 20);

  const { data: arraySearch } = await supabase
    .rpc('buscar_constituinte_por_nome_popular', { termo_busca: termo })
    .limit(exaustivo ? 100 : 20);

  const all = [...(fullText || []), ...(ilike || []), ...(arraySearch || [])] as unknown as AnvisaConstituinte[];
  
  // Post-filter: if a term looks like "vitamina X", only keep results matching that specific vitamin
  // (skipped in exaustivo mode — user explicitly wants everything related)
  const vitaminMatch = !exaustivo && termo.trim().toLowerCase().match(/^vitamina\s+([a-z]\d*)\s*$/i);
  if (vitaminMatch) {
    const vitLetter = vitaminMatch[1].toLowerCase();
    const filtered = all.filter((item) => {
      const names = [item.nome_tecnico, item.nome_generico || '', item.nome_rotulo || '', ...(item.nome_popular || []), ...(item.sinonimos || [])];
      return names.some((n) => {
        const lower = n.toLowerCase();
        // Match "vitamina E" but not "vitamina E..." or other vitamins
        return lower.includes(`vitamina ${vitLetter}`) && 
          !new RegExp(`vitamina ${vitLetter}[a-z0-9]`, 'i').test(lower);
      });
    });
    if (filtered.length > 0) return filtered;
  }
  
  return all;
}

async function buscarFuzzy(termo: string, exaustivo = false): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  // Skip fuzzy for very common generic terms like "vitamina e" to avoid noise (but allow in exaustivo)
  if (!exaustivo) {
    const vitaminMatch = termo.trim().toLowerCase().match(/^vitamina\s+[a-z]\d?\s*$/i);
    if (vitaminMatch) return [];
  }

  const { data } = await supabase
    .rpc('buscar_constituinte_fuzzy', { termo_busca: termo })
    .limit(exaustivo ? 50 : 10);

  // Filter low-relevance fuzzy results (broader threshold in exaustivo mode)
  const threshold = exaustivo ? 0.12 : 0.25;
  return ((data || []) as any[]).filter((d) => {
    if (d.similaridade !== undefined) return d.similaridade > threshold;
    return true;
  }) as unknown as AnvisaConstituinte[];
}

async function buscarConstituintes(termo: string, exaustivo = false): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  // Step 1: Use AI to resolve popular/abbreviated names to scientific names
  const termosExpandidos = await resolverNomesCientificos(termo);

  // Step 2: Search for ALL resolved terms in parallel (text search + fuzzy)
  const resultadosPorTermo = await Promise.all([
    ...termosExpandidos.map((t) => buscarPorTermo(t, exaustivo)),
    ...termosExpandidos.map((t) => buscarFuzzy(t, exaustivo)),
  ]);

  // Step 3: Deduplicate results by ID
  const mapa = new Map<string, AnvisaConstituinte>();
  resultadosPorTermo.flat().forEach((item) => {
    mapa.set(item.id, item);
  });

  return Array.from(mapa.values());
}

export function useAnvisaSearch() {
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');
  const [exaustivo, setExaustivo] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setTermoDebounced(termo), 400);
    return () => clearTimeout(timeout);
  }, [termo]);

  const { data: resultados, isLoading, isError } = useQuery({
    queryKey: ['anvisa-search', termoDebounced, exaustivo],
    queryFn: () => buscarConstituintes(termoDebounced, exaustivo),
    enabled: termoDebounced.length >= 2,
    staleTime: 10 * 60 * 1000,
  });

  const buscar = useCallback((novoTermo: string) => {
    setTermo(novoTermo);
  }, []);

  const limpar = useCallback(() => {
    setTermo('');
    setTermoDebounced('');
  }, []);

  return {
    termo,
    resultados: resultados || [],
    isLoading,
    isError,
    buscar,
    limpar,
    exaustivo,
    setExaustivo,
  };
}
