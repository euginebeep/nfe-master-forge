// NF-e Item Matcher — Match XML items to existing products via Supabase
import { supabase } from '@/integrations/supabase/client';
import type { NFeItemParsed } from '@/types/erp';
import type { LocalItem } from '@/hooks/use-local-itens';

export interface MatchedItem {
  xmlItem: NFeItemParsed;
  matchedProduct: LocalItem | null;
  matchType: 'EAN' | 'CODIGO_FORNECEDOR' | 'NCM_DESCRICAO' | 'NAO_ENCONTRADO';
  confidence: number; // 0-100
  tipoClassificacao?: string; // User-selected classification
  loteManual?: {
    numero: string;
    dataFab?: string;
    dataVal?: string;
  };
  fatorConversao: number;
}

// Normalize string for fuzzy matching
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')
    .trim();
}

// Calculate similarity between two strings (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);

  if (s1 === s2) return 1;
  if (!s1 || !s2) return 0;

  const words1 = new Set(s1.split(' ').filter((w) => w.length > 2));
  const words2 = new Set(s2.split(' ').filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0;

  let matches = 0;
  words1.forEach((w) => {
    if (words2.has(w)) matches++;
  });

  return matches / Math.max(words1.size, words2.size);
}

/**
 * Faz o matching dos itens do XML com os produtos cadastrados no Supabase.
 * Agora é assíncrono — deve ser chamado com await.
 */
export async function matchXmlItems(
  xmlItems: NFeItemParsed[],
  fornecedorCnpj: string
): Promise<MatchedItem[]> {
  // Coletar todos os EANs e NCMs únicos do XML para busca em lote
  const eans = xmlItems
    .map((i) => i.cEAN)
    .filter((e): e is string => !!e && e !== 'SEM GTIN');
  const ncms = [...new Set(xmlItems.map((i) => i.NCM).filter(Boolean))];
  const cProds = xmlItems.map((i) => i.cProd).filter(Boolean);

  // Buscar produtos por EAN
  const { data: produtosPorEan } = eans.length
    ? await supabase
        .from('itens')
        .select(
          'id, sku_interno, descricao_interna, descricao_comercial, tipo_item, ncm, ean, unidade_interna, unidade_fornecedor, fator_conversao, controla_lote, controla_validade, criticidade, ativo'
        )
        .in('ean', eans)
        .eq('ativo', true)
    : { data: [] };

  // Buscar produtos por NCM
  const { data: produtosPorNcm } = ncms.length
    ? await supabase
        .from('itens')
        .select(
          'id, sku_interno, descricao_interna, descricao_comercial, tipo_item, ncm, ean, unidade_interna, unidade_fornecedor, fator_conversao, controla_lote, controla_validade, criticidade, ativo'
        )
        .in('ncm', ncms)
        .eq('ativo', true)
    : { data: [] };

  // Buscar fornecedor pelo CNPJ
  const cnpjLimpo = fornecedorCnpj.replace(/\D/g, '');
  const { data: fornecedorData } = await supabase
    .from('entidades')
    .select('id')
    .ilike('documento', `%${cnpjLimpo}%`)
    .limit(1)
    .maybeSingle();

  // Buscar item_fornecedores se o fornecedor foi encontrado
  let itemFornecedoresMap: Record<string, { item_id: string; fator_para_unidade_interna: number }> = {};
  if (fornecedorData?.id && cProds.length) {
    const { data: itemFornData } = await supabase
      .from('item_fornecedores')
      .select('item_id, codigo_fornecedor, fator_para_unidade_interna')
      .eq('fornecedor_id', fornecedorData.id)
      .in('codigo_fornecedor', cProds as string[]);

    (itemFornData || []).forEach((f) => {
      itemFornecedoresMap[f.codigo_fornecedor] = {
        item_id: f.item_id,
        fator_para_unidade_interna: f.fator_para_unidade_interna ?? 1,
      };
    });
  }

  // Montar mapa de produtos por EAN para lookup rápido
  const eanMap = new Map<string, LocalItem>();
  (produtosPorEan || []).forEach((p) => {
    if (p.ean) eanMap.set(p.ean.replace(/\D/g, ''), p as unknown as LocalItem);
  });

  // Montar mapa de produtos por NCM para lookup rápido
  const ncmMap = new Map<string, LocalItem[]>();
  (produtosPorNcm || []).forEach((p) => {
    if (p.ncm) {
      const arr = ncmMap.get(p.ncm) || [];
      arr.push(p as unknown as LocalItem);
      ncmMap.set(p.ncm, arr);
    }
  });

  // Montar mapa de produtos por id para lookup rápido
  const allProdutos = [...(produtosPorEan || []), ...(produtosPorNcm || [])];
  const produtosById = new Map<string, LocalItem>();
  allProdutos.forEach((p) => produtosById.set(p.id, p as unknown as LocalItem));

  return xmlItems.map((xmlItem) => {
    let matchedProduct: LocalItem | null = null;
    let matchType: MatchedItem['matchType'] = 'NAO_ENCONTRADO';
    let confidence = 0;
    let fatorConversao = 1;

    // 1. Match por EAN (mais preciso)
    if (xmlItem.cEAN && xmlItem.cEAN !== 'SEM GTIN') {
      const byEan = eanMap.get(xmlItem.cEAN.replace(/\D/g, ''));
      if (byEan) {
        matchedProduct = byEan;
        matchType = 'EAN';
        confidence = 100;
      }
    }

    // 2. Match por código do fornecedor (cProd)
    if (!matchedProduct && xmlItem.cProd && itemFornecedoresMap[xmlItem.cProd]) {
      const forn = itemFornecedoresMap[xmlItem.cProd];
      const produto = produtosById.get(forn.item_id);
      if (produto) {
        matchedProduct = produto;
        matchType = 'CODIGO_FORNECEDOR';
        confidence = 95;
        fatorConversao = forn.fator_para_unidade_interna;
      }
    }

    // 3. Match fuzzy por NCM + descrição
    if (!matchedProduct && xmlItem.NCM) {
      const byNcm = ncmMap.get(xmlItem.NCM) || [];
      if (byNcm.length > 0) {
        let bestMatch: LocalItem | null = null;
        let bestSimilarity = 0;

        byNcm.forEach((p) => {
          const similarity = calculateSimilarity(p.descricao_interna, xmlItem.xProd);
          if (similarity > bestSimilarity && similarity > 0.4) {
            bestSimilarity = similarity;
            bestMatch = p;
          }
        });

        if (bestMatch) {
          matchedProduct = bestMatch;
          matchType = 'NCM_DESCRICAO';
          confidence = Math.round(bestSimilarity * 80);
        }
      }
    }

    // Ajustar fator de conversão pelo item_fornecedor se disponível
    if (matchedProduct && xmlItem.cProd && itemFornecedoresMap[xmlItem.cProd]) {
      fatorConversao = itemFornecedoresMap[xmlItem.cProd].fator_para_unidade_interna;
    }

    return {
      xmlItem,
      matchedProduct,
      matchType,
      confidence,
      fatorConversao,
      loteManual: xmlItem.rastro
        ? {
            numero: xmlItem.rastro.nLote,
            dataFab: xmlItem.rastro.dFab,
            dataVal: xmlItem.rastro.dVal,
          }
        : undefined,
    };
  });
}

// Suggest tipo_item based on NCM and description
export function suggestTipoItem(ncm: string, descricao: string): string {
  const desc = descricao.toLowerCase();
  const ncmPrefix = ncm?.substring(0, 4) || '';

  if (desc.includes('capsula') && desc.includes('vazia')) return 'CAPSULA_VAZIA';
  if (desc.includes('rotulo') || desc.includes('etiqueta')) return 'ROTULO';
  if (desc.includes('tampa')) return 'TAMPA';
  if (desc.includes('pote') || desc.includes('frasco')) return 'POTE';
  if (desc.includes('silica') || desc.includes('dessecante')) return 'SILICA';
  if (desc.includes('embalagem') || desc.includes('caixa') || desc.includes('sacola')) return 'EMBALAGEM';

  if (ncmPrefix.startsWith('2936')) return 'MP'; // Vitaminas
  if (ncmPrefix.startsWith('2106')) return 'MP'; // Suplementos alimentares
  if (ncmPrefix.startsWith('3923')) return 'EMBALAGEM'; // Recipientes plásticos
  if (ncmPrefix.startsWith('4819')) return 'EMBALAGEM'; // Caixas de papelão

  return 'MP'; // Default: matéria-prima
}
