// ============================================
// COLEÇÕES LOCAIS PARA NF-e COMPLETA
// ============================================

import { LocalDb } from './local-db';
import type {
  NotaFiscalCompleta,
  NotaFiscalObservacao,
  NotaFiscalItem,
  NotaFiscalItemImposto,
  NotaFiscalItemRastro,
  NotaFiscalTotaisImpostos,
  NotaFiscalTransporte,
  NotaFiscalVolume,
  NotaFiscalFatura,
  NotaFiscalDuplicata,
  NotaFiscalPagamento,
  ContaPagar,
  ImportacaoLog,
  NFeParseResult,
  EntidadeXML,
  ClassificacaoNota,
} from '@/types/nfe-completa';
import type { LocalEntidade } from '@/hooks/use-local-entidades';
import type { LocalItem, LocalEstoqueLote, LocalItemFornecedor, LocalItemAlias } from '@/hooks/use-local-itens';

// Extend LocalDb collections
type NFeCollection =
  | 'notas_fiscais'
  | 'notas_fiscais_observacoes'
  | 'notas_fiscais_itens'
  | 'notas_fiscais_itens_impostos'
  | 'notas_fiscais_itens_rastros'
  | 'notas_fiscais_totais'
  | 'notas_fiscais_transporte'
  | 'notas_fiscais_volumes'
  | 'notas_fiscais_faturas'
  | 'notas_fiscais_duplicatas'
  | 'notas_fiscais_pagamentos'
  | 'contas_pagar'
  | 'importacao_logs';

const STORAGE_PREFIX = 'legacy_erp_';

function getStorageKey(collection: NFeCollection): string {
  return `${STORAGE_PREFIX}${collection}`;
}

function getCollection<T>(collection: NFeCollection): T[] {
  try {
    const data = localStorage.getItem(getStorageKey(collection));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setCollection<T>(collection: NFeCollection, data: T[]): void {
  localStorage.setItem(getStorageKey(collection), JSON.stringify(data));
}

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function insert<T>(collection: NFeCollection, item: Omit<T, 'id' | 'created_at'>): T {
  const items = getCollection<T>(collection);
  const newItem = {
    ...item,
    id: generateUUID(),
    created_at: new Date().toISOString(),
  } as T;
  items.push(newItem);
  setCollection(collection, items);
  return newItem;
}

// ============================================
// CHECK DUPLICIDADE
// ============================================
export function checkNotaFiscalExists(chaveAcesso: string): NotaFiscalCompleta | null {
  const notas = getCollection<NotaFiscalCompleta>('notas_fiscais');
  return notas.find(n => n.chave_acesso === chaveAcesso) || null;
}

// ============================================
// BUSCAR OU CRIAR ENTIDADE
// ============================================
export function findOrCreateEntidade(entidadeXML: EntidadeXML, papel: 'FORNECEDOR' | 'CLIENTE' | 'TRANSPORTADORA'): string {
  const entidades = LocalDb.getCollection<LocalEntidade>('entidades');
  const docLimpo = entidadeXML.documento.replace(/\D/g, '');
  
  const existente = entidades.find(e => e.documento.replace(/\D/g, '') === docLimpo);
  
  if (existente) {
    // Verificar se já tem o papel
    if (!existente.papeis?.includes(papel)) {
      LocalDb.update<LocalEntidade>('entidades', existente.id, {
        papeis: [...(existente.papeis || []), papel],
      });
    }
    return existente.id;
  }
  
  // Criar nova entidade
  const novaEntidade = LocalDb.insert<LocalEntidade>('entidades', {
    tipo_pessoa: entidadeXML.tipo_pessoa,
    documento: entidadeXML.documento,
    razao_social: entidadeXML.razao_social,
    nome_fantasia: entidadeXML.nome_fantasia,
    ie: entidadeXML.ie,
    im: entidadeXML.im,
    cnae: entidadeXML.cnae,
    crt: entidadeXML.crt,
    status: 'ATIVO',
    classificacao: 'REGULAR',
    papeis: [papel],
    tags: ['IMPORTADO_XML'],
  });
  
  // Criar endereço se existir
  if (entidadeXML.endereco) {
    LocalDb.insert('entidade_enderecos', {
      entidade_id: novaEntidade.id,
      tipo: 'FISCAL',
      logradouro: entidadeXML.endereco.logradouro,
      numero: entidadeXML.endereco.numero,
      complemento: entidadeXML.endereco.complemento,
      bairro: entidadeXML.endereco.bairro,
      cidade: entidadeXML.endereco.municipio,
      uf: entidadeXML.endereco.uf,
      cep: entidadeXML.endereco.cep,
      cmun: entidadeXML.endereco.codigo_municipio,
      pais: entidadeXML.endereco.pais || 'Brasil',
      cpais: entidadeXML.endereco.codigo_pais || '1058',
    });
  }
  
  // Criar contato padrão
  LocalDb.insert('entidade_contatos', {
    entidade_id: novaEntidade.id,
    nome: 'Contato Principal',
    cargo: 'OUTRO',
    email: entidadeXML.email,
    telefone: entidadeXML.telefone,
    preferencial: true,
    aceita_whatsapp: true,
    origem: 'XML',
  });
  
  return novaEntidade.id;
}

// ============================================
// DEDUPLICAÇÃO DE PRODUTO
// ============================================
function normalizeString(str: string): string {
  return str
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function calculateSimilarity(str1: string, str2: string): number {
  const s1 = normalizeString(str1);
  const s2 = normalizeString(str2);
  
  if (s1 === s2) return 1;
  
  const words1 = s1.split(' ');
  const words2 = s2.split(' ');
  const commonWords = words1.filter(w => words2.includes(w));
  
  return commonWords.length / Math.max(words1.length, words2.length);
}

export function findOrCreateProduto(
  item: NFeParseResult['itens'][0]['item'],
  fornecedorId: string,
  classificacao: ClassificacaoNota
): { itemId: string; isNew: boolean; fatorConversao: number } {
  const itens = LocalDb.getCollection<LocalItem>('itens');
  const aliases = LocalDb.getCollection<LocalItemAlias>('item_alias');
  const fornecedores = LocalDb.getCollection<LocalItemFornecedor>('item_fornecedores');
  
  const ean = item.ean && item.ean !== 'SEM GTIN' ? item.ean.replace(/\D/g, '') : null;
  const codigoFornecedor = item.codigo_produto;
  const ncm = item.ncm;
  const descricao = item.descricao;
  
  // 1. Buscar por EAN (mais preciso)
  if (ean) {
    const itemPorEan = itens.find(i => i.ean?.replace(/\D/g, '') === ean);
    if (itemPorEan) {
      ensureItemFornecedor(itemPorEan.id, fornecedorId, codigoFornecedor, item);
      return { itemId: itemPorEan.id, isNew: false, fatorConversao: getFatorConversao(itemPorEan.id, fornecedorId) };
    }
  }
  
  // 2. Buscar por código do fornecedor
  const linkFornecedor = fornecedores.find(
    f => f.fornecedor_id === fornecedorId && f.codigo_fornecedor === codigoFornecedor
  );
  if (linkFornecedor) {
    return { itemId: linkFornecedor.item_id, isNew: false, fatorConversao: linkFornecedor.fator_para_unidade_interna };
  }
  
  // 3. Buscar por alias
  const alias = aliases.find(a => 
    a.fornecedor_id === fornecedorId && 
    normalizeString(a.texto) === normalizeString(descricao)
  );
  if (alias) {
    ensureItemFornecedor(alias.item_id, fornecedorId, codigoFornecedor, item);
    return { itemId: alias.item_id, isNew: false, fatorConversao: getFatorConversao(alias.item_id, fornecedorId) };
  }
  
  // 4. Buscar por NCM + descrição similar (>80%)
  if (ncm) {
    const candidatos = itens.filter(i => i.ncm === ncm);
    for (const candidato of candidatos) {
      const similarity = calculateSimilarity(candidato.descricao_interna, descricao);
      if (similarity >= 0.8) {
        ensureItemFornecedor(candidato.id, fornecedorId, codigoFornecedor, item);
        // Criar alias para futuras importações
        LocalDb.insert<LocalItemAlias>('item_alias', {
          item_id: candidato.id,
          fornecedor_id: fornecedorId,
          tipo: 'ALIAS_FORNECEDOR',
          texto: descricao,
        });
        return { itemId: candidato.id, isNew: false, fatorConversao: getFatorConversao(candidato.id, fornecedorId) };
      }
    }
  }
  
  // 5. Criar novo produto
  const tipoItem = mapClassificacaoToTipoItem(classificacao);
  const isCritico = tipoItem === 'MP' || classificacao === 'MATERIA_PRIMA';
  
  const novoItem = LocalDb.insert<LocalItem>('itens', {
    sku_interno: LocalDb.generateSKU(tipoItem),
    descricao_interna: descricao,
    tipo_item: tipoItem,
    ncm: ncm,
    ean: ean || undefined,
    unidade_interna: 'g',
    controla_lote: true,
    controla_validade: true,
    criticidade: isCritico ? 'CRITICO' : 'NORMAL',
    higroscopico: false,
    armazenamento: 'AMBIENTE',
    exige_premix: false,
    ativo: true,
  });
  
  // Calcular fator de conversão
  const uCom = item.unidade_comercial.toUpperCase();
  let fatorConversao = 1;
  if (uCom === 'KG') fatorConversao = 1000;
  else if (uCom === 'G') fatorConversao = 1;
  else if (uCom === 'MG') fatorConversao = 0.001;
  else if (uCom === 'TON' || uCom === 'T') fatorConversao = 1000000;
  
  // Criar link com fornecedor
  LocalDb.insert<LocalItemFornecedor>('item_fornecedores', {
    item_id: novoItem.id,
    fornecedor_id: fornecedorId,
    codigo_fornecedor: codigoFornecedor,
    descricao_fornecedor: descricao,
    unidade_compra_padrao: uCom.toLowerCase(),
    fator_para_unidade_interna: fatorConversao,
    fornecedor_preferencial: true,
    preco_referencia: item.valor_unitario_comercial,
  });
  
  return { itemId: novoItem.id, isNew: true, fatorConversao };
}

function ensureItemFornecedor(
  itemId: string, 
  fornecedorId: string, 
  codigoFornecedor: string,
  item: NFeParseResult['itens'][0]['item']
): void {
  const fornecedores = LocalDb.getCollection<LocalItemFornecedor>('item_fornecedores');
  const existing = fornecedores.find(f => f.item_id === itemId && f.fornecedor_id === fornecedorId);
  
  if (!existing) {
    const uCom = item.unidade_comercial.toUpperCase();
    let fatorConversao = 1;
    if (uCom === 'KG') fatorConversao = 1000;
    else if (uCom === 'G') fatorConversao = 1;
    else if (uCom === 'MG') fatorConversao = 0.001;
    
    LocalDb.insert<LocalItemFornecedor>('item_fornecedores', {
      item_id: itemId,
      fornecedor_id: fornecedorId,
      codigo_fornecedor: codigoFornecedor,
      descricao_fornecedor: item.descricao,
      unidade_compra_padrao: uCom.toLowerCase(),
      fator_para_unidade_interna: fatorConversao,
      fornecedor_preferencial: false,
      preco_referencia: item.valor_unitario_comercial,
    });
  }
}

function getFatorConversao(itemId: string, fornecedorId: string): number {
  const fornecedores = LocalDb.getCollection<LocalItemFornecedor>('item_fornecedores');
  const link = fornecedores.find(f => f.item_id === itemId && f.fornecedor_id === fornecedorId);
  return link?.fator_para_unidade_interna || 1;
}

function mapClassificacaoToTipoItem(classificacao: ClassificacaoNota): string {
  switch (classificacao) {
    case 'MATERIA_PRIMA': return 'MP';
    case 'EMBALAGEM': return 'EMBALAGEM';
    case 'INSUMO_CONSUMO': return 'OUTRO';
    case 'PRODUTO_TERCEIRO': return 'PA';
    default: return 'OUTRO';
  }
}

// ============================================
// CRIAR LOTE DE ESTOQUE
// ============================================
export function criarLoteEstoque(
  itemId: string,
  fornecedorId: string,
  notaItemId: string,
  rastro: NFeParseResult['itens'][0]['rastros'][0] | null,
  item: NFeParseResult['itens'][0]['item'],
  fatorConversao: number
): string {
  const produto = LocalDb.getById<LocalItem>('itens', itemId);
  const isCritico = produto?.tipo_item === 'MP' || 
                    produto?.criticidade === 'CRITICO' || 
                    produto?.criticidade === 'ULTRA';
  
  const quantidadeOriginal = rastro?.quantidade || item.quantidade_comercial;
  const quantidadeInterna = quantidadeOriginal * fatorConversao;
  const custoUnitarioOriginal = item.valor_unitario_comercial;
  const custoUnitarioInterno = custoUnitarioOriginal / fatorConversao;
  
  const lote = LocalDb.insert<LocalEstoqueLote>('estoque_lotes', {
    item_id: itemId,
    fornecedor_id: fornecedorId,
    nota_entrada_item_id: notaItemId,
    numero_lote: rastro?.numero_lote || `LOTE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    data_fab: rastro?.data_fabricacao,
    data_val: rastro?.data_validade,
    quantidade_original: quantidadeOriginal,
    unidade_original: item.unidade_comercial,
    quantidade_interna: quantidadeInterna,
    custo_unitario_original: custoUnitarioOriginal,
    custo_unitario_interno: custoUnitarioInterno,
    status: isCritico ? 'QUARENTENA' : 'DISPONIVEL',
  });
  
  return lote.id;
}

// ============================================
// GERAR CONTAS A PAGAR
// ============================================
export function gerarContasPagar(
  notaId: string,
  fornecedorId: string,
  duplicatas: NFeParseResult['duplicatas'],
  valorNota: number
): void {
  if (duplicatas.length === 0) {
    // Se não tem duplicatas mas tem valor, criar uma conta única
    if (valorNota > 0) {
      insert<ContaPagar>('contas_pagar', {
        nota_id: notaId,
        fornecedor_id: fornecedorId,
        descricao: `Pagamento NF-e`,
        numero_parcela: 1,
        total_parcelas: 1,
        valor: valorNota,
        data_vencimento: new Date().toISOString().split('T')[0],
        status: 'ABERTO',
        updated_at: new Date().toISOString(),
      });
    }
    return;
  }
  
  const totalParcelas = duplicatas.length;
  
  duplicatas.forEach((dup, index) => {
    insert<ContaPagar>('contas_pagar', {
      nota_id: notaId,
      fornecedor_id: fornecedorId,
      descricao: `Duplicata ${dup.numero}`,
      numero_parcela: index + 1,
      total_parcelas: totalParcelas,
      valor: dup.valor,
      data_vencimento: dup.data_vencimento,
      status: 'ABERTO',
      updated_at: new Date().toISOString(),
    });
  });
}

// ============================================
// IMPORTAR NF-e COMPLETA
// ============================================
export function importarNFeCompleta(
  parseResult: NFeParseResult,
  classificacaoManual?: ClassificacaoNota
): { notaId: string; stats: ImportStats } {
  const stats: ImportStats = {
    entidadesCriadas: 0,
    produtosCriados: 0,
    produtosVinculados: 0,
    lotesCriados: 0,
    contasPagarGeradas: 0,
  };
  
  const classificacao = classificacaoManual || parseResult.notaFiscal.classificacao;
  
  // 1. Criar/vincular entidades
  const emitenteId = findOrCreateEntidade(parseResult.emitente, 'FORNECEDOR');
  if (!LocalDb.getById<LocalEntidade>('entidades', emitenteId)?.papeis?.includes('FORNECEDOR')) {
    stats.entidadesCriadas++;
  }
  
  let destinatarioId: string | undefined;
  if (parseResult.destinatario) {
    destinatarioId = findOrCreateEntidade(parseResult.destinatario, 'CLIENTE');
  }
  
  let transportadoraId: string | undefined;
  if (parseResult.transportadora?.documento) {
    transportadoraId = findOrCreateEntidade(parseResult.transportadora, 'TRANSPORTADORA');
  }
  
  // 2. Criar nota fiscal
  const nota = insert<NotaFiscalCompleta>('notas_fiscais', {
    ...parseResult.notaFiscal,
    classificacao,
    emitente_id: emitenteId,
    destinatario_id: destinatarioId,
    transportadora_id: transportadoraId,
    updated_at: new Date().toISOString(),
  });
  
  // 3. Criar observações
  parseResult.observacoes.forEach(obs => {
    insert<NotaFiscalObservacao>('notas_fiscais_observacoes', {
      nota_id: nota.id,
      ...obs,
    });
  });
  
  // 4. Criar totais
  insert<NotaFiscalTotaisImpostos>('notas_fiscais_totais', {
    nota_id: nota.id,
    ...parseResult.totaisImpostos,
  });
  
  // 5. Criar transporte
  if (parseResult.transporte) {
    insert<NotaFiscalTransporte>('notas_fiscais_transporte', {
      nota_id: nota.id,
      ...parseResult.transporte,
    });
  }
  
  // 6. Criar volumes
  parseResult.volumes.forEach(vol => {
    insert<NotaFiscalVolume>('notas_fiscais_volumes', {
      nota_id: nota.id,
      ...vol,
    });
  });
  
  // 7. Criar fatura
  if (parseResult.fatura) {
    insert<NotaFiscalFatura>('notas_fiscais_faturas', {
      nota_id: nota.id,
      ...parseResult.fatura,
    });
  }
  
  // 8. Criar duplicatas
  parseResult.duplicatas.forEach(dup => {
    insert<NotaFiscalDuplicata>('notas_fiscais_duplicatas', {
      nota_id: nota.id,
      ...dup,
    });
  });
  
  // 9. Criar pagamentos
  parseResult.pagamentos.forEach(pag => {
    insert<NotaFiscalPagamento>('notas_fiscais_pagamentos', {
      nota_id: nota.id,
      ...pag,
    });
  });
  
  // 10. Processar itens
  parseResult.itens.forEach(itemData => {
    // Deduzir ou criar produto
    const { itemId, isNew, fatorConversao } = findOrCreateProduto(
      itemData.item,
      emitenteId,
      classificacao
    );
    
    if (isNew) stats.produtosCriados++;
    else stats.produtosVinculados++;
    
    // Criar item da nota
    const notaItem = insert<NotaFiscalItem>('notas_fiscais_itens', {
      nota_id: nota.id,
      item_id: itemId,
      ...itemData.item,
    });
    
    // Criar impostos do item
    insert<NotaFiscalItemImposto>('notas_fiscais_itens_impostos', {
      nota_item_id: notaItem.id,
      ...itemData.impostos,
    });
    
    // Criar rastros e lotes
    if (itemData.rastros.length > 0) {
      itemData.rastros.forEach(rastro => {
        // Salvar rastro do XML
        insert<NotaFiscalItemRastro>('notas_fiscais_itens_rastros', {
          nota_item_id: notaItem.id,
          ...rastro,
        });
        
        // Criar lote de estoque
        criarLoteEstoque(itemId, emitenteId, notaItem.id, rastro, itemData.item, fatorConversao);
        stats.lotesCriados++;
      });
    } else {
      // Criar lote único se não tem rastro
      criarLoteEstoque(itemId, emitenteId, notaItem.id, null, itemData.item, fatorConversao);
      stats.lotesCriados++;
    }
  });
  
  // 11. Gerar contas a pagar
  gerarContasPagar(nota.id, emitenteId, parseResult.duplicatas, parseResult.notaFiscal.total_nota);
  stats.contasPagarGeradas = parseResult.duplicatas.length || (parseResult.notaFiscal.total_nota > 0 ? 1 : 0);
  
  // 12. Log de auditoria
  insert<ImportacaoLog>('importacao_logs', {
    nota_id: nota.id,
    acao: 'IMPORTACAO',
    detalhes: stats as unknown as Record<string, unknown>,
  });
  
  return { notaId: nota.id, stats };
}

export interface ImportStats {
  entidadesCriadas: number;
  produtosCriados: number;
  produtosVinculados: number;
  lotesCriados: number;
  contasPagarGeradas: number;
}

// ============================================
// GETTERS
// ============================================
export function getNotasFiscais(): NotaFiscalCompleta[] {
  return getCollection<NotaFiscalCompleta>('notas_fiscais')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getNotaFiscalById(id: string): NotaFiscalCompleta | null {
  const notas = getCollection<NotaFiscalCompleta>('notas_fiscais');
  return notas.find(n => n.id === id) || null;
}

export function getNotaFiscalItens(notaId: string): NotaFiscalItem[] {
  return getCollection<NotaFiscalItem>('notas_fiscais_itens')
    .filter(i => i.nota_id === notaId)
    .sort((a, b) => a.n_item - b.n_item);
}

export function getNotaFiscalImpostos(notaItemId: string): NotaFiscalItemImposto | null {
  const impostos = getCollection<NotaFiscalItemImposto>('notas_fiscais_itens_impostos');
  return impostos.find(i => i.nota_item_id === notaItemId) || null;
}

export function getNotaFiscalTotais(notaId: string): NotaFiscalTotaisImpostos | null {
  const totais = getCollection<NotaFiscalTotaisImpostos>('notas_fiscais_totais');
  return totais.find(t => t.nota_id === notaId) || null;
}

export function getNotaFiscalTransporte(notaId: string): NotaFiscalTransporte | null {
  const transportes = getCollection<NotaFiscalTransporte>('notas_fiscais_transporte');
  return transportes.find(t => t.nota_id === notaId) || null;
}

export function getNotaFiscalVolumes(notaId: string): NotaFiscalVolume[] {
  return getCollection<NotaFiscalVolume>('notas_fiscais_volumes')
    .filter(v => v.nota_id === notaId);
}

export function getNotaFiscalDuplicatas(notaId: string): NotaFiscalDuplicata[] {
  return getCollection<NotaFiscalDuplicata>('notas_fiscais_duplicatas')
    .filter(d => d.nota_id === notaId);
}

export function getContasPagar(): ContaPagar[] {
  return getCollection<ContaPagar>('contas_pagar')
    .sort((a, b) => new Date(a.data_vencimento).getTime() - new Date(b.data_vencimento).getTime());
}

export function getContasPagarByNota(notaId: string): ContaPagar[] {
  return getCollection<ContaPagar>('contas_pagar')
    .filter(c => c.nota_id === notaId);
}
