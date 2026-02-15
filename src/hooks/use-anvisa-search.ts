import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AnvisaConstituinte } from '@/types/anvisa';

async function buscarConstituintes(termo: string): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  // Full-text search (covers nome_tecnico, nome_generico, nome_popular, sinonimos via tsvector)
  const { data: fullText } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .textSearch('search_vector', termo, { type: 'websearch', config: 'portuguese' })
    .eq('ativo', true)
    .limit(20);

  // ILIKE fallback on text columns
  const { data: ilike } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .or(`nome_tecnico.ilike.%${termo}%,nome_generico.ilike.%${termo}%,nome_rotulo.ilike.%${termo}%`)
    .eq('ativo', true)
    .limit(20);

  // RPC search for array fields (nome_popular, sinonimos) with unaccent
  const { data: arraySearch } = await supabase
    .rpc('buscar_constituinte_por_nome_popular', { termo_busca: termo })
    .limit(20);

  const mapa = new Map<string, AnvisaConstituinte>();
  [...(fullText || []), ...(ilike || []), ...(arraySearch || [])].forEach((r) => {
    const item = r as unknown as AnvisaConstituinte;
    mapa.set(item.id, item);
  });

  return Array.from(mapa.values());
}

export function useAnvisaSearch() {
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setTermoDebounced(termo), 300);
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
