import { useEffect, useMemo, useState } from 'react';
import { LocalDb } from '@/lib/local-db';
import type { LocalEstoqueLote } from '@/hooks/use-local-itens';
import type { TipoPotencia } from '@/types/formulas-industrial';

// ========================================
// LOTES DISPONÍVEIS PARA FORMULAÇÃO
// Fonte de verdade: estoque_lotes (NF-e / entrada)
// Potência vem do COA e é registrada NO LOTE.
// ========================================

export type LoteEstoqueParaFormulacao = LocalEstoqueLote & {
  tipo_potencia?: TipoPotencia;
  potencia_valor?: number;
  potencia_unidade?: string;
};

/**
 * Hook para obter lotes disponíveis de um item (matéria-prima) específico.
 * REGRA: só lotes em status DISPONIVEL entram na formulação.
 */
export function useLotesDoItem(item_id: string | undefined) {
  const [lotes, setLotes] = useState<LoteEstoqueParaFormulacao[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!item_id) {
      setLotes([]);
      return;
    }

    setLoading(true);
    const data = LocalDb.getCollection<LoteEstoqueParaFormulacao>('estoque_lotes')
      .filter(l => l.item_id === item_id && l.status === 'DISPONIVEL');

    // FEFO - primeiro a vencer, primeiro a sair
    data.sort((a, b) => {
      if (!a.data_val && !b.data_val) return 0;
      if (!a.data_val) return 1;
      if (!b.data_val) return -1;
      return new Date(a.data_val).getTime() - new Date(b.data_val).getTime();
    });

    setLotes(data);
    setLoading(false);
  }, [item_id]);

  // Também expor um resumo (útil para UI)
  const comPotencia = useMemo(
    () => lotes.filter(l => !!l.tipo_potencia && l.tipo_potencia !== 'NENHUMA' && !!l.potencia_valor),
    [lotes]
  );

  return { lotes, comPotencia, isLoading: loading };
}

/**
 * Formata potência para exibição
 */
export function formatarPotencia(tipo: TipoPotencia | undefined, valor?: number): string {
  if (!tipo || tipo === 'NENHUMA' || !valor) return '-';

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
