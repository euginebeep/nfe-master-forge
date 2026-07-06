import { supabase } from '@/integrations/supabase/client';
import type { ItemListaPura } from '@/components/compras/ListaPuraCompraPanel';
import type { RequisicaoCompraItem } from '@/hooks/use-requisicoes-compra';

export interface BlocoRfqFornecedor {
  fornecedorId: string | null;
  fornecedorNome: string;
  itens: ItemListaPura[];
}

const SEM_FORNECEDOR_KEY = '__sem_fornecedor__';

export async function montarBlocosRfqPorFornecedor(
  itens: RequisicaoCompraItem[],
): Promise<BlocoRfqFornecedor[]> {
  const itemIds = [...new Set(itens.map(i => i.item_id).filter(Boolean))] as string[];

  type FornRow = {
    item_id: string;
    fornecedor_id: string;
    fornecedor?: { razao_social: string; nome_fantasia: string | null } | null;
  };

  const fornecedoresPorItem = new Map<string, FornRow[]>();

  if (itemIds.length > 0) {
    const { data, error } = await supabase
      .from('item_fornecedores')
      .select(`
        item_id, fornecedor_id,
        fornecedor:entidades!item_fornecedores_fornecedor_id_fkey(razao_social, nome_fantasia)
      `)
      .in('item_id', itemIds);

    if (error) throw error;

    for (const row of (data || []) as unknown as FornRow[]) {
      if (!row.item_id) continue;
      const list = fornecedoresPorItem.get(row.item_id) || [];
      list.push(row);
      fornecedoresPorItem.set(row.item_id, list);
    }
  }

  const blocosMap = new Map<string, BlocoRfqFornecedor>();

  for (const item of itens) {
    const linha: ItemListaPura = {
      nome: item.item_nome,
      quantidade: item.quantidade_faltante,
      unidade: item.unidade,
    };

    const forns = item.item_id ? fornecedoresPorItem.get(item.item_id) : null;

    if (!forns || forns.length === 0) {
      const bloco = blocosMap.get(SEM_FORNECEDOR_KEY) || {
        fornecedorId: null,
        fornecedorNome: 'Sem fornecedor — cadastrar',
        itens: [],
      };
      bloco.itens.push(linha);
      blocosMap.set(SEM_FORNECEDOR_KEY, bloco);
      continue;
    }

    for (const f of forns) {
      const key = f.fornecedor_id;
      const nome = f.fornecedor?.nome_fantasia || f.fornecedor?.razao_social || 'Fornecedor';
      const bloco = blocosMap.get(key) || {
        fornecedorId: key,
        fornecedorNome: nome,
        itens: [],
      };
      bloco.itens.push(linha);
      blocosMap.set(key, bloco);
    }
  }

  const comFornecedor = [...blocosMap.values()].filter(b => b.fornecedorId !== null);
  const semFornecedor = blocosMap.get(SEM_FORNECEDOR_KEY);
  if (semFornecedor) comFornecedor.push(semFornecedor);

  return comFornecedor;
}
