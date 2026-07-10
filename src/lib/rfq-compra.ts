import { supabase } from '@/integrations/supabase/client';
import type { GrupoListaCotacao } from '@/components/compras/ListaPuraCompraPanel';
import type { RequisicaoCompraItem } from '@/hooks/use-requisicoes-compra';
import {
  grupoCategoria,
  ORDEM_CATEGORIAS_RFQ,
  resolverEmbalagemCotacao,
} from '@/lib/cotacao-embalagem';

export interface BlocoRfqFornecedor {
  fornecedorId: string | null;
  fornecedorNome: string;
  grupos: GrupoListaCotacao[];
}

const SEM_FORNECEDOR_KEY = '__sem_fornecedor__';

export interface ItemCestaCompra {
  item_id: string;
  item_nome: string;
  tipo_item: string | null;
  unidade: string | null;
  total_falta: number;
  embalagem_compra_qtd?: number | null;
  embalagem_compra_unidade?: string | null;
  ultimo_fornecedor_id?: string | null;
}

export interface FornecedorEscolhidoRfq {
  id: string;
  nome: string;
}

type FornRow = {
  item_id: string;
  fornecedor_id: string;
  qtd_por_pacote: number | null;
  unidade_compra_padrao: string | null;
  fornecedor?: { razao_social: string; nome_fantasia: string | null } | null;
};

type HistRow = {
  item_id: string;
  fornecedor_id: string;
  ultima_unidade: string | null;
  ultima_qtd: number | null;
};

function historicoKey(itemId: string, fornecedorId: string) {
  return `${itemId}:${fornecedorId}`;
}

function montarGrupos(
  linhas: Array<{ nome: string; qtd: string; categoria: string }>,
): GrupoListaCotacao[] {
  const porCategoria = new Map<string, GrupoListaCotacao['itens']>();

  for (const linha of linhas) {
    const itens = porCategoria.get(linha.categoria) || [];
    itens.push({ nome: linha.nome, qtd: linha.qtd });
    porCategoria.set(linha.categoria, itens);
  }

  return ORDEM_CATEGORIAS_RFQ
    .filter(cat => (porCategoria.get(cat)?.length ?? 0) > 0)
    .map(categoria => ({
      categoria,
      itens: porCategoria.get(categoria)!,
    }));
}

export async function montarBlocosRfqPorFornecedor(
  itens: RequisicaoCompraItem[],
  companyId: string,
): Promise<BlocoRfqFornecedor[]> {
  const itemIds = [...new Set(itens.map(i => i.item_id).filter(Boolean))] as string[];

  const tipoPorItem = new Map<string, string | null>();
  const fornecedoresPorItem = new Map<string, FornRow[]>();
  const historicoMap = new Map<string, HistRow>();

  if (itemIds.length > 0) {
    const [itensRes, fornRes, histRes] = await Promise.all([
      supabase.from('itens').select('id, tipo_item').in('id', itemIds),
      supabase
        .from('item_fornecedores')
        .select(`
          item_id, fornecedor_id, qtd_por_pacote, unidade_compra_padrao,
          fornecedor:entidades!item_fornecedores_fornecedor_id_fkey(razao_social, nome_fantasia)
        `)
        .in('item_id', itemIds),
      supabase
        .from('item_fornecedor_historico' as 'itens')
        .select('item_id, fornecedor_id, ultima_unidade, ultima_qtd')
        .in('item_id', itemIds)
        .eq('company_id', companyId),
    ]);

    if (itensRes.error) throw itensRes.error;
    if (fornRes.error) throw fornRes.error;
    if (histRes.error) throw histRes.error;

    for (const row of (itensRes.data || []) as Array<{ id: string; tipo_item: string | null }>) {
      tipoPorItem.set(row.id, row.tipo_item ?? null);
    }

    for (const row of (fornRes.data || []) as unknown as FornRow[]) {
      if (!row.item_id) continue;
      const list = fornecedoresPorItem.get(row.item_id) || [];
      list.push(row);
      fornecedoresPorItem.set(row.item_id, list);
    }

    for (const row of (histRes.data || []) as unknown as HistRow[]) {
      if (!row.item_id || !row.fornecedor_id) continue;
      historicoMap.set(historicoKey(row.item_id, row.fornecedor_id), row);
    }
  }

  const linhasPorBloco = new Map<string, Array<{ nome: string; qtd: string; categoria: string }>>();
  const metaBloco = new Map<string, { fornecedorId: string | null; fornecedorNome: string }>();

  for (const item of itens) {
    const tipoItem = item.item_id ? (tipoPorItem.get(item.item_id) ?? null) : null;
    const categoria = grupoCategoria(tipoItem);
    const forns = item.item_id ? fornecedoresPorItem.get(item.item_id) : null;

    if (!forns || forns.length === 0) {
      const emb = resolverEmbalagemCotacao(item, {
        qtd_por_pacote: null,
        unidade_compra_padrao: item.unidade,
        ultima_unidade: null,
      });
      const linhas = linhasPorBloco.get(SEM_FORNECEDOR_KEY) || [];
      linhas.push({ nome: item.item_nome, qtd: emb.texto, categoria });
      linhasPorBloco.set(SEM_FORNECEDOR_KEY, linhas);
      if (!metaBloco.has(SEM_FORNECEDOR_KEY)) {
        metaBloco.set(SEM_FORNECEDOR_KEY, {
          fornecedorId: null,
          fornecedorNome: 'Sem fornecedor — cadastrar',
        });
      }
      continue;
    }

    for (const f of forns) {
      const key = f.fornecedor_id;
      const hist = item.item_id ? historicoMap.get(historicoKey(item.item_id, key)) : null;
      const emb = resolverEmbalagemCotacao(item, {
        qtd_por_pacote: f.qtd_por_pacote,
        unidade_compra_padrao: f.unidade_compra_padrao,
        ultima_unidade: hist?.ultima_unidade ?? null,
        ultima_qtd: hist?.ultima_qtd ?? null,
      });

      const linhas = linhasPorBloco.get(key) || [];
      linhas.push({ nome: item.item_nome, qtd: emb.texto, categoria });
      linhasPorBloco.set(key, linhas);

      if (!metaBloco.has(key)) {
        metaBloco.set(key, {
          fornecedorId: key,
          fornecedorNome: f.fornecedor?.nome_fantasia || f.fornecedor?.razao_social || 'Fornecedor',
        });
      }
    }
  }

  const comFornecedor = [...metaBloco.entries()]
    .filter(([k]) => k !== SEM_FORNECEDOR_KEY)
    .map(([key, meta]) => ({
      fornecedorId: meta.fornecedorId,
      fornecedorNome: meta.fornecedorNome,
      grupos: montarGrupos(linhasPorBloco.get(key) || []),
    }));

  const semMeta = metaBloco.get(SEM_FORNECEDOR_KEY);
  if (semMeta) {
    comFornecedor.push({
      fornecedorId: null,
      fornecedorNome: semMeta.fornecedorNome,
      grupos: montarGrupos(linhasPorBloco.get(SEM_FORNECEDOR_KEY) || []),
    });
  }

  return comFornecedor;
}

/** Cesta consolidada: mesmo texto de itens para cada fornecedor escolhido (comparar preços). */
export function montarRfqParaFornecedores(
  itensCesta: ItemCestaCompra[],
  fornecedoresEscolhidos: FornecedorEscolhidoRfq[],
): BlocoRfqFornecedor[] {
  const linhas = itensCesta.map((item) => {
    const emb = resolverEmbalagemCotacao(
      {
        quantidade_faltante: item.total_falta,
        unidade: item.unidade,
        tipo_item: item.tipo_item,
      },
      {
        qtd_por_pacote: item.embalagem_compra_qtd ?? null,
        unidade_compra_padrao: item.embalagem_compra_unidade ?? item.unidade,
      },
    );
    return {
      nome: item.item_nome,
      qtd: emb.texto,
      categoria: grupoCategoria(item.tipo_item),
    };
  });

  const grupos = montarGrupos(linhas);

  return fornecedoresEscolhidos.map((fornecedor) => ({
    fornecedorId: fornecedor.id,
    fornecedorNome: fornecedor.nome,
    grupos,
  }));
}
