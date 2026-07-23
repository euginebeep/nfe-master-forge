// ============================================
// IMPORTAÇÃO DE NF-e DIRETO NO SUPABASE
// Substitui local-db-nfe.ts para persistência real
// ============================================

import { supabase } from '@/integrations/supabase/client';
import { getUserCompanyId } from '@/hooks/use-user-company';
import type { NFeParseResult, ClassificacaoNota, EntidadeXML } from '@/types/nfe-completa';
import { preprocessarUnidadeComercial } from '@/lib/unidades-dose';
import { similaridadeAceitaParaEan } from '@/lib/item-similaridade';
import { uploadNfeXmlToStorage } from '@/lib/nfe-xml-storage';

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
  potenciaValor?: number;
  potenciaUnidade?: string;
  tipoPotencia?: string;
  loteManual?: string;
  dataValidadeManual?: string;
  dataFabManual?: string;
  tipoItem?: string;
}

const TIPOS_LOTE_OPCIONAL = new Set(['EMBALAGEM', 'POTE', 'TAMPA', 'ROTULO', 'OUTRO']);
const TIPOS_LOTE_EXIGIDO = new Set(['MP', 'SILICA', 'CAPSULA_VAZIA', 'PREMIX']);

export function tipoExigeLote(tipo?: string | null): boolean {
  const t = (tipo || '').trim().toUpperCase();
  if (!t) return true;
  if (TIPOS_LOTE_OPCIONAL.has(t)) return false;
  if (TIPOS_LOTE_EXIGIDO.has(t)) return true;
  return true;
}

export function extrairLoteDaDescricao(descricao: string): string | null {
  const match = descricao.match(/lote\(?s?\)?\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-\/\.]{2,})/i);
  return match?.[1]?.trim() || null;
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

type PapelEntidadeImport = 'FORNECEDOR' | 'CLIENTE' | 'TRANSPORTADORA';

function formatSupabaseError(error: { message?: string; code?: string } | null): string {
  return error?.message || error?.code || 'erro desconhecido';
}

/** Garante papel em entidade_papeis de forma idempotente (RLS exige company_id). */
async function garantirPapelEntidade(
  entidadeId: string,
  papel: PapelEntidadeImport,
  companyId: string,
): Promise<void> {
  const { data: papelExistente, error: selectError } = await supabase
    .from('entidade_papeis')
    .select('id')
    .eq('entidade_id', entidadeId)
    .eq('papel', papel)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Erro ao verificar papel ${papel}: ${formatSupabaseError(selectError)}`);
  }

  if (papelExistente) return;

  const { error: insertError } = await supabase
    .from('entidade_papeis')
    .insert({
      entidade_id: entidadeId,
      papel,
      company_id: companyId,
    } as { entidade_id: string; papel: string; company_id: string });

  if (insertError) {
    // Concorrência ou duplicata: UNIQUE(entidade_id, papel)
    if (insertError.code === '23505') return;
    throw new Error(`Erro ao atribuir papel ${papel}: ${formatSupabaseError(insertError)}`);
  }
}

/** Grava o endereço fiscal se a entidade ainda não tiver nenhum. */
async function garantirEnderecoEntidade(entidadeId: string, entidadeXML: EntidadeXML) {
  if (!entidadeXML.endereco?.municipio) return;

  const { data: existe } = await supabase
    .from('entidade_enderecos')
    .select('id')
    .eq('entidade_id', entidadeId)
    .limit(1)
    .maybeSingle();

  if (existe) return; // já tem: não sobrescreve edição manual

  await supabase.from('entidade_enderecos').insert({
    entidade_id: entidadeId,
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
    principal: true,
  });
}

/** Grava o contato da NF-e se a entidade ainda não tiver nenhum. */
async function garantirContatoEntidade(entidadeId: string, entidadeXML: EntidadeXML) {
  if (!entidadeXML.email && !entidadeXML.telefone) return;

  const { data: existe } = await supabase
    .from('entidade_contatos')
    .select('id')
    .eq('entidade_id', entidadeId)
    .limit(1)
    .maybeSingle();

  if (existe) return;

  await supabase.from('entidade_contatos').insert({
    entidade_id: entidadeId,
    nome: 'Contato da NF-e',
    email: entidadeXML.email || null,
    telefone: entidadeXML.telefone || null,
    preferencial: true,
    origem: 'XML',
  });
}

// ============================================
// BUSCAR OU CRIAR ENTIDADE NO SUPABASE
// ============================================
async function findOrCreateEntidadeSupabase(
  entidadeXML: EntidadeXML,
  papel: PapelEntidadeImport,
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
    await garantirPapelEntidade(existente.id, papel, companyId);
    await garantirEnderecoEntidade(existente.id, entidadeXML);
    await garantirContatoEntidade(existente.id, entidadeXML);
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
    throw new Error(`Erro ao criar entidade: ${formatSupabaseError(error)}`);
  }
  
  await garantirPapelEntidade(novaEntidade.id, papel, companyId);
  await garantirEnderecoEntidade(novaEntidade.id, entidadeXML);
  await garantirContatoEntidade(novaEntidade.id, entidadeXML);
  
  return { id: novaEntidade.id, isNew: true };
}

// ============================================
// NCM → CLASSIFICAÇÃO DE RISCO E CATEGORIA
// ============================================
const NCM_CLASSIFICACAO: Record<string, { risco: string; categoria: string }> = {
  '2936': { risco: 'CRITICO', categoria: 'VITAMINA' },
  '2935': { risco: 'ATENCAO', categoria: 'SULFONAMIDA' },
  '2933': { risco: 'ATENCAO', categoria: 'COMPOSTO_HETEROCICLICO' },
  '2930': { risco: 'NORMAL', categoria: 'AMINOACIDO_ENXOFRE' },
  '2106': { risco: 'NORMAL', categoria: 'PREPARACAO_ALIMENTICIA' },
  '1302': { risco: 'NORMAL', categoria: 'EXTRATO_VEGETAL' },
  '1211': { risco: 'NORMAL', categoria: 'PLANTA_MEDICINAL' },
  '0511': { risco: 'NORMAL', categoria: 'PRODUTO_ANIMAL' },
  '2309': { risco: 'NORMAL', categoria: 'PREPARACAO_ANIMAL' },
  '2941': { risco: 'CRITICO', categoria: 'ANTIBIOTICO' },
  '2937': { risco: 'CRITICO', categoria: 'HORMONIO' },
  '2842': { risco: 'ATENCAO', categoria: 'MINERAL_INORGANICO' },
  '2833': { risco: 'ATENCAO', categoria: 'MINERAL_SULFATO' },
  '2836': { risco: 'NORMAL', categoria: 'MINERAL_CARBONATO' },
  '3923': { risco: 'NORMAL', categoria: 'EMBALAGEM_PLASTICA' },
  '4819': { risco: 'NORMAL', categoria: 'EMBALAGEM_PAPEL' },
  '7010': { risco: 'NORMAL', categoria: 'EMBALAGEM_VIDRO' },
};

function classificarPorNCM(ncm: string | undefined): { risco: string; categoria: string } | null {
  if (!ncm) return null;
  const ncmLimpo = ncm.replace(/\D/g, '');
  for (const len of [4, 3, 2]) {
    const prefix = ncmLimpo.substring(0, len);
    if (NCM_CLASSIFICACAO[prefix]) return NCM_CLASSIFICACAO[prefix];
  }
  return null;
}

// ============================================
// REGEX PARA POTÊNCIA NA DESCRIÇÃO DO PRODUTO
// ============================================
function extrairPotenciaDescricao(descricao: string): number | null {
  const desc = preprocessarUnidadeComercial(descricao).toUpperCase();
  const patterns = [
    /(\d+[\.,]?\d*)\s*UI\/G/i,
    /(\d+[\.,]?\d*)\s*MCG\/G/i,
    /(\d+[\.,]?\d*)\s*UI\b/i,
    /(\d+[\.,]?\d*)\s*MCG\b/i,
    /(\d+[\.,]?\d*)\s*MG\b/i,
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return parseFloat(m[1].replace(',', '.'));
  }
  return null;
}

// ============================================
// BUSCAR FATOR UI→MG NA TABELA conversoes_unidades
// ============================================
async function buscarFatorConversaoUI(descricao: string): Promise<number | null> {
  const { data: conversoes } = await supabase
    .from('conversoes_unidades')
    .select('substancia, fator_ui_para_mg')
    .eq('ativo', true);
  
  if (!conversoes || conversoes.length === 0) return null;
  
  const descNorm = descricao.toUpperCase();
  for (const c of conversoes) {
    if (descNorm.includes(c.substancia.toUpperCase())) {
      return c.fator_ui_para_mg;
    }
  }
  return null;
}

// ============================================
// BUSCAR OU CRIAR ITEM NO SUPABASE
// ============================================
async function findOrCreateItemSupabase(
  itemXML: NFeParseResult['itens'][0]['item'],
  classificacao: ClassificacaoNota,
  companyId: string
): Promise<{ id: string; isNew: boolean }> {
  const ean = itemXML.ean && itemXML.ean !== 'SEM GTIN' ? itemXML.ean.replace(/\D/g, '') : null;
  const ncm = itemXML.ncm;
  const descricao = itemXML.descricao;
  
  // 1. Buscar por EAN dentro da mesma empresa (com validação de descrição)
  if (ean) {
    const { data: itemPorEan } = await supabase
      .from('itens')
      .select('id, descricao_interna')
      .eq('ean', ean)
      .eq('company_id', companyId)
      .maybeSingle();

    if (itemPorEan && similaridadeAceitaParaEan(descricao, itemPorEan.descricao_interna)) {
      return { id: itemPorEan.id, isNew: false };
    }
  }
  
  // 2. Buscar por descrição exata dentro da mesma empresa
  const { data: itemPorDesc } = await supabase
    .from('itens')
    .select('id')
    .ilike('descricao_interna', descricao)
    .eq('company_id', companyId)
    .maybeSingle();
  
  if (itemPorDesc) return { id: itemPorDesc.id, isNew: false };
  
  // 3. Criar novo item
  const tipoItem = mapClassificacaoToTipo(classificacao, descricao);
  const uCom = itemXML.unidade_comercial.toUpperCase();
  const unidadeInterna = inferirUnidadeInterna(uCom, tipoItem, descricao);
  
  // Classificação automática por NCM
  const ncmClass = classificarPorNCM(ncm);
  const criticidade = ncmClass?.risco || (tipoItem === 'MP' ? 'CRITICO' : 'NORMAL');
  
  // Potência da descrição (regex)
  const potenciaCompra = extrairPotenciaDescricao(descricao);
  
  // Fator UI→mg (busca na tabela conversoes_unidades)
  let conversaoUiMcg: number | null = null;
  if (descricao.toUpperCase().match(/UI\b/)) {
    conversaoUiMcg = await buscarFatorConversaoUI(descricao);
  }
  
  const insertData: Record<string, unknown> = {
    company_id: companyId,
    descricao_interna: descricao,
    tipo_item: tipoItem,
    ncm: ncm || null,
    ean: ean || null,
    unidade_interna: unidadeInterna,
    unidade_pesagem: unidadeInterna, // Sync: unidade_pesagem = unidade_interna
    unidade_fornecedor: itemXML.unidade_comercial || null,
    cest: (itemXML as any).cest || null,
    cfop_entrada_padrao: (itemXML as any).cfop || null,
    preco_unitario_fornecedor: itemXML.valor_unitario_comercial || null,
    controla_lote: true,
    controla_validade: true,
    criticidade,
    classificacao_risco: ncmClass?.risco || null,
    categoria_operacional: ncmClass?.categoria || null,
    potencia_compra: potenciaCompra,
    ativo: true,
  };
  
  if (conversaoUiMcg) insertData.conversao_ui_mcg = conversaoUiMcg;
  
  const { data: novoItem, error } = await supabase
    .from('itens')
    .insert(insertData as any)
    .select('id')
    .single();
  
  if (error || !novoItem) {
    throw new Error(`Erro ao criar item: ${error?.message}`);
  }
  
  return { id: novoItem.id, isNew: true };
}

export function mapClassificacaoToTipo(classificacao: ClassificacaoNota, descricao: string): string {
  const descNorm = (descricao || '').toUpperCase();
  if (
    descNorm.includes('CAPSULA') ||
    descNorm.includes('CÁPSULA') ||
    /\bCAPS\s+\d/.test(descNorm)
  ) return 'CAPSULA_VAZIA';
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

/**
 * Parses compound units like "500 G", "500G", "250ML", "1.5KG" etc.
 * Returns { multiplier, baseUnit } e.g. "500 G" → { multiplier: 500, baseUnit: "G" }
 */
function parseCompoundUnit(uCom: string): { multiplier: number; baseUnit: string } {
  const u = preprocessarUnidadeComercial(uCom).trim().toUpperCase();
  // Try to match patterns like "500 G", "500G", "1.5 KG", "250ML", "0.5L"
  const match = u.match(/^(\d+(?:[.,]\d+)?)\s*(G|KG|MG|MCG|ML|L|LT|TON|T|UN|UND|UNID)$/);
  if (match) {
    const multiplier = parseFloat(match[1].replace(',', '.'));
    return { multiplier, baseUnit: match[2] };
  }
  return { multiplier: 1, baseUnit: u };
}

function inferirUnidadeInterna(uCom: string, tipoItem: string, descricao: string): string {
  const isEmbalagem = ['EMBALAGEM', 'CAPSULA_VAZIA', 'ROTULO', 'TAMPA', 'POTE', 'SILICA'].includes(tipoItem);
  const unidadesDiscretas = ['UN', 'UND', 'UNID', 'PCT', 'CX', 'FD', 'MILHEIRO', 'MI'];
  
  const { baseUnit } = parseCompoundUnit(uCom);
  
  if (isEmbalagem || unidadesDiscretas.includes(baseUnit)) return 'un';
  if (baseUnit === 'KG' || baseUnit === 'G') return 'g';
  if (baseUnit === 'MG' || baseUnit === 'MCG') return 'mg';
  if (baseUnit === 'ML' || baseUnit === 'L' || baseUnit === 'LT') return 'ml';
  return 'g';
}

/**
 * Calculates the conversion factor from commercial unit to internal unit.
 * Supports compound units: "500 G" → each unit = 500g → factor to 'g' = 500
 * Supports decimals: "0.5 KG" → each unit = 0.5kg = 500g → factor to 'g' = 500
 */
// ============================================
// BLOCO 2: Usar funcoes _uom_* do banco
// ============================================
async function obterUnidadeEFatorDoBank(uCom: string): Promise<{ unidade: string; fator: number }> {
  try {
    // Chamar funcoes SQL do banco: _uom_unidade(ucom) e _uom_fator(ucom)
    const { data, error } = await supabase
      .rpc('get_uom_info', { p_ucom: uCom.toUpperCase() });
    
    if (error || !data) {
      console.warn(`[UOM] Erro ao buscar UOM para "${uCom}":`, error?.message);
      // Fallback para logica local
      return obterUnidadeEFatorLocal(uCom);
    }
    
    return {
      unidade: data.unidade_interna || 'g',
      fator: data.fator_conversao || 1,
    };
  } catch (err) {
    console.warn(`[UOM] Excecao ao chamar RPC:`, err);
    return obterUnidadeEFatorLocal(uCom);
  }
}

// Fallback local se RPC nao existir
function obterUnidadeEFatorLocal(uCom: string): { unidade: string; fator: number } {
  const { multiplier, baseUnit } = parseCompoundUnit(uCom);
  const uComUpper = baseUnit.toUpperCase();
  
  // Tabela de conversao conforme handoff BLOCO 5
  let unidade = 'g';
  let baseFator = 1;
  
  if (['KG', 'G', 'MG', 'MCG'].includes(uComUpper)) {
    unidade = 'g';
    if (uComUpper === 'KG') baseFator = 1000;
    else if (uComUpper === 'G') baseFator = 1;
    else if (uComUpper === 'MG') baseFator = 0.001;
    else if (uComUpper === 'MCG') baseFator = 0.000001;
  } else if (['L', 'LT', 'ML'].includes(uComUpper)) {
    unidade = 'ml';
    if (uComUpper === 'L' || uComUpper === 'LT') baseFator = 1000;
    else if (uComUpper === 'ML') baseFator = 1;
  } else if (['UN', 'UND', 'UNID', 'MILHEIRO', 'MI', 'MIL'].includes(uComUpper)) {
    unidade = 'un';
    if (uComUpper === 'MILHEIRO' || uComUpper === 'MI' || uComUpper === 'MIL') baseFator = 1000;
    else baseFator = 1;
  } else if (['TON', 'T'].includes(uComUpper)) {
    unidade = 'g';
    baseFator = 1000000;
  }
  
  return {
    unidade,
    fator: multiplier * baseFator,
  };
}

function calcularFatorConversao(uCom: string, unidadeInterna: string): number {
  const { multiplier, baseUnit } = parseCompoundUnit(uCom);
  
  // First get the base conversion factor (baseUnit → unidadeInterna)
  let baseFator = 1;
  const intUnit = unidadeInterna.toUpperCase();
  
  if (baseUnit === intUnit) {
    baseFator = 1;
  } else if (baseUnit === 'KG' && intUnit === 'G') {
    baseFator = 1000;
  } else if (baseUnit === 'G' && intUnit === 'KG') {
    baseFator = 0.001;
  } else if (baseUnit === 'G' && intUnit === 'G') {
    baseFator = 1;
  } else if (baseUnit === 'MG' && intUnit === 'MG') {
    baseFator = 1;
  } else if (baseUnit === 'MG' && intUnit === 'G') {
    baseFator = 0.001;
  } else if (baseUnit === 'MCG' && intUnit === 'MG') {
    baseFator = 0.001;
  } else if (baseUnit === 'L' && intUnit === 'ML') {
    baseFator = 1000;
  } else if (baseUnit === 'LT' && intUnit === 'ML') {
    baseFator = 1000;
  } else if (baseUnit === 'ML' && intUnit === 'ML') {
    baseFator = 1;
  } else if (baseUnit === 'MILHEIRO' && intUnit === 'UN') {
    baseFator = 1000;
  } else if (baseUnit === 'MI' && intUnit === 'UN') {
    baseFator = 1000;
  } else if ((baseUnit === 'TON' || baseUnit === 'T') && intUnit === 'G') {
    baseFator = 1000000;
  }
  
  // Multiply by the compound multiplier
  // e.g. "500 G" with interna='kg' → multiplier=500, baseFator=0.001 → 500*0.001 = 0.5
  // e.g. "500 G" with interna='g' → multiplier=500, baseFator=1 → 500
  return multiplier * baseFator;
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

  const chaveNfe = (parseResult.notaFiscal.chave_acesso || '').replace(/\D/g, '');
  if (chaveNfe.length === 44) {
    const { data: jaExiste } = await supabase
      .from('notas_entrada')
      .select('id, numero, serie, dh_emissao, created_at')
      .eq('company_id', companyId)
      .eq('chave_nfe', chaveNfe)
      .maybeSingle();

    if (jaExiste) {
      const quando = jaExiste.dh_emissao || jaExiste.created_at;
      const dataFmt = quando
        ? new Date(quando).toLocaleDateString('pt-BR')
        : 'data desconhecida';
      throw new Error(
        `Nota já importada em ${dataFmt} (NF-e ${jaExiste.numero || '?'}/${jaExiste.serie || '?'}).`,
      );
    }
  }
  
  // Track created resources for rollback on failure (fallback se a RPC falhar)
  const createdResources: { table: string; id: string }[] = [];
  let notaEntradaId: string | null = null;
  
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
    
    // 2. Criar nota_entrada — status IMPORTADA só é confiável após contagem no fim
    const { data: notaEntrada, error: notaError } = await supabase
      .from('notas_entrada')
      .insert({
        company_id: companyId,
        chave_nfe: chaveNfe || parseResult.notaFiscal.chave_acesso,
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
      const msg = notaError?.message || '';
      if (/duplicate|unique|23505/i.test(msg)) {
        throw new Error(
          `Nota já importada (chave duplicada). Não é possível reimportar a mesma NF-e.`,
        );
      }
      throw new Error(`Erro ao salvar nota de entrada: ${notaError?.message}`);
    }
    
    notaEntradaId = notaEntrada.id;
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
      fiscalUpdate.unidade_pesagem = unidadeInternaCalc; // Sync unidade_pesagem
      fiscalUpdate.preco_unitario_fornecedor = itemData.item.valor_unitario_comercial;
      fiscalUpdate.custo_por_unidade_interna = custoInterno;
      fiscalUpdate.fator_conversao = fatorConv;
      
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
        // Verificar se é o primeiro fornecedor → auto-preferencial
        const { count: totalFornecedores } = await supabase
          .from('item_fornecedores')
          .select('id', { count: 'exact', head: true })
          .eq('item_id', itemId);
        
        const isFirstFornecedor = (totalFornecedores || 0) === 0;
        
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
          fornecedor_preferencial: isFirstFornecedor, // Auto-true se 1º fornecedor
        }).select('id').single();
        
        if (linkError) {
          console.error(`[NF-e Import] Erro ao vincular fornecedor ao item:`, formatSupabaseError(linkError));
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
        throw new Error(
          `Falha ao salvar item ${itemIndex + 1} (${itemData.item.descricao}) da nota: ${notaItemError?.message || 'desconhecido'}`
        );
      }
      
      createdResources.push({ table: 'notas_entrada_itens', id: notaItem.id });
      
      // Determinar fator de conversão
      const uCom = itemData.item.unidade_comercial.toUpperCase();
      const unidadeInterna = configManual?.unidadeInterna || inferirUnidadeInterna(uCom, mapClassificacaoToTipo(classificacao, itemData.item.descricao), itemData.item.descricao);
      const fatorConversao = configManual?.fatorConversao || calcularFatorConversao(uCom, unidadeInterna);
      
      // Criar lotes — todos entram em QUARENTENA
      const rastros = itemData.rastros.length > 0 ? itemData.rastros : [null];
      const descricao = itemData.item.descricao;

      let tipoItem = configManual?.tipoItem || mapClassificacaoToTipo(classificacao, descricao);
      if (configManual?.vinculoItemId && !configManual?.tipoItem) {
        const { data: itemTipoRow } = await supabase
          .from('itens')
          .select('tipo_item')
          .eq('id', configManual.vinculoItemId)
          .maybeSingle();
        if (itemTipoRow?.tipo_item) tipoItem = itemTipoRow.tipo_item;
      }

      for (const rastro of rastros) {
        const qtdOriginal = rastro?.quantidade || itemData.item.quantidade_comercial;
        const qtdInterna = qtdOriginal * fatorConversao;
        const custoInterno = itemData.item.valor_total / (itemData.item.quantidade_comercial * fatorConversao);

        let numeroLote = rastro?.numero_lote
          || extrairLoteDaDescricao(descricao)
          || configManual?.loteManual?.trim()
          || null;
        const dataVal = rastro?.data_validade || configManual?.dataValidadeManual || null;
        const dataFab = rastro?.data_fabricacao || configManual?.dataFabManual || null;

        if (!numeroLote) {
          if (tipoExigeLote(tipoItem)) {
            throw new Error(
              `Item ${itemIndex + 1} (${descricao}): ativo sem lote. Informe o nº do lote e a validade antes de importar.`,
            );
          }
          numeroLote = 'S/L';
        }

        const { data: lote, error: loteError } = await supabase.from('estoque_lotes').insert({
          company_id: companyId,
          item_id: itemId,
          fornecedor_id: emitente.id,
          nota_entrada_item_id: notaItem.id,
          numero_lote: numeroLote,
          data_fab: dataFab,
          data_val: dataVal,
          codigo_agregacao: rastro?.codigo_agregacao || null,
          quantidade_original: qtdOriginal,
          unidade_original: uCom,
          quantidade_interna: qtdInterna,
          unidade_interna: unidadeInterna,
          custo_unitario_original: itemData.item.valor_unitario_comercial,
          custo_unitario_interno: custoInterno,
          status: 'QUARENTENA',
          // Potência do lote (informada na importação via COA)
          ...(configManual?.potenciaValor && configManual.potenciaValor > 0 ? {
            tipo_potencia: configManual.tipoPotencia || 'UI_POR_GRAMA',
            potencia_valor: configManual.potenciaValor,
            potencia_unidade: configManual.potenciaUnidade || 'UI/g',
          } : {}),
        } as any).select('id').single();
        
        if (loteError) {
          throw new Error(
            `Falha ao criar lote para o item ${itemIndex + 1} (${itemData.item.descricao}): ${loteError.message}`
          );
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
          console.error('[NF-e Import] Erro ao criar conta a pagar:', formatSupabaseError(contaError));
        }
        if (conta) createdResources.push({ table: 'contas_pagar', id: conta.id });
        stats.contasPagarGeradas++;
      }
    }

    // 5. Confirmar contagem de itens = <det> do XML antes de considerar sucesso
    const { count: itensGravados, error: countErr } = await supabase
      .from('notas_entrada_itens')
      .select('id', { count: 'exact', head: true })
      .eq('nota_entrada_id', notaEntrada.id);

    if (countErr) {
      throw new Error(`Não foi possível validar a contagem de itens: ${countErr.message}`);
    }
    if ((itensGravados ?? 0) !== parseResult.itens.length) {
      throw new Error(
        `Divergência na importação: XML tem ${parseResult.itens.length} itens, ` +
          `gravados ${itensGravados ?? 0}. Importação será revertida.`,
      );
    }

    // 6. Upload do XML no storage (após nota persistida). Falha não é silenciosa.
    const xmlRaw = parseResult.notaFiscal.xml_raw;
    if (xmlRaw && chaveNfe.length === 44) {
      try {
        await uploadNfeXmlToStorage(companyId, chaveNfe, xmlRaw);
      } catch (storageErr) {
        const msg = storageErr instanceof Error ? storageErr.message : String(storageErr);
        console.error('[NF-e Import] Storage XML falhou:', msg);
        // Não faz rollback: xml_raw está no banco e é recuperável via backfill.
        const incomplete = new Error(
          `Nota gravada (id=${notaEntrada.id}), mas o XML NÃO foi salvo no storage: ${msg}. ` +
            `Use Compras → XMLs pendentes para rodar o backfill.`,
        );
        (incomplete as Error & { skipRollback?: boolean }).skipRollback = true;
        throw incomplete;
      }
    }
    
    return { notaId: notaEntrada.id, stats };
    
  } catch (error) {
    if ((error as Error & { skipRollback?: boolean })?.skipRollback) {
      throw error;
    }

    console.error('[NF-e Import] Erro durante importação, iniciando rollback:', error);

    let rollbackConfirmado = false;
    let rollbackDetalhe = '';

    if (notaEntradaId) {
      // Ordem correta de FKs via RPC reescrita (movimentações → lotes → itens → nota)
      const { data: delData, error: delErr } = await supabase.rpc(
        'delete_nota_entrada_completa',
        { p_nota_id: notaEntradaId },
      );
      const r = Array.isArray(delData) ? delData[0] : delData;
      if (!delErr && r?.sucesso) {
        rollbackConfirmado = true;
        rollbackDetalhe = r.mensagem || 'RPC ok';
      } else {
        rollbackDetalhe = delErr?.message || r?.mensagem || 'RPC sem sucesso';
        // Fallback: ordem manual de exclusão (NO ACTION não cascateia)
        try {
          await reverterImportacaoNFe(notaEntradaId);
          const { data: aindaExiste } = await supabase
            .from('notas_entrada')
            .select('id')
            .eq('id', notaEntradaId)
            .maybeSingle();
          rollbackConfirmado = !aindaExiste;
        } catch (fbErr) {
          rollbackDetalhe += ` | fallback: ${fbErr instanceof Error ? fbErr.message : String(fbErr)}`;
        }
      }
    } else {
      // Só entidades/itens avulsos — melhor esforço
      const rollbackOrder = [...createdResources].reverse();
      for (const resource of rollbackOrder) {
        try {
          await supabase.from(resource.table as any).delete().eq('id', resource.id);
        } catch (rollbackErr) {
          console.warn(`[Rollback] Falha ao remover ${resource.table}/${resource.id}:`, rollbackErr);
        }
      }
      rollbackConfirmado = true;
    }

    const original = error instanceof Error ? error.message : String(error);
    if (rollbackConfirmado) {
      throw new Error(
        `Importação falhou e foi revertida. Nenhum dado parcial da nota ficou no sistema. ` +
          `Erro original: ${original}`,
      );
    }
    throw new Error(
      `Importação falhou e o rollback NÃO pôde ser confirmado (${rollbackDetalhe}). ` +
        `Verifique notas de entrada / lotes parcialmente criados. Erro original: ${original}`,
    );
  }
}

// ============================================
// REVERTER IMPORTAÇÃO DE NF-e
// Remove todos os dados associados a uma nota
// ============================================
export async function reverterImportacaoNFe(notaId: string): Promise<void> {
  // Ordem obrigatória com FKs NO ACTION:
  // estoque_movimentacoes → estoque_lotes → notas_entrada_itens → notas_entrada
  // contas_pagar.nota_entrada_id é SET NULL — desvincular antes de apagar a nota.

  const { data: notaItens } = await supabase
    .from('notas_entrada_itens')
    .select('id')
    .eq('nota_entrada_id', notaId);

  const notaItemIds = (notaItens || []).map((ni) => ni.id);

  if (notaItemIds.length > 0) {
    const { data: lotes } = await supabase
      .from('estoque_lotes')
      .select('id')
      .in('nota_entrada_item_id', notaItemIds);

    const loteIds = (lotes || []).map((l) => l.id);
    if (loteIds.length > 0) {
      await supabase.from('estoque_movimentacoes').delete().in('lote_id', loteIds);
      await supabase.from('estoque_lotes').delete().in('id', loteIds);
    }

    await supabase.from('notas_entrada_itens').delete().eq('nota_entrada_id', notaId);
  }

  // SET NULL em vez de delete — não órfã contas a pagar
  await supabase
    .from('contas_pagar')
    .update({ nota_entrada_id: null })
    .eq('nota_entrada_id', notaId);

  await supabase.from('notas_entrada').delete().eq('id', notaId);
}

// ============================================
// BACKFILL: Re-parse XMLs e atualizar itens com dados fiscais
// ============================================
export async function backfillFiscalDataFromXML(): Promise<{ updated: number; errors: number }> {
  const { parseNFeCompleto } = await import('@/lib/nfe-parser-completo');
  
  const companyId = await getUserCompanyId();
  if (!companyId) {
    throw new Error('Empresa não configurada. Configure sua empresa antes de reprocessar NF-e.');
  }

  // Buscar notas com XML
  const { data: notas } = await supabase
    .from('notas_entrada')
    .select('id, xml_raw, fornecedor_id')
    .eq('company_id', companyId)
    .not('xml_raw', 'is', null);
  
  if (!notas || notas.length === 0) return { updated: 0, errors: 0 };
  
  let updated = 0;
  let errors = 0;
  
  for (const nota of notas) {
    try {
      const parsed = parseNFeCompleto(nota.xml_raw!);
      if (!parsed) continue;

      // Defensivo: emitente da nota deve ter papel FORNECEDOR
      if (nota.fornecedor_id) {
        await garantirPapelEntidade(nota.fornecedor_id, 'FORNECEDOR', companyId);
      }
      
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
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[Backfill] Erro ao processar nota ${nota.id}:`, msg);
      errors++;
    }
  }
  
  return { updated, errors };
}
