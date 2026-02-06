import { useState, useEffect, useCallback, useMemo } from 'react';
import { LocalDb } from '@/lib/local-db';
import { LoteFormulacao } from '@/types/lote-formulacao';
import { TipoPotencia } from '@/types/formulas-industrial';
import { toast } from 'sonner';

// ========================================
// HOOK PARA LOTES DE INSUMOS (FORMULAÇÃO)
// ========================================

/**
 * Hook para gerenciar lotes de insumos com potência
 * REGRA MESTRE: Potência é atributo do LOTE
 */
export function useLotesFormulacao(filters?: { insumo_id?: string; status?: string }) {
  const [lotes, setLotes] = useState<LoteFormulacao[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    let data = LocalDb.getCollection<LoteFormulacao>('lotes_formulacao' as any);
    
    if (filters?.insumo_id) {
      data = data.filter(l => l.insumo_id === filters.insumo_id);
    }
    
    if (filters?.status) {
      data = data.filter(l => l.status === filters.status);
    }
    
    // Ordenar por validade (mais próximo primeiro)
    data.sort((a, b) => {
      if (!a.data_validade && !b.data_validade) return 0;
      if (!a.data_validade) return 1;
      if (!b.data_validade) return -1;
      return new Date(a.data_validade).getTime() - new Date(b.data_validade).getTime();
    });
    
    setLotes(data);
    setLoading(false);
  }, [filters?.insumo_id, filters?.status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection;
      if (!collection || collection === '*' || collection === 'lotes_formulacao') {
        refresh();
      }
    };
    window.addEventListener('localdb:change', handler);
    return () => window.removeEventListener('localdb:change', handler);
  }, [refresh]);

  const create = useCallback((data: Omit<LoteFormulacao, 'id' | 'created_at' | 'updated_at'>) => {
    const lote = LocalDb.insert<LoteFormulacao>('lotes_formulacao' as any, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    toast.success('Lote cadastrado');
    return lote;
  }, []);

  const update = useCallback((id: string, data: Partial<LoteFormulacao>) => {
    const updated = LocalDb.update<LoteFormulacao>('lotes_formulacao' as any, id, {
      ...data,
      updated_at: new Date().toISOString(),
    });
    if (updated) toast.success('Lote atualizado');
    return updated;
  }, []);

  const remove = useCallback((id: string) => {
    LocalDb.remove('lotes_formulacao' as any, id);
    toast.success('Lote excluído');
  }, []);

  // Filtros úteis
  const disponiveis = useMemo(() => lotes.filter(l => l.status === 'DISPONIVEL'), [lotes]);
  
  return {
    data: lotes,
    disponiveis,
    isLoading: loading,
    refresh,
    create,
    update,
    remove,
  };
}

/**
 * Hook para obter lotes disponíveis de um insumo específico
 */
export function useLotesDoInsumo(insumo_id: string | undefined) {
  const [lotes, setLotes] = useState<LoteFormulacao[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!insumo_id) {
      setLotes([]);
      return;
    }
    
    setLoading(true);
    const data = LocalDb.getCollection<LoteFormulacao>('lotes_formulacao' as any)
      .filter(l => l.insumo_id === insumo_id && l.status === 'DISPONIVEL');
    
    // Ordenar por validade (FEFO - primeiro a vencer, primeiro a sair)
    data.sort((a, b) => {
      if (!a.data_validade && !b.data_validade) return 0;
      if (!a.data_validade) return 1;
      if (!b.data_validade) return -1;
      return new Date(a.data_validade).getTime() - new Date(b.data_validade).getTime();
    });
    
    setLotes(data);
    setLoading(false);
  }, [insumo_id]);

  return { lotes, isLoading: loading };
}

/**
 * Cria um lote de demonstração para Vitamina D3 com potência 400.000 UI/g
 */
export function criarLoteDemoVitaminaD(insumo_id: string): LoteFormulacao {
  return {
    id: crypto.randomUUID(),
    insumo_id,
    numero_lote: 'VITD3-2025-001',
    fornecedor_nome: 'DSM Nutritional Products',
    data_fabricacao: '2025-01-15',
    data_validade: '2027-01-14',
    tipo_potencia: 'UI_POR_GRAMA',
    potencia_valor: 400000,
    potencia_unidade: 'UI/g',
    quantidade_disponivel: 500,
    unidade_estoque: 'g',
    custo_por_kg: 2500,
    status: 'DISPONIVEL',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Formata potência para exibição
 */
export function formatarPotencia(tipo: TipoPotencia, valor?: number): string {
  if (!valor || tipo === 'NENHUMA') return '-';
  
  switch (tipo) {
    case 'UI_POR_GRAMA':
      return `${valor.toLocaleString('pt-BR')} UI/g`;
    case 'MG_POR_GRAMA':
      return `${valor.toLocaleString('pt-BR')} mg/g`;
    case 'PERCENTUAL':
      return `${(valor * 100).toFixed(2)}%`;
    default:
      return String(valor);
  }
}
