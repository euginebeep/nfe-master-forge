import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  return useQuery({
    queryKey: ['notas-entrada'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_entrada')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as NotaEntrada[];
    },
  });
}

export function useNotaEntradaItems(notaId: string | undefined) {
  return useQuery({
    queryKey: ['nota-entrada-items', notaId],
    enabled: !!notaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_entrada_itens')
        .select('*')
        .eq('nota_entrada_id', notaId!);

      if (error) throw error;
      return (data || []) as unknown as NotaEntradaItem[];
    },
  });
}

// Check if NF-e already exists by chave
export async function checkNFeExistsByChave(chave: string): Promise<NotaEntrada | null> {
  const { data } = await supabase
    .from('notas_entrada')
    .select('*')
    .eq('chave_nfe', chave)
    .maybeSingle();

  return (data as unknown as NotaEntrada) || null;
}

// Save nota entrada
export async function saveNotaEntrada(input: Omit<NotaEntrada, 'id'>): Promise<NotaEntrada> {
  const { data, error } = await supabase
    .from('notas_entrada')
    .insert(input as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as NotaEntrada;
}

// Save nota entrada item
export async function saveNotaEntradaItem(input: Omit<NotaEntradaItem, 'id'>): Promise<NotaEntradaItem> {
  const { data, error } = await supabase
    .from('notas_entrada_itens')
    .insert(input as any)
    .select()
    .single();

  if (error) throw error;
  return data as unknown as NotaEntradaItem;
}
