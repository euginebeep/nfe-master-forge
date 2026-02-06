// ============================================
// COLEÇÕES LOCAIS PARA NF-e COMPLETA
// ============================================

import { LocalDb } from './local-db';
import { saveXmlBackup } from './xml-backup';
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
  classificacao: ClassificacaoNota,
  impostos?: NFeParseResult['itens'][0]['impostos']
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
  const tipoItem = mapClassificacaoToTipoItem(classificacao, descricao);
  const isCritico = tipoItem === 'MP' || classificacao === 'MATERIA_PRIMA';
  
  // Verificar se é cápsula pelo nome
  const isCapsule = tipoItem === 'CAPSULA';
  
  // Determinar unidade interna baseado no tipo de item
  // REGRA: Embalagens e itens discretos mantêm unidade da nota fiscal (UN)
  //        Matérias-primas convertem para grama
  //        Cápsulas usam 'un' com fator de conversão de milheiro
  const uCom = item.unidade_comercial.toUpperCase();
  const isEmbalagem = ['EMBALAGEM', 'ROTULO', 'TAMPA', 'POTE', 'SILICA', 'CAPSULA_VAZIA', 'CAPSULA'].includes(tipoItem);
  const unidadesDiscretas = ['UN', 'UND', 'UNID', 'PCT', 'CX', 'FD', 'SC', 'SACO', 'CAP', 'CAPS', 'ENV', 'ENVL', 'PC', 'PÇ', 'ROLO', 'MT', 'M'];
  const isUnidadeDiscreta = unidadesDiscretas.includes(uCom);
  
  // Para embalagens: sempre usar 'un' (unidade)
  // Para itens com unidade discreta na nota: usar 'un'
  // Para matérias-primas com unidade de massa: usar 'g' (grama)
  let unidadeInterna: 'g' | 'mg' | 'un' | 'ml' | 'milheiro' = 'g';
  if (isEmbalagem || isUnidadeDiscreta) {
    unidadeInterna = 'un';
  } else if (uCom === 'ML' || uCom === 'L' || uCom === 'LT') {
    unidadeInterna = 'ml';
  }
  
  // Detectar unidade milheiro na nota
  const unidadesMilheiro = ['MILHEIRO', 'MIL', 'MI'];
  const isUnidadeMilheiro = unidadesMilheiro.includes(uCom);
  
  // Calcular fator de conversão primeiro para usar no cadastro
  let fatorConversaoCadastro = 1;
  if (isCapsule && isUnidadeMilheiro) {
    fatorConversaoCadastro = 1000;
  } else if (!isEmbalagem && !isUnidadeDiscreta) {
    if (uCom === 'KG') fatorConversaoCadastro = 1000;
    else if (uCom === 'G') fatorConversaoCadastro = 1;
    else if (uCom === 'MG') fatorConversaoCadastro = 0.001;
    else if (uCom === 'TON' || uCom === 'T') fatorConversaoCadastro = 1000000;
    else if (uCom === 'L' || uCom === 'LT') fatorConversaoCadastro = 1000;
    else if (uCom === 'ML') fatorConversaoCadastro = 1;
  }

  // Extrair dados fiscais do XML (impostos) - preenchimento automático
  const dadosFiscais = impostos ? {
    cfop_entrada_padrao: item.cfop || undefined,
    cst_icms: impostos.icms_cst || undefined,
    origem_icms: impostos.icms_origem || undefined,
    aliquota_icms: impostos.icms_aliquota || undefined,
    mva_st: impostos.icms_st_mva || undefined,
    cst_ipi: impostos.ipi_cst || undefined,
    aliquota_ipi: impostos.ipi_aliquota || undefined,
    cst_pis: impostos.pis_cst || undefined,
    aliquota_pis: impostos.pis_aliquota || undefined,
    cst_cofins: impostos.cofins_cst || undefined,
    aliquota_cofins: impostos.cofins_aliquota || undefined,
    cest: item.cest || undefined,
  } : {};

  const novoItem = LocalDb.insert<LocalItem>('itens', {
    sku_interno: LocalDb.generateSKU(tipoItem),
    descricao_interna: descricao,
    tipo_item: tipoItem as any,
    ncm: ncm,
    ean: ean || undefined,
    // REGRA MESTRE: Unidade do Fornecedor (IMUTÁVEL)
    unidade_fornecedor: (isUnidadeMilheiro ? 'milheiro' : (isEmbalagem || isUnidadeDiscreta ? 'un' : uCom.toLowerCase())) as any,
    // REGRA MESTRE: Unidade Interna de Controle
    unidade_interna: unidadeInterna as any,
    // REGRA MESTRE: Fator de Conversão OBRIGATÓRIO
    fator_conversao: fatorConversaoCadastro,
    controla_lote: true,
    controla_validade: true,
    criticidade: isCritico ? 'CRITICO' : 'NORMAL',
    higroscopico: false,
    armazenamento: 'AMBIENTE',
    exige_premix: false,
    ativo: true,
    // DADOS FISCAIS DO XML
    ...dadosFiscais,
  });
  
  // O fator de conversão já foi calculado acima (fatorConversaoCadastro)
  
  // Criar link com fornecedor
  LocalDb.insert<LocalItemFornecedor>('item_fornecedores', {
    item_id: novoItem.id,
    fornecedor_id: fornecedorId,
    codigo_fornecedor: codigoFornecedor,
    descricao_fornecedor: descricao,
    unidade_compra_padrao: isEmbalagem || isUnidadeDiscreta ? 'un' : (isUnidadeMilheiro ? 'milheiro' : uCom.toLowerCase()) as any,
    fator_para_unidade_interna: fatorConversaoCadastro,
    fornecedor_preferencial: true,
    preco_referencia: item.valor_unitario_comercial,
  });
  
  return { itemId: novoItem.id, isNew: true, fatorConversao: fatorConversaoCadastro };
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
    const unidadesDiscretas = ['UN', 'UND', 'UNID', 'PCT', 'CX', 'FD', 'SC', 'SACO', 'CAP', 'CAPS', 'ENV', 'ENVL', 'PC', 'PÇ', 'ROLO', 'MT', 'M'];
    const isUnidadeDiscreta = unidadesDiscretas.includes(uCom);
    
    // Verificar se o item é embalagem
    const produto = LocalDb.getById<LocalItem>('itens', itemId);
    const isEmbalagem = produto && ['EMBALAGEM', 'ROTULO', 'TAMPA', 'POTE', 'SILICA', 'CAPSULA_VAZIA'].includes(produto.tipo_item);
    
    // Para embalagens e unidades discretas: não converter
    let fatorConversao = 1;
    if (!isEmbalagem && !isUnidadeDiscreta) {
      if (uCom === 'KG') fatorConversao = 1000;
      else if (uCom === 'G') fatorConversao = 1;
      else if (uCom === 'MG') fatorConversao = 0.001;
      else if (uCom === 'L' || uCom === 'LT') fatorConversao = 1000;
      else if (uCom === 'ML') fatorConversao = 1;
    }
    
    LocalDb.insert<LocalItemFornecedor>('item_fornecedores', {
      item_id: itemId,
      fornecedor_id: fornecedorId,
      codigo_fornecedor: codigoFornecedor,
      descricao_fornecedor: item.descricao,
      unidade_compra_padrao: isEmbalagem || isUnidadeDiscreta ? 'un' : uCom.toLowerCase(),
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

function mapClassificacaoToTipoItem(classificacao: ClassificacaoNota, descricao?: string): string {
  // Detectar cápsula pelo nome do produto
  if (descricao) {
    const descNorm = descricao.toUpperCase();
    if (descNorm.includes('CAPSULA') || descNorm.includes('CÁPSULA') || 
        descNorm.includes('CAPS') && (descNorm.includes('VAZIA') || descNorm.includes('GELATINA') || descNorm.includes('VEGETAL'))) {
      return 'CAPSULA';
    }
  }
  
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
  fatorConversao: number,
  notaInfo?: { numero: string; serie: string; data: string; chave: string },
  impostos?: NFeParseResult['itens'][0]['impostos']
): string {
  const produto = LocalDb.getById<LocalItem>('itens', itemId);
  const isCritico = produto?.tipo_item === 'MP' || 
                    produto?.criticidade === 'CRITICO' || 
                    produto?.criticidade === 'ULTRA';
  
  // REGRA: Verificar se é cápsula com fator de conversão configurado
  const isCapsule = produto && (produto.tipo_item === 'CAPSULA' || produto.tipo_item === 'CAPSULA_VAZIA');
  const temFatorCadastrado = produto?.fator_conversao && produto.fator_conversao > 1;
  
  // REGRA: Embalagens e itens discretos NÃO convertem unidade (exceto se tiver fator configurado)
  const isEmbalagem = produto && ['EMBALAGEM', 'ROTULO', 'TAMPA', 'POTE', 'SILICA', 'CAPSULA_VAZIA', 'CAPSULA'].includes(produto.tipo_item);
  const unidadeOriginal = item.unidade_comercial.toUpperCase();
  const unidadesDiscretas = ['UN', 'UND', 'UNID', 'PCT', 'CX', 'FD', 'SC', 'SACO', 'CAP', 'CAPS', 'ENV', 'ENVL', 'PC', 'PÇ', 'ROLO', 'MT', 'M', 'MILHEIRO', 'MIL'];
  const isUnidadeDiscreta = unidadesDiscretas.includes(unidadeOriginal);
  
  // Unidades que indicam milheiro na nota
  const unidadesMilheiro = ['MILHEIRO', 'MIL', 'MI'];
  const isUnidadeMilheiro = unidadesMilheiro.includes(unidadeOriginal);
  
  // IMPORTANTE: A quantidade original é a quantidade comercial do item na nota
  // Se tiver rastro, usar a quantidade do rastro (pode ser fracionada)
  const quantidadeOriginal = rastro?.quantidade || item.quantidade_comercial;
  
  // Para embalagens e unidades discretas: manter unidade original sem conversão
  let unidadeInterna: string;
  let fatorFinal: number;
  let quantidadeInterna: number;
  let custoUnitarioInterno: number;
  
  // Caso especial: Cápsula com compra em milheiro
  if ((isCapsule || temFatorCadastrado) && (isUnidadeMilheiro || temFatorCadastrado)) {
    // Usar fator configurado no cadastro ou detectar automaticamente
    fatorFinal = temFatorCadastrado ? produto!.fator_conversao : 1000;
    unidadeInterna = produto?.unidade_interna || 'un';
    
    // Converter: 1 milheiro = 1000 unidades
    // Quantidade: qtd_milheiro × 1000 = quantidade de cápsulas
    quantidadeInterna = quantidadeOriginal * fatorFinal;
    
    // Custo: valor_total ÷ quantidade_total = custo por unidade
    // Exemplo: R$ 100,00 por 1 milheiro = R$ 0,10 por cápsula
    custoUnitarioInterno = item.valor_total / quantidadeInterna;
    
  } else if (isEmbalagem || isUnidadeDiscreta) {
    // NÃO CONVERTER - manter tudo na unidade original
    unidadeInterna = 'un'; // Padronizar como 'un' para embalagens
    fatorFinal = 1;
    quantidadeInterna = quantidadeOriginal;
    custoUnitarioInterno = item.valor_unitario_comercial;
  } else {
    // Matéria-prima: converter para unidade interna (g, ml, etc)
    unidadeInterna = produto?.unidade_interna || 'g';
    
    // Calcular fator de conversão baseado na unidade comercial
    const fatorCalculado = calcularFatorConversao(unidadeOriginal, unidadeInterna);
    fatorFinal = fatorCalculado > 0 ? fatorCalculado : fatorConversao;
    
    // Converter quantidade e custo para unidade interna
    quantidadeInterna = quantidadeOriginal * fatorFinal;
    custoUnitarioInterno = fatorFinal > 0 ? item.valor_unitario_comercial / fatorFinal : item.valor_unitario_comercial;
  }
  
  const custoUnitarioOriginal = item.valor_unitario_comercial;
  
  // Calcular valor total proporcional ao lote (se tiver rastro)
  const valorTotalItem = rastro ? 
    (rastro.quantidade / item.quantidade_comercial) * item.valor_total :
    item.valor_total;
  
  const lote = LocalDb.insert<LocalEstoqueLote>('estoque_lotes', {
    item_id: itemId,
    fornecedor_id: fornecedorId,
    nota_entrada_item_id: notaItemId,
    numero_lote: rastro?.numero_lote || `LOTE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    data_fab: rastro?.data_fabricacao,
    data_val: rastro?.data_validade,
    // Quantidades originais (EXATAMENTE como veio na nota)
    quantidade_original: quantidadeOriginal,
    unidade_original: isEmbalagem || isUnidadeDiscreta ? 'un' : unidadeOriginal,
    custo_unitario_original: custoUnitarioOriginal,
    valor_total_item: valorTotalItem,
    // Quantidades internas (para embalagens = igual ao original)
    quantidade_interna: quantidadeInterna,
    unidade_interna: unidadeInterna,
    custo_unitario_interno: custoUnitarioInterno,
    fator_conversao: fatorFinal,
    status: isCritico ? 'QUARENTENA' : 'DISPONIVEL',
    // Dados da Nota de Entrada
    nota_numero: notaInfo?.numero,
    nota_serie: notaInfo?.serie,
    nota_data: notaInfo?.data,
    nota_chave: notaInfo?.chave,
    // Impostos completos
    icms_base_calculo: impostos?.icms_base_calculo,
    icms_aliquota: impostos?.icms_aliquota,
    icms_valor: impostos?.icms_valor,
    icms_cst: impostos?.icms_cst,
    icms_st_base_calculo: impostos?.icms_st_base_calculo,
    icms_st_aliquota: impostos?.icms_st_aliquota,
    icms_st_valor: impostos?.icms_st_valor,
    ipi_base_calculo: impostos?.ipi_base_calculo,
    ipi_aliquota: impostos?.ipi_aliquota,
    ipi_valor: impostos?.ipi_valor,
    ipi_cst: impostos?.ipi_cst,
    pis_base_calculo: impostos?.pis_base_calculo,
    pis_aliquota: impostos?.pis_aliquota,
    pis_valor: impostos?.pis_valor,
    pis_cst: impostos?.pis_cst,
    cofins_base_calculo: impostos?.cofins_base_calculo,
    cofins_aliquota: impostos?.cofins_aliquota,
    cofins_valor: impostos?.cofins_valor,
    cofins_cst: impostos?.cofins_cst,
    // Valores adicionais
    valor_frete_item: item.valor_frete,
    valor_seguro_item: item.valor_seguro,
    valor_desconto_item: item.valor_desconto,
    valor_outros_item: item.valor_outros,
    // Dados da nota
    ncm: item.ncm,
    cfop: item.cfop,
    codigo_produto_fornecedor: item.codigo_produto,
    descricao_produto_nota: item.descricao,
  });
  
  return lote.id;
}

// ============================================
// CRIAR LOTE COM CONFIGURAÇÃO MANUAL
// ============================================
export function criarLoteEstoqueComConfig(
  itemId: string,
  fornecedorId: string,
  notaItemId: string,
  rastro: NFeParseResult['itens'][0]['rastros'][0] | null,
  item: NFeParseResult['itens'][0]['item'],
  fatorConversao: number,
  notaInfo?: { numero: string; serie: string; data: string; chave: string },
  impostos?: NFeParseResult['itens'][0]['impostos'],
  unidadeManual?: 'g' | 'mg' | 'un' | 'ml' | 'kg' | 'l' | 'milheiro'
): string {
  const produto = LocalDb.getById<LocalItem>('itens', itemId);
  const isCritico = produto?.tipo_item === 'MP' || 
                    produto?.criticidade === 'CRITICO' || 
                    produto?.criticidade === 'ULTRA';
  
  // IMPORTANTE: A quantidade original é a quantidade comercial do item na nota
  const quantidadeOriginal = rastro?.quantidade || item.quantidade_comercial;
  const unidadeOriginal = item.unidade_comercial.toUpperCase();
  
  // Usar unidade manual se especificada, senão usar a do produto
  const unidadeInterna = unidadeManual || produto?.unidade_interna || 'g';
  
  // Calcular quantidade interna usando o fator fornecido
  const quantidadeInterna = quantidadeOriginal * fatorConversao;
  
  // Calcular custo unitário interno
  // Custo = Valor Total do Item / Quantidade Interna
  const custoUnitarioInterno = item.valor_total / quantidadeInterna;
  const custoUnitarioOriginal = item.valor_unitario_comercial;
  
  // Calcular valor total proporcional ao lote (se tiver rastro)
  const valorTotalItem = rastro ? 
    (rastro.quantidade / item.quantidade_comercial) * item.valor_total :
    item.valor_total;
  
  const lote = LocalDb.insert<LocalEstoqueLote>('estoque_lotes', {
    item_id: itemId,
    fornecedor_id: fornecedorId,
    nota_entrada_item_id: notaItemId,
    numero_lote: rastro?.numero_lote || `LOTE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    data_fab: rastro?.data_fabricacao,
    data_val: rastro?.data_validade,
    // Quantidades originais (EXATAMENTE como veio na nota)
    quantidade_original: quantidadeOriginal,
    unidade_original: unidadeOriginal,
    custo_unitario_original: custoUnitarioOriginal,
    valor_total_item: valorTotalItem,
    // Quantidades internas (com conversão manual se configurada)
    quantidade_interna: quantidadeInterna,
    unidade_interna: unidadeInterna,
    custo_unitario_interno: custoUnitarioInterno,
    fator_conversao: fatorConversao,
    status: isCritico ? 'QUARENTENA' : 'DISPONIVEL',
    // Dados da Nota de Entrada
    nota_numero: notaInfo?.numero,
    nota_serie: notaInfo?.serie,
    nota_data: notaInfo?.data,
    nota_chave: notaInfo?.chave,
    // Impostos completos
    icms_base_calculo: impostos?.icms_base_calculo,
    icms_aliquota: impostos?.icms_aliquota,
    icms_valor: impostos?.icms_valor,
    icms_cst: impostos?.icms_cst,
    icms_st_base_calculo: impostos?.icms_st_base_calculo,
    icms_st_aliquota: impostos?.icms_st_aliquota,
    icms_st_valor: impostos?.icms_st_valor,
    ipi_base_calculo: impostos?.ipi_base_calculo,
    ipi_aliquota: impostos?.ipi_aliquota,
    ipi_valor: impostos?.ipi_valor,
    ipi_cst: impostos?.ipi_cst,
    pis_base_calculo: impostos?.pis_base_calculo,
    pis_aliquota: impostos?.pis_aliquota,
    pis_valor: impostos?.pis_valor,
    pis_cst: impostos?.pis_cst,
    cofins_base_calculo: impostos?.cofins_base_calculo,
    cofins_aliquota: impostos?.cofins_aliquota,
    cofins_valor: impostos?.cofins_valor,
    cofins_cst: impostos?.cofins_cst,
    // Valores adicionais
    valor_frete_item: item.valor_frete,
    valor_seguro_item: item.valor_seguro,
    valor_desconto_item: item.valor_desconto,
    valor_outros_item: item.valor_outros,
    // Dados da nota
    ncm: item.ncm,
    cfop: item.cfop,
    codigo_produto_fornecedor: item.codigo_produto,
    descricao_produto_nota: item.descricao,
  });
  
  return lote.id;
}


// CALCULAR FATOR DE CONVERSÃO
// ============================================
// 
// IMPORTANTE: No XML da NF-e:
// - qCom = Quantidade Comercial (ex: 25.000)
// - uCom = Unidade Comercial (ex: KG, G, UN, PCT, CX)
// 
// A quantidade no XML JÁ ESTÁ na unidade especificada.
// Exemplo: qCom=25.000 + uCom=KG significa 25 quilos (não 25 sacos)
// Exemplo: qCom=1000 + uCom=UN significa 1000 unidades
// Exemplo: qCom=5 + uCom=CX pode significar 5 caixas (precisa converter para unidade interna)
//
function calcularFatorConversao(unidadeOrigem: string, unidadeDestino: string): number {
  const origem = unidadeOrigem.toUpperCase().trim();
  const destino = unidadeDestino.toLowerCase().trim();
  
  // Se origem e destino são iguais (case-insensitive)
  if (origem.toLowerCase() === destino) {
    return 1;
  }
  
  // Tabela de conversão para GRAMAS (g) como unidade base de massa
  const paraGramas: Record<string, number> = {
    'KG': 1000,      // 1 kg = 1000 g
    'G': 1,          // 1 g = 1 g
    'MG': 0.001,     // 1 mg = 0.001 g
    'TON': 1000000,  // 1 ton = 1.000.000 g
    'T': 1000000,
  };
  
  // Tabela de conversão para MILILITROS (ml) como unidade base de volume
  const paraMl: Record<string, number> = {
    'L': 1000,       // 1 L = 1000 ml
    'LT': 1000,
    'ML': 1,         // 1 ml = 1 ml
  };
  
  // Unidades que não fazem conversão de massa/volume
  // Estas unidades representam embalagens ou contagens
  const unidadesDiscretas = ['UN', 'UND', 'UNID', 'PCT', 'CX', 'FD', 'SC', 'SACO', 'CAP', 'CAPS', 'ENV', 'ENVL'];
  
  // Se a origem é unidade discreta (embalagem), não converte
  if (unidadesDiscretas.includes(origem)) {
    return 1;
  }
  
  // Conversão de massa para grama
  if (paraGramas[origem] !== undefined) {
    if (destino === 'g') return paraGramas[origem];
    if (destino === 'mg') return paraGramas[origem] * 1000;
    if (destino === 'kg') return paraGramas[origem] / 1000;
    // Se destino é outro tipo de massa, converter via grama
    if (paraGramas[destino.toUpperCase()] !== undefined) {
      return paraGramas[origem] / paraGramas[destino.toUpperCase()];
    }
  }
  
  // Conversão de volume para ml
  if (paraMl[origem] !== undefined) {
    if (destino === 'ml') return paraMl[origem];
    if (destino === 'l' || destino === 'lt') return paraMl[origem] / 1000;
    // Se destino é outro tipo de volume, converter via ml
    if (paraMl[destino.toUpperCase()] !== undefined) {
      return paraMl[origem] / paraMl[destino.toUpperCase()];
    }
  }
  
  // Se não conseguiu determinar, retorna 1 (sem conversão)
  // Isso evita erros quando a unidade não é reconhecida
  console.warn(`[NFe] Conversão de unidade não mapeada: ${origem} → ${destino}, usando fator 1`);
  return 1;
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
// CONFIGURAÇÃO MANUAL DE CONVERSÃO POR ITEM
// ============================================
export interface ItemImportConfig {
  itemIndex: number;           // Índice do item no array
  unidadeInterna: 'g' | 'mg' | 'un' | 'ml' | 'kg' | 'l' | 'milheiro'; // Unidade interna desejada
  fatorConversao: number;      // Fator de conversão manual
}

// ============================================
// IMPORTAR NF-e COMPLETA
// ============================================
export function importarNFeCompleta(
  parseResult: NFeParseResult,
  classificacaoManual?: ClassificacaoNota,
  configuracoesItens?: ItemImportConfig[]
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
  
  // 2.1. BACKUP: Salvar XML original na íntegra para backup gerencial
  if (parseResult.notaFiscal.xml_raw) {
    saveXmlBackup(parseResult.notaFiscal.xml_raw, {
      chave_acesso: parseResult.notaFiscal.chave_acesso,
      numero_nota: parseResult.notaFiscal.numero,
      serie: parseResult.notaFiscal.serie,
      data_emissao: parseResult.notaFiscal.dh_emissao,
      fornecedor_cnpj: parseResult.emitente.documento,
      fornecedor_razao: parseResult.emitente.razao_social,
      valor_total: parseResult.notaFiscal.total_nota,
    });
  }
  
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
  parseResult.itens.forEach((itemData, itemIndex) => {
    // Verificar se tem configuração manual para este item
    const configManual = configuracoesItens?.find(c => c.itemIndex === itemIndex);
    
    // Deduzir ou criar produto (com dados fiscais do XML)
    const { itemId, isNew, fatorConversao: fatorAutomatico } = findOrCreateProduto(
      itemData.item,
      emitenteId,
      classificacao,
      itemData.impostos // Passar impostos para preenchimento automático
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
    const notaInfo = {
      numero: parseResult.notaFiscal.numero,
      serie: parseResult.notaFiscal.serie,
      data: parseResult.notaFiscal.dh_emissao,
      chave: parseResult.notaFiscal.chave_acesso,
    };
    
    // Usar fator/unidade manual se configurado, senão usar automático
    const fatorFinal = configManual?.fatorConversao ?? fatorAutomatico;
    const unidadeManual = configManual?.unidadeInterna;
    
    if (itemData.rastros.length > 0) {
      itemData.rastros.forEach(rastro => {
        // Salvar rastro do XML
        insert<NotaFiscalItemRastro>('notas_fiscais_itens_rastros', {
          nota_item_id: notaItem.id,
          ...rastro,
        });
        
        // Criar lote de estoque com dados da nota e impostos
        criarLoteEstoqueComConfig(
          itemId, 
          emitenteId, 
          notaItem.id, 
          rastro, 
          itemData.item, 
          fatorFinal, 
          notaInfo, 
          itemData.impostos,
          unidadeManual
        );
        stats.lotesCriados++;
      });
    } else {
      // Criar lote único se não tem rastro
      criarLoteEstoqueComConfig(
        itemId, 
        emitenteId, 
        notaItem.id, 
        null, 
        itemData.item, 
        fatorFinal, 
        notaInfo, 
        itemData.impostos,
        unidadeManual
      );
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

export interface ContaPagarUpdate {
  status?: 'ABERTO' | 'PAGO' | 'PARCIAL' | 'VENCIDO' | 'CANCELADO';
  valor_pago?: number;
  data_pagamento?: string;
  forma_pagamento?: string;
  observacoes?: string;
}

export function updateContaPagar(id: string, updates: ContaPagarUpdate): ContaPagar | null {
  const contas = getCollection<ContaPagar>('contas_pagar');
  const index = contas.findIndex(c => c.id === id);
  if (index === -1) return null;
  
  const updated = {
    ...contas[index],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  contas[index] = updated;
  setCollection('contas_pagar', contas);
  return updated;
}
