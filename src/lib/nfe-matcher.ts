// NF-e Item Matcher - Match XML items to existing products
import { LocalDb } from '@/lib/local-db';
import type { NFeItemParsed } from '@/types/erp';
import type { LocalItem, LocalItemFornecedor } from '@/hooks/use-local-itens';
import type { LocalEntidade } from '@/hooks/use-local-entidades';

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
  
  // Simple word overlap similarity
  const words1 = new Set(s1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(s2.split(' ').filter(w => w.length > 2));
  
  if (words1.size === 0 || words2.size === 0) return 0;
  
  let matches = 0;
  words1.forEach(w => {
    if (words2.has(w)) matches++;
  });
  
  return matches / Math.max(words1.size, words2.size);
}

export function matchXmlItems(
  xmlItems: NFeItemParsed[],
  fornecedorCnpj: string
): MatchedItem[] {
  const produtos = LocalDb.getCollection<LocalItem>('itens');
  const itemFornecedores = LocalDb.getCollection<LocalItemFornecedor>('item_fornecedores');
  const entidades = LocalDb.getCollection<LocalEntidade>('entidades');
  
  // Find fornecedor by CNPJ
  const fornecedor = entidades.find(e => 
    e.documento.replace(/\D/g, '') === fornecedorCnpj.replace(/\D/g, '')
  );

  return xmlItems.map(xmlItem => {
    let matchedProduct: LocalItem | null = null;
    let matchType: MatchedItem['matchType'] = 'NAO_ENCONTRADO';
    let confidence = 0;
    let fatorConversao = 1;

    // 1. Try matching by EAN
    if (xmlItem.cEAN && xmlItem.cEAN !== 'SEM GTIN') {
      const byEan = produtos.find(p => 
        p.ean && p.ean.replace(/\D/g, '') === xmlItem.cEAN!.replace(/\D/g, '')
      );
      if (byEan) {
        matchedProduct = byEan;
        matchType = 'EAN';
        confidence = 100;
      }
    }

    // 2. Try matching by codigo_fornecedor (cProd)
    if (!matchedProduct && fornecedor && xmlItem.cProd) {
      const itemForn = itemFornecedores.find(
        f => f.fornecedor_id === fornecedor.id && 
             f.codigo_fornecedor === xmlItem.cProd
      );
      if (itemForn) {
        const produto = produtos.find(p => p.id === itemForn.item_id);
        if (produto) {
          matchedProduct = produto;
          matchType = 'CODIGO_FORNECEDOR';
          confidence = 95;
          fatorConversao = itemForn.fator_para_unidade_interna;
        }
      }
    }

    // 3. Try fuzzy matching by NCM + description
    if (!matchedProduct && xmlItem.NCM) {
      const byNcm = produtos.filter(p => p.ncm === xmlItem.NCM);
      if (byNcm.length > 0) {
        // Find best match by description similarity
        let bestMatch: LocalItem | null = null;
        let bestSimilarity = 0;
        
        byNcm.forEach(p => {
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

    // Get fator conversão from item_fornecedores if available
    if (matchedProduct && fornecedor) {
      const itemForn = itemFornecedores.find(
        f => f.item_id === matchedProduct!.id && f.fornecedor_id === fornecedor.id
      );
      if (itemForn) {
        fatorConversao = itemForn.fator_para_unidade_interna;
      }
    }

    return {
      xmlItem,
      matchedProduct,
      matchType,
      confidence,
      fatorConversao,
      loteManual: xmlItem.rastro ? {
        numero: xmlItem.rastro.nLote,
        dataFab: xmlItem.rastro.dFab,
        dataVal: xmlItem.rastro.dVal,
      } : undefined,
    };
  });
}

// Suggest tipo_item based on NCM and description
export function suggestTipoItem(ncm: string, descricao: string): string {
  const desc = descricao.toLowerCase();
  const ncmPrefix = ncm?.substring(0, 4) || '';
  
  // Common patterns for supplements industry
  if (desc.includes('capsula') && desc.includes('vazia')) return 'CAPSULA_VAZIA';
  if (desc.includes('rotulo') || desc.includes('etiqueta')) return 'ROTULO';
  if (desc.includes('tampa')) return 'TAMPA';
  if (desc.includes('pote') || desc.includes('frasco')) return 'POTE';
  if (desc.includes('silica') || desc.includes('dessecante')) return 'SILICA';
  if (desc.includes('embalagem') || desc.includes('caixa') || desc.includes('sacola')) return 'EMBALAGEM';
  
  // NCM-based suggestions
  if (ncmPrefix.startsWith('2936')) return 'MP'; // Vitamins
  if (ncmPrefix.startsWith('2106')) return 'MP'; // Food supplements
  if (ncmPrefix.startsWith('3923')) return 'EMBALAGEM'; // Plastic containers
  if (ncmPrefix.startsWith('4819')) return 'EMBALAGEM'; // Cardboard boxes
  
  return 'MP'; // Default to matéria-prima
}
