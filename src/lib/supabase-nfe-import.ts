// ============================================
// IMPORTAÇÃO DE NF-e DIRETO NO SUPABASE
// Substitui local-db-nfe.ts para persistência real
// ============================================

import { supabase } from '@/integrations/supabase/client';
import { getUserCompanyId } from '@/hooks/use-user-company';
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
  papel: 'FORNECEDOR' | 'CLIENTE' | 'TRANSPORTADORA',
  companyId: string  // ← recebe company_id como parâmetro
): Promise<{ id: string; isNew: boolean }> {
  const docLimpo = entidadeXML.documento.replace(/\D/g, '');
  
  // Buscar entidade existente pelo documento dentro da mesma empresa
  const { data: existente } = await supabase
    .from('entidades')
    .select('id')
    .eq('documento', docLimpo)
    .eq('company_id', companyId)  // ← filtrar por empresa
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
  
  // Criar nova entidade COM company_id
  const { data: novaEntidade, error } = await supabase
    .from('entidades')
    .insert({
      company_id: companyId,  // ← FIX: company_id obrigatório
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
  companyId: string  // ← recebe company_id como parâmetro
): Promise<{ id: string; isNew: boolean }> {
  const ean = itemXML.ean && itemXML.ean !== 'SEM GTIN' ? itemXML.ean.replace(/\D/g, '') : null;
  const ncm = itemXML.ncm;
  const descricao = itemXML.descricao;
  
  // 1. Buscar por EAN dentro da mesma empresa
  if (ean) {
    const { data: itemPorEan } = await supabase
      .from('itens')
      .select('id')
      .eq('ean', ean)
      .eq('company_id', companyId)  // ← filtrar por empresa
      .maybeSingle();
    
    if (itemPorEan) return { id: itemPorEan.id, isNew: false };
  }
  
  // 2. Buscar por descrição exata dentro da mesma empresa
  const { data: itemPorDesc } = await supabase
    .from('itens')
    .select('id')
    .ilike('descricao_interna', descricao)
    .eq('company_id', companyId)  // ← filtrar por empresa
    .maybeSingle();
  
  if (itemPorDesc) return { id: itemPorDesc.id, isNew: false };
  
  // 3. Criar novo item COM company_id
  const tipoItem = mapClassificacaoToTipo(classificacao, descricao);
  const uCom = itemXML.unidade_comercial.toUpperCase();
  const unidadeInterna = inferirUnidadeInterna(uCom, tipoItem, descricao);
  
  const { data: novoItem, error } = await supabase
    .from('itens')
    .insert({
      company_id: companyId,
      descricao_interna: descricao,
      tipo_item: tipoItem,
      ncm: ncm || null,
      ean: ean || null,
      unidade_interna: unidadeInterna,
      unidade_fornecedor: itemXML.unidade_comercial || null,
      cest: (itemXML as any).cest || null,
      cfop_entrada_padrao: (itemXML as any).cfop || null,
      controla_lote: true,
      controla_validade: true,
      criticidade: tipoItem === 'MP' ? 'CRITICO' : 'NORMAL',
      ativo: true,
    } as any)
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
  const unidadesDiscretas = ['UN', 'UND', 'UNID', 'PCT', 'CX', 'FD', 'MILHEIRO', 'MI'];
  
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
  if (u === 'MI' && unidadeInterna === 'un') return 1000;
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

  // ← FIX: buscar company_id UMA VEZ no início, passar para todas as funções
  const companyId = await getUserCompanyId();
  if (!companyId) {
    throw new Error('Empresa não configurada. Configure sua empresa antes de importar NF-e.');
  }

  const stats: ImportStats = {
    entidadesCriadas: 0,
    produtosCriados: 0,
    produtosVinculados: 0,
    lotesCriados: 0,
    contasPagarGeradas: 0,
  };
  
  // Track created resources for rollback on failure
  const createdResources: { table: string; id: string }[] = [];
  
  const classificacao = classificacaoManual || parseResult.notaFiscal.classificacao;
  
  try {
    // 1. Criar/vincular emitente como fornecedor
    const emitente = await findOrCreateEntidadeSupabase(parseResult.emitente, 'FORNECEDOR', companyId);
    if (emitente.isNew) {
      stats.entidadesCriadas++;
      createdResources.push({ table: 'entidades', id: emitente.id });
    }
    
    // Destinatário
    if (parseResult.destinatario) {
      const dest = await findOrCreateEntidadeSupabase(parseResult.destinatario, 'CLIENTE', companyId);
      if (dest.isNew) {
        stats.entidadesCriadas++;
        createdResources.push({ table: 'entidades', id: dest.id });
      }
    }
    
    // Transportadora
    if (parseResult.transportadora?.documento) {
      const transp = await findOrCreateEntidadeSupabase(parseResult.transportadora, 'TRANSPORTADORA', companyId);
      if (transp.isNew) {
        stats.entidadesCriadas++;
        createdResources.push({ table: 'entidades', id: transp.id });
      }
    }
    
    // 2. Criar nota_entrada no Supabase COM company_id
    const { data: notaEntrada, error: notaError } = await supabase
      .from('notas_entrada')
      .insert({
        company_id: companyId,  // ← FIX: company_id obrigatório
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
    
    createdResources.push({ table: 'notas_entrada', id: notaEntrada.id });
    
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
        const result = await findOrCreateItemSupabase(itemData.item, classificacao, companyId);
        itemId = result.id;
        isNew = result.isNew;
        if (isNew) {
          stats.produtosCriados++;
          createdResources.push({ table: 'itens', id: itemId });
        } else {
          stats.produtosVinculados++;
        }
      }
      
      // Atualizar dados fiscais e comerciais do item com dados do XML
      const impostos = itemData.impostos;
      const uComItem = itemData.item.unidade_comercial.toUpperCase();
      const unidadeInternaCalc = configManual?.unidadeInterna || inferirUnidadeInterna(uComItem, mapClassificacaoToTipo(classificacao, itemData.item.descricao), itemData.item.descricao);
      const fatorConv = configManual?.fatorConversao || calcularFatorConversao(uComItem, unidadeInternaCalc);
      const custoInterno = itemData.item.valor_total / (itemData.item.quantidade_comercial * fatorConv);
      
      const fiscalUpdate: Record<string, unknown> = {};
      if (impostos.icms_origem) fiscalUpdate.origem_icms = impostos.icms_origem;
      if (impostos.icms_cst) fiscalUpdate.cst_icms = impostos.icms_cst;
      if (impostos.icms_aliquota) fiscalUpdate.aliquota_icms = impostos.icms_aliquota;
      if (impostos.icms_st_mva) fiscalUpdate.mva_st = impostos.icms_st_mva;
      if (impostos.ipi_cst) fiscalUpdate.cst_ipi = impostos.ipi_cst;
      if (impostos.ipi_aliquota) fiscalUpdate.aliquota_ipi = impostos.ipi_aliquota;
      if (impostos.pis_cst) fiscalUpdate.cst_pis = impostos.pis_cst;
      if (impostos.pis_aliquota) fiscalUpdate.aliquota_pis = impostos.pis_aliquota;
      if (impostos.cofins_cst) fiscalUpdate.cst_cofins = impostos.cofins_cst;
      if (impostos.cofins_aliquota) fiscalUpdate.aliquota_cofins = impostos.cofins_aliquota;
      if (itemData.item.cest) fiscalUpdate.cest = itemData.item.cest;
      if (itemData.item.cfop) fiscalUpdate.cfop_entrada_padrao = itemData.item.cfop;
      // Dados comerciais
      fiscalUpdate.unidade_fornecedor = itemData.item.unidade_comercial;
      fiscalUpdate.preco_unitario_fornecedor = itemData.item.valor_unitario_comercial;
      fiscalUpdate.custo_por_unidade_interna = custoInterno;
      
      if (Object.keys(fiscalUpdate).length > 0) {
        await supabase.from('itens').update(fiscalUpdate).eq('id', itemId);
      }
      
      // Vincular fornecedor ao item (upsert para não duplicar)
      const { data: existingLink } = await supabase
        .from('item_fornecedores')
        .select('id')
        .eq('item_id', itemId)
        .eq('fornecedor_id', emitente.id)
        .maybeSingle();
      
      if (!existingLink) {
        const { data: newLink, error: linkError } = await supabase.from('item_fornecedores').insert({
          item_id: itemId,
          fornecedor_id: emitente.id,
          codigo_fornecedor: itemData.item.codigo_produto || null,
          descricao_fornecedor: itemData.item.descricao || null,
          unidade_compra_padrao: itemData.item.unidade_comercial || null,
          fator_para_unidade_interna: configManual?.fatorConversao || calcularFatorConversao(
            itemData.item.unidade_comercial.toUpperCase(),
            configManual?.unidadeInterna || inferirUnidadeInterna(
              itemData.item.unidade_comercial.toUpperCase(),
              mapClassificacaoToTipo(classificacao, itemData.item.descricao),
              itemData.item.descricao
            )
          ),
          preco_referencia: itemData.item.valor_unitario_comercial,
        }).select('id').single();
        
        if (linkError) {
          console.error(`[NF-e Import] Erro ao vincular fornecedor ao item:`, linkError.message);
        }
        
        if (newLink) createdResources.push({ table: 'item_fornecedores', id: newLink.id });
      }
      
      // Criar item da nota COM company_id
      const { data: notaItem, error: notaItemError } = await supabase
        .from('notas_entrada_itens')
        .insert({
          company_id: companyId,  // ← FIX: company_id obrigatório
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
      
      if (notaItemError || !notaItem) {
        console.error(`Erro ao salvar item ${itemIndex} da nota:`, notaItemError?.message);
        continue;
      }
      
      createdResources.push({ table: 'notas_entrada_itens', id: notaItem.id });
      
      // Determinar fator de conversão
      const uCom = itemData.item.unidade_comercial.toUpperCase();
      const unidadeInterna = configManual?.unidadeInterna || inferirUnidadeInterna(uCom, mapClassificacaoToTipo(classificacao, itemData.item.descricao), itemData.item.descricao);
      const fatorConversao = configManual?.fatorConversao || calcularFatorConversao(uCom, unidadeInterna);
      
      // Criar lotes — todos entram em QUARENTENA
      const rastros = itemData.rastros.length > 0 ? itemData.rastros : [null];
      
      for (const rastro of rastros) {
        const qtdOriginal = rastro?.quantidade || itemData.item.quantidade_comercial;
        const qtdInterna = qtdOriginal * fatorConversao;
        const custoInterno = itemData.item.valor_total / (itemData.item.quantidade_comercial * fatorConversao);
        
        const { data: lote, error: loteError } = await supabase.from('estoque_lotes').insert({
          company_id: companyId,      // ← FIX: company_id obrigatório
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
        }).select('id').single();
        
        if (loteError) {
          console.error(`Erro ao criar lote para item ${itemIndex}:`, loteError.message);
          continue;
        }
        
        if (lote) createdResources.push({ table: 'estoque_lotes', id: lote.id });
        stats.lotesCriados++;
      }
    }
    
    // 4. Gerar contas a pagar (se houver duplicatas)
    if (parseResult.duplicatas.length > 0) {
      const totalParcelas = parseResult.duplicatas.length;
      for (let i = 0; i < parseResult.duplicatas.length; i++) {
        const dup = parseResult.duplicatas[i];
        const { data: conta, error: contaError } = await supabase.from('contas_pagar').insert({
          company_id: companyId,
          nota_entrada_id: notaEntrada.id,
          duplicata_id: dup.numero || null,
          fornecedor_id: emitente.id,
          descricao: `NF-e ${parseResult.notaFiscal.numero} - Dup ${dup.numero}`,
          numero_parcela: i + 1,
          total_parcelas: totalParcelas,
          valor: dup.valor,
          data_emissao: parseResult.notaFiscal.dh_emissao?.split('T')[0] || new Date().toISOString().split('T')[0],
          data_vencimento: dup.data_vencimento,
          status: 'pendente',
          categoria: 'COMPRAS',
        }).select('id').single();
        
        if (contaError) {
          console.error('[NF-e Import] Erro ao criar conta a pagar:', contaError.message);
        }
        if (conta) createdResources.push({ table: 'contas_pagar', id: conta.id });
        stats.contasPagarGeradas++;
      }
    }
    
    return { notaId: notaEntrada.id, stats };
    
  } catch (error) {
    // ROLLBACK: Apagar tudo que foi criado nesta importação (ordem reversa)
    console.error('[NF-e Import] Erro durante importação, iniciando rollback:', error);
    
    const rollbackOrder = [...createdResources].reverse();
    for (const resource of rollbackOrder) {
      try {
        await supabase.from(resource.table as any).delete().eq('id', resource.id);
      } catch (rollbackErr) {
        console.warn(`[Rollback] Falha ao remover ${resource.table}/${resource.id}:`, rollbackErr);
      }
    }
    
    throw new Error(
      `Importação falhou e foi revertida. Nenhum dado parcial ficou no sistema. ` +
      `Erro original: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

// ============================================
// REVERTER IMPORTAÇÃO DE NF-e
// Remove todos os dados associados a uma nota
// ============================================
export async function reverterImportacaoNFe(notaId: string): Promise<void> {
  // 1. Buscar itens da nota para encontrar lotes
  const { data: notaItens } = await supabase
    .from('notas_entrada_itens')
    .select('id')
    .eq('nota_entrada_id', notaId);
  
  if (notaItens && notaItens.length > 0) {
    const notaItemIds = notaItens.map(ni => ni.id);
    
    // 2. Apagar lotes vinculados
    for (const niId of notaItemIds) {
      await supabase.from('estoque_lotes').delete().eq('nota_entrada_item_id', niId);
    }
    
    // 3. Apagar itens da nota
    await supabase.from('notas_entrada_itens').delete().eq('nota_entrada_id', notaId);
  }
  
  // 4. Apagar contas a pagar geradas por esta nota
  await supabase.from('contas_pagar').delete().eq('nota_entrada_id', notaId);
  
  // 5. Apagar a nota
  await supabase.from('notas_entrada').delete().eq('id', notaId);
}

// ============================================
// BACKFILL: Re-parse XMLs e atualizar itens com dados fiscais
// ============================================
export async function backfillFiscalDataFromXML(): Promise<{ updated: number; errors: number }> {
  const { parseNFeCompleto } = await import('@/lib/nfe-parser-completo');
  
  // Buscar notas com XML
  const { data: notas } = await supabase
    .from('notas_entrada')
    .select('id, xml_raw')
    .not('xml_raw', 'is', null);
  
  if (!notas || notas.length === 0) return { updated: 0, errors: 0 };
  
  let updated = 0;
  let errors = 0;
  
  for (const nota of notas) {
    try {
      const parsed = parseNFeCompleto(nota.xml_raw!);
      if (!parsed) continue;
      
      // Buscar itens vinculados a esta nota
      const { data: notaItens } = await supabase
        .from('notas_entrada_itens')
        .select('item_id, codigo_fornecedor')
        .eq('nota_entrada_id', nota.id);
      
      if (!notaItens) continue;
      
      for (const notaItem of notaItens) {
        if (!notaItem.item_id) continue;
        
        // Encontrar item correspondente no parse result
        const parsedItem = parsed.itens.find(pi => 
          pi.item.codigo_produto === notaItem.codigo_fornecedor
        );
        
        if (!parsedItem) continue;
        
        const imp = parsedItem.impostos;
        const updateData: Record<string, unknown> = {};
        
        if (imp.icms_origem) updateData.origem_icms = imp.icms_origem;
        if (imp.icms_cst) updateData.cst_icms = imp.icms_cst;
        if (imp.icms_aliquota) updateData.aliquota_icms = imp.icms_aliquota;
        if (imp.icms_st_mva) updateData.mva_st = imp.icms_st_mva;
        if (imp.ipi_cst) updateData.cst_ipi = imp.ipi_cst;
        if (imp.ipi_aliquota) updateData.aliquota_ipi = imp.ipi_aliquota;
        if (imp.pis_cst) updateData.cst_pis = imp.pis_cst;
        if (imp.pis_aliquota) updateData.aliquota_pis = imp.pis_aliquota;
        if (imp.cofins_cst) updateData.cst_cofins = imp.cofins_cst;
        if (imp.cofins_aliquota) updateData.aliquota_cofins = imp.cofins_aliquota;
        if (parsedItem.item.cest) updateData.cest = parsedItem.item.cest;
        
        if (Object.keys(updateData).length > 0) {
          await supabase.from('itens').update(updateData).eq('id', notaItem.item_id);
          updated++;
        }
      }
    } catch (err) {
      console.error(`[Backfill] Erro ao processar nota ${nota.id}:`, err);
      errors++;
    }
  }
  
  return { updated, errors };
}
