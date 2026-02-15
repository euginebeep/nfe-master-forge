import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { AnvisaConstituinte } from '@/types/anvisa';

function useDebounce(value: string, delay: number): string {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useState(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  });

  // Simple implementation using useEffect pattern
  import('react').then(({ useEffect }) => {
    // This won't work as expected, use inline approach instead
  });

  return debouncedValue;
}

async function buscarConstituintes(termo: string): Promise<AnvisaConstituinte[]> {
  if (!termo || termo.length < 2) return [];

  // Full-text search
  const { data: fullText } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .textSearch('search_vector', termo, { type: 'websearch', config: 'portuguese' })
    .eq('ativo', true)
    .limit(20);

  // ILIKE fallback
  const { data: ilike } = await supabase
    .from('anvisa_constituintes')
    .select('*')
    .or(`nome_tecnico.ilike.%${termo}%,nome_generico.ilike.%${termo}%`)
    .eq('ativo', true)
    .limit(20);

  // RPC for array search
  const { data: arraySearch } = await supabase
    .rpc('buscar_constituinte_por_nome_popular', { termo_busca: termo })
    .limit(20);

  // Deduplicate
  const mapa = new Map<string, AnvisaConstituinte>();
  [...(fullText || []), ...(ilike || []), ...(arraySearch || [])].forEach((r) => {
    const item = r as unknown as AnvisaConstituinte;
    mapa.set(item.id, item);
  });

  // Log search (fire-and-forget)
  const firstResult = mapa.size > 0 ? Array.from(mapa.values())[0] : null;
  supabase.auth.getUser().then(({ data: { user } }) => {
    if (user) {
      supabase.from('anvisa_consultas_log').insert({
        user_id: user.id,
        termo_buscado: termo,
        constituinte_encontrado_id: firstResult?.id || null,
        resultado_encontrado: mapa.size > 0,
      });
    }
  });

  return Array.from(mapa.values());
}

export function useAnvisaSearch() {
  const [termo, setTermo] = useState('');
  const [termoDebounced, setTermoDebounced] = useState('');

  // Manual debounce
  const buscar = useCallback((novoTermo: string) => {
    setTermo(novoTermo);
    const timeout = setTimeout(() => setTermoDebounced(novoTermo), 300);
    return () => clearTimeout(timeout);
  }, []);

  const { data: resultados, isLoading, isError } = useQuery({
    queryKey: ['anvisa-search', termoDebounced],
    queryFn: () => buscarConstituintes(termoDebounced),
    enabled: termoDebounced.length >= 2,
    staleTime: 10 * 60 * 1000,
  });

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
