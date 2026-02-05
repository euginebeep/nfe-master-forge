import { useState, useEffect, useCallback } from 'react';
import { LocalDb } from '@/lib/local-db';

export interface NotaEntrada {
  id: string;
  chave_nfe: string;
  numero: string;
  serie: string;
  modelo: string;
  dh_emissao: string;
  fornecedor_id?: string;
  fornecedor_razao?: string;
  fornecedor_cnpj?: string;
  total_produtos: number;
  total_nota: number;
  status: 'IMPORTADA' | 'PROCESSADA' | 'CANCELADA';
  xml_raw?: string;
  created_at?: string;
}

export interface NotaEntradaItem {
  id: string;
  nota_entrada_id: string;
  item_id?: string;
  codigo_fornecedor: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  ucom: string;
  qcom: number;
  vuncom: number;
  vprod: number;
}

export function useNotasEntrada() {
  const [notas, setNotas] = useState<NotaEntrada[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    const data = LocalDb.getCollection<NotaEntrada>('notas_entrada');
    // Sort by created_at desc
    data.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return dateB - dateA;
    });
    setNotas(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data: notas, isLoading: loading, refresh };
}

export function useNotaEntradaItems(notaId: string | undefined) {
  const [items, setItems] = useState<NotaEntradaItem[]>([]);

  const refresh = useCallback(() => {
    if (!notaId) return;
    const data = LocalDb.query<NotaEntradaItem>('notas_entrada_itens', i => i.nota_entrada_id === notaId);
    setItems(data);
  }, [notaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, refresh };
}

// Check if NF-e already exists by chave
export function checkNFeExistsByChave(chave: string): NotaEntrada | null {
  const notas = LocalDb.getCollection<NotaEntrada>('notas_entrada');
  return notas.find(n => n.chave_nfe === chave) || null;
}

// Save nota entrada
export function saveNotaEntrada(data: Omit<NotaEntrada, 'id'>): NotaEntrada {
  return LocalDb.insert<NotaEntrada>('notas_entrada', data);
}

// Save nota entrada item
export function saveNotaEntradaItem(data: Omit<NotaEntradaItem, 'id'>): NotaEntradaItem {
  return LocalDb.insert<NotaEntradaItem>('notas_entrada_itens', data);
}
