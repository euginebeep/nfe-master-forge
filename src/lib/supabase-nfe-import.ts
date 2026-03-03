// ============================================
// IMPORTAÇÃO DE NF-e DIRETO NO SUPABASE
// Substitui local-db-nfe.ts para persistência real
// ============================================

import { supabase } from '@/integrations/supabase/client';
import type { NFeParseResult, ClassificacaoNota, EntidadeXML } from '@/types/nfe-completa';

export interface ImportStats {
  entidadesCriadas: number;
  produtosCriados: number;
  produtosVinculados: number;
  lotesCriados: number;
  contasPagarGeradas: number;
}

export interface ItemImportConfig {
  itemIndex: number;
  unidadeInterna: string;
  fatorConversao: number;
  vinculoItemId?: string;
}

// ============================================
// CHECK DUPLICIDADE NO SUPABASE
// ============================================
export async function checkNotaFiscalExistsSupabase(chaveAcesso: string): Promise<{ id: string; numero: string } | null> {
  const { data } = await supabase
    .from('notas_entrada')
    .select('id, numero')
    .eq('chave_nfe', chaveAcesso)
    .maybeSingle();
  
  return data ? { id: data.id, numero: data.numero || '' } : null;
}

// ============================================
// BUSCAR OU CRIAR ENTIDADE NO SUPABASE
// ============================================
async function findOrCreateEntidadeSupabase(
  entidadeXML: EntidadeXML,
  papel: 'FORNECEDOR' | 'CLIENTE' | 'TRANSPORTADORA'
): Promise<{ id: string; isNew: boolean }> {
  const docLimpo = entidadeXML.documento.replace(/\D/g, '');
  
  // Buscar entidade existente pelo documento
  const { data: existente } = await supabase
    .from('entidades')
    .select('id')
    .eq('documento', docLimpo)
    .maybeSingle();
  
  if (existente) {
    // Verificar se já tem o papel
    const { data: papelExistente } = await supabase
      .from('entidade_papeis')
      .select('id')
      .eq('entidade_id', existente.id)
      .eq('papel', papel)
      .maybeSingle();
    
    if (!papelExistente) {
      await supabase.from('entidade_papeis').insert({
        entidade_id: existente.id,
        papel,
      });
    }
    
    return { id: existente.id, isNew: false };
  }
  
  // Criar nova entidade
  const { data: novaEntidade, error } = await supabase
    .from('entidades')
    .insert({
      tipo_pessoa: entidadeXML.tipo_pessoa === 'PJ' ? 'PJ' : 'PF',
      documento: docLimpo,
      razao_social: entidadeXML.razao_social,
      nome_fantasia: entidadeXML.nome_fantasia || null,
      ie: entidadeXML.ie || null,
      im: entidadeXML.im || null,
      cnae: entidadeXML.cnae || null,
      crt: entidadeXML.crt || null,
      status: 'ATIVO',
      classificacao: 'REGULAR',
      tags: ['IMPORTADO_XML'],
    })
    .select('id')
    .single();
  
  if (error || !novaEntidade) {
    throw new Error(`Erro ao criar entidade: ${error?.message}`);
  }
  
  // Criar papel
  await supabase.from('entidade_papeis').insert({
    entidade_id: novaEntidade.id,
    papel,
  });
  
  // Criar endereço se existir
  if (entidadeXML.endereco) {
    await supabase.from('entidade_enderecos').insert({
      entidade_id: novaEntidade.id,
      tipo: 'FISCAL',
      logradouro: entidadeXML.endereco.logradouro || null,
      nro: entidadeXML.endereco.numero || null,
      compl: entidadeXML.endereco.complemento || null,
      bairro: entidadeXML.endereco.bairro || null,
      cidade: entidadeXML.endereco.municipio || null,
      uf: entidadeXML.endereco.uf || null,
      cep: entidadeXML.endereco.cep || null,
      cmun: entidadeXML.endereco.codigo_municipio || null,
      pais: entidadeXML.endereco.pais || 'Brasil',
      cpais: entidadeXML.endereco.codigo_pais || '1058',
    });
  }
  
  // Criar contato
  if (entidadeXML.email || entidadeXML.telefone) {
    await supabase.from('entidade_contatos').insert({
      entidade_id: novaEntidade.id,
      nome: 'Contato Principal',
      email: entidadeXML.email || null,
      telefone: entidadeXML.telefone || null,
      preferencial: true,
      origem: 'XML',
    });
  }
  
  return { id: novaEntidade.id, isNew: true };
}

// ============================================
// BUSCAR OU CRIAR ITEM NO SUPABASE
// ============================================
async function findOrCreateItemSupabase(
  itemXML: NFeParseResult['itens'][0]['item'],
  classificacao: ClassificacaoNota,
): Promise<{ id: string; isNew: boolean }> {
  const ean = itemXML.ean && itemXML.ean !== 'SEM GTIN' ? itemXML.ean.replace(/\D/g, '') : null;
  const ncm = itemXML.ncm;
  const descricao = itemXML.descricao;
  
  // 1. Buscar por EAN
  if (ean) {
    const { data: itemPorEan } = await supabase
      .from('itens')
      .select('id')
      .eq('ean', ean)
      .maybeSingle();
    
    if (itemPorEan) return { id: itemPorEan.id, isNew: false };
  }
  
  // 2. Buscar por descrição exata
  const { data: itemPorDesc } = await supabase
    .from('itens')
    .select('id')
    .ilike('descricao_interna', descricao)
    .maybeSingle();
  
  if (itemPorDesc) return { id: itemPorDesc.id, isNew: false };
  
  // 3. Criar novo item
  const tipoItem = mapClassificacaoToTipo(classificacao, descricao);
  const uCom = itemXML.unidade_comercial.toUpperCase();
  const unidadeInterna = inferirUnidadeInterna(uCom, tipoItem, descricao);
  
  const { data: novoItem, error } = await supabase
    .from('itens')
    .insert({
      descricao_interna: descricao,
      tipo_item: tipoItem,
      ncm: ncm || null,
      ean: ean || null,
      unidade_interna: unidadeInterna,
      controla_lote: true,
      controla_validade: true,
      criticidade: tipoItem === 'MP' ? 'CRITICO' : 'NORMAL',
      ativo: true,
    })
    .select('id')
    .single();
  
  if (error || !novoItem) {
    throw new Error(`Erro ao criar item: ${error?.message}`);
  }
  
  return { id: novoItem.id, isNew: true };
}

function mapClassificacaoToTipo(classificacao: ClassificacaoNota, descricao: string): string {
  const descNorm = descricao.toUpperCase();
  if (descNorm.includes('CAPSULA') || descNorm.includes('CÁPSULA')) return 'CAPSULA_VAZIA';
  if (descNorm.includes('ROTULO') || descNorm.includes('RÓTULO')) return 'ROTULO';
  if (descNorm.includes('TAMPA')) return 'TAMPA';
  if (descNorm.includes('POTE') || descNorm.includes('FRASCO')) return 'POTE';
  if (descNorm.includes('SILICA') || descNorm.includes('SÍLICA')) return 'SILICA';
  
  switch (classificacao) {
    case 'MATERIA_PRIMA': return 'MP';
    case 'EMBALAGEM': return 'EMBALAGEM';
    case 'INSUMO_CONSUMO': return 'OUTRO';
    case 'PRODUTO_TERCEIRO': return 'PA';
    default: return 'MP';
  }
}

function inferirUnidadeInterna(uCom: string, tipoItem: string, descricao: string): string {
  const isEmbalagem = ['EMBALAGEM', 'CAPSULA_VAZIA', 'ROTULO', 'TAMPA', 'POTE', 'SILICA'].includes(tipoItem);
  const unidadesDiscretas = ['UN', 'UND', 'UNID', 'PCT', 'CX', 'FD', 'MILHEIRO'];
  
  if (isEmbalagem || unidadesDiscretas.includes(uCom)) return 'un';
  if (uCom === 'KG' || uCom === 'G') return 'g';
  if (uCom === 'MG') return 'mg';
  if (uCom === 'ML' || uCom === 'L' || uCom === 'LT') return 'ml';
  return 'g';
}

function calcularFatorConversao(uCom: string, unidadeInterna: string): number {
  const u = uCom.toUpperCase();
  if (u === unidadeInterna.toUpperCase()) return 1;
  if (u === 'KG' && unidadeInterna === 'g') return 1000;
  if (u === 'G' && unidadeInterna === 'g') return 1;
  if (u === 'MG' && unidadeInterna === 'mg') return 1;
  if (u === 'L' && unidadeInterna === 'ml') return 1000;
  if (u === 'LT' && unidadeInterna === 'ml') return 1000;
  if (u === 'ML' && unidadeInterna === 'ml') return 1;
  if (u === 'MILHEIRO' && unidadeInterna === 'un') return 1000;
  if (u === 'TON' && unidadeInterna === 'g') return 1000000;
  return 1;
}

// ============================================
// IMPORTAR NF-e COMPLETA NO SUPABASE
// ============================================
export async function importarNFeCompletaSupabase(
  parseResult: NFeParseResult,
  classificacaoManual?: ClassificacaoNota,
  configuracoesItens?: ItemImportConfig[]
): Promise<{ notaId: string; stats: ImportStats }> {
  const stats: ImportStats = {
    entidadesCriadas: 0,
    produtosCriados: 0,
    produtosVinculados: 0,
    lotesCriados: 0,
    contasPagarGeradas: 0,
  };
  
  const classificacao = classificacaoManual || parseResult.notaFiscal.classificacao;
  
  // 1. Criar/vincular emitente como fornecedor
  const emitente = await findOrCreateEntidadeSupabase(parseResult.emitente, 'FORNECEDOR');
  if (emitente.isNew) stats.entidadesCriadas++;
  
  // Destinatário
  if (parseResult.destinatario) {
    const dest = await findOrCreateEntidadeSupabase(parseResult.destinatario, 'CLIENTE');
    if (dest.isNew) stats.entidadesCriadas++;
  }
  
  // Transportadora
  if (parseResult.transportadora?.documento) {
    const transp = await findOrCreateEntidadeSupabase(parseResult.transportadora, 'TRANSPORTADORA');
    if (transp.isNew) stats.entidadesCriadas++;
  }
  
  // 2. Criar nota_entrada no Supabase
  const { data: notaEntrada, error: notaError } = await supabase
    .from('notas_entrada')
    .insert({
      chave_nfe: parseResult.notaFiscal.chave_acesso,
      fornecedor_id: emitente.id,
      xml_raw: parseResult.notaFiscal.xml_raw || null,
      numero: parseResult.notaFiscal.numero,
      serie: parseResult.notaFiscal.serie,
      modelo: parseResult.notaFiscal.modelo,
      dh_emissao: parseResult.notaFiscal.dh_emissao || new Date().toISOString(),
      total_produtos: parseResult.totaisImpostos.valor_produtos,
      total_nota: parseResult.totaisImpostos.valor_nota,
      status: 'IMPORTADA',
    })
    .select('id')
    .single();
  
  if (notaError || !notaEntrada) {
    throw new Error(`Erro ao salvar nota de entrada: ${notaError?.message}`);
  }
  
  // 3. Processar cada item
  for (let itemIndex = 0; itemIndex < parseResult.itens.length; itemIndex++) {
    const itemData = parseResult.itens[itemIndex];
    const configManual = configuracoesItens?.find(c => c.itemIndex === itemIndex);
    
    let itemId: string;
    let isNew: boolean;
    
    if (configManual?.vinculoItemId) {
      itemId = configManual.vinculoItemId;
      isNew = false;
      stats.produtosVinculados++;
    } else {
      const result = await findOrCreateItemSupabase(itemData.item, classificacao);
      itemId = result.id;
      isNew = result.isNew;
      if (isNew) stats.produtosCriados++;
      else stats.produtosVinculados++;
    }
    
    // Vincular fornecedor ao item (upsert para não duplicar)
    const { data: existingLink } = await supabase
      .from('item_fornecedores')
      .select('id')
      .eq('item_id', itemId)
      .eq('fornecedor_id', emitente.id)
      .maybeSingle();
    
    if (!existingLink) {
      await supabase.from('item_fornecedores').insert({
        item_id: itemId,
        fornecedor_id: emitente.id,
        codigo_fornecedor: itemData.item.codigo_produto || null,
        descricao_fornecedor: itemData.item.descricao || null,
        unidade_fornecedor: itemData.item.unidade_comercial || null,
        fator_para_unidade_interna: configManual?.fatorConversao || calcularFatorConversao(
          itemData.item.unidade_comercial.toUpperCase(),
          configManual?.unidadeInterna || inferirUnidadeInterna(
            itemData.item.unidade_comercial.toUpperCase(),
            mapClassificacaoToTipo(classificacao, itemData.item.descricao),
            itemData.item.descricao
          )
        ),
        ean: itemData.item.ean && itemData.item.ean !== 'SEM GTIN' ? itemData.item.ean : null,
        ultimo_preco: itemData.item.valor_unitario_comercial,
      });
    }
    
    // Criar item da nota
    const { data: notaItem } = await supabase
      .from('notas_entrada_itens')
      .insert({
        nota_entrada_id: notaEntrada.id,
        item_id: itemId,
        codigo_fornecedor: itemData.item.codigo_produto,
        descricao: itemData.item.descricao,
        ncm: itemData.item.ncm || null,
        cfop: itemData.item.cfop || null,
        ean: itemData.item.ean || null,
        ucom: itemData.item.unidade_comercial,
        qcom: itemData.item.quantidade_comercial,
        vuncom: itemData.item.valor_unitario_comercial,
        vprod: itemData.item.valor_total,
      })
      .select('id')
      .single();
    
    if (!notaItem) continue;
    
    // Determinar fator de conversão
    const uCom = itemData.item.unidade_comercial.toUpperCase();
    const unidadeInterna = configManual?.unidadeInterna || inferirUnidadeInterna(uCom, mapClassificacaoToTipo(classificacao, itemData.item.descricao), itemData.item.descricao);
    const fatorConversao = configManual?.fatorConversao || calcularFatorConversao(uCom, unidadeInterna);
    
    // Todos os lotes importados via NF-e entram em QUARENTENA para controle de qualidade
    
    // Criar lotes
    const rastros = itemData.rastros.length > 0 ? itemData.rastros : [null];
    
    for (const rastro of rastros) {
      const qtdOriginal = rastro?.quantidade || itemData.item.quantidade_comercial;
      const qtdInterna = qtdOriginal * fatorConversao;
      const custoInterno = itemData.item.valor_total / (itemData.item.quantidade_comercial * fatorConversao);
      
      await supabase.from('estoque_lotes').insert({
        item_id: itemId,
        fornecedor_id: emitente.id,
        nota_entrada_item_id: notaItem.id,
        numero_lote: rastro?.numero_lote || `LOTE-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
        data_fab: rastro?.data_fabricacao || null,
        data_val: rastro?.data_validade || null,
        quantidade_original: qtdOriginal,
        unidade_original: uCom,
        quantidade_interna: qtdInterna,
        custo_unitario_original: itemData.item.valor_unitario_comercial,
        custo_unitario_interno: custoInterno,
        status: 'QUARENTENA',
      });
      
      stats.lotesCriados++;
    }
  }
  
  // 4. Gerar contas a pagar (se houver duplicatas)
  if (parseResult.duplicatas.length > 0) {
    for (const dup of parseResult.duplicatas) {
      await supabase.from('contas_receber').insert({
        descricao: `NF-e ${parseResult.notaFiscal.numero} - Dup ${dup.numero}`,
        valor: dup.valor,
        data_vencimento: dup.data_vencimento,
        data_emissao: parseResult.notaFiscal.dh_emissao?.split('T')[0] || new Date().toISOString().split('T')[0],
        status: 'pendente',
        cliente_id: emitente.id,
      });
      stats.contasPagarGeradas++;
    }
  }
  
  return { notaId: notaEntrada.id, stats };
}
