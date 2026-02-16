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

async function buscarPorTermo(termo: string): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  const { data: fullText } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .textSearch('search_vector', termo, { type: 'websearch', config: 'portuguese' })
    .eq('ativo', true)
    .limit(20);

  const { data: ilike } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .or(`nome_tecnico.ilike.%${termo}%,nome_generico.ilike.%${termo}%,nome_rotulo.ilike.%${termo}%`)
    .eq('ativo', true)
    .limit(20);

  const { data: arraySearch } = await supabase
    .rpc('buscar_constituinte_por_nome_popular', { termo_busca: termo })
    .limit(20);

  return [...(fullText || []), ...(ilike || []), ...(arraySearch || [])] as unknown as AnvisaConstituinte[];
}

async function buscarConstituintes(termo: string): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  // Step 1: Use AI to resolve popular/abbreviated names to scientific names
  const termosExpandidos = await resolverNomesCientificos(termo);

  // Step 2: Search for ALL resolved terms in parallel
  const resultadosPorTermo = await Promise.all(
    termosExpandidos.map((t) => buscarPorTermo(t))
  );

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

  useEffect(() => {
    const timeout = setTimeout(() => setTermoDebounced(termo), 400);
    return () => clearTimeout(timeout);
  }, [termo]);

  const { data: resultados, isLoading, isError } = useQuery({
    queryKey: ['anvisa-search', termoDebounced],
    queryFn: () => buscarConstituintes(termoDebounced),
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
  };
}
