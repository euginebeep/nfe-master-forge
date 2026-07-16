import { useState, useEffect, useCallback } from 'react';
import { LocalDb } from '@/lib/local-db';
import { toast } from 'sonner';

// ====================================================
// REGRA MESTRE (IMUTÁVEL)
// ====================================================
// TODO INSUMO OU PRODUTO DEVE TER:
// 1) UNIDADE DE COMPRA (FORNECEDOR / FISCAL) – IMUTÁVEL
// 2) UNIDADE INTERNA DE CONTROLE – PADRONIZADA
// 3) FATOR DE CONVERSÃO FIXO ENTRE ELAS
// NUNCA CONFUNDIR UNIDADE FISCAL COM UNIDADE INTERNA.
// ====================================================

// Tipos de item disponíveis no cadastro
export type TipoItemLocal = 
  | 'MP'           // Matéria-prima
  | 'ATIVO'        // Ativo funcional
  | 'EXCIPIENTE'   // Excipiente/veículo
  | 'EMBALAGEM'    // Embalagem genérica
  | 'ROTULO'       // Rótulo
  | 'TAMPA'        // Tampa
  | 'POTE'         // Pote/Frasco
  | 'SILICA'       // Sílica dessecante
  | 'CAPSULA'      // Cápsula vazia
  | 'CAPSULA_VAZIA'// Mantido para retrocompatibilidade
  | 'ACESSORIO'    // Acessório de produção
  | 'PA'           // Produto acabado
  | 'OUTRO';

// Unidades de compra/fornecedor (IMUTÁVEL após cadastro)
export type UnidadeFornecedor = 
  | 'kg' | 'g' | 'mg' | 'mcg' | 'UI'
  | 'un' | 'milheiro' | 'caixa' | 'fardo' | 'pacote'
  | 'l' | 'ml'
  | 'UI_g' | 'mcg_g'; // Concentração

// Unidades internas de controle (padronizadas) — mcg/UI para vitaminas (IN 28)
export type UnidadeInternaLocal = 'g' | 'mg' | 'mcg' | 'UI' | 'kg' | 'un' | 'ml' | 'l';

export interface LocalItem {
  id: string;
  sku_interno: string;
  descricao_interna: string;
  descricao_comercial?: string;
  tipo_item: TipoItemLocal;
  categoria_operacional?: string;
  ncm?: string;
  ean?: string;
  
  // ====================================================
  // UNIDADES E CONVERSÃO (REGRA MESTRE)
  // ====================================================
  // 1. Unidade do Fornecedor (IMUTÁVEL após primeiro registro)
  unidade_fornecedor: UnidadeFornecedor;
  // 2. Unidade Interna de Controle (padronizada)
  unidade_interna: UnidadeInternaLocal;
  // 3. Fator de Conversão FIXO (OBRIGATÓRIO quando unidades diferem)
  // Ex: milheiro → un = 1000, kg → g = 1000, caixa(12) → un = 12
  fator_conversao: number;
  
  // Para ativos com potência (UI/g, mcg/g, %)
  tipo_potencia?: 'NENHUMA' | 'PERCENTUAL' | 'UI_POR_GRAMA' | 'MCG_POR_GRAMA';
  valor_potencia?: number; // Ex: 100000 para 100.000 UI/g
  
  // Para minerais - percentual elementar
  percentual_elementar?: number; // Ex: 16 para Citrato de Magnésio (16% Mg)
  
  controla_lote: boolean;
  controla_validade: boolean;
  criticidade: 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'ULTRA';
  higroscopico: boolean;
  armazenamento: 'AMBIENTE' | 'REFRIGERADO' | 'PROTEGIDO_LUZ' | 'OUTRO';
  unidade_declaracao?: string;
  unidade_pesagem?: string;
  exige_premix: boolean;
  ativo: boolean;
  
  // Campos específicos para cápsulas
  capsula_marca?: string;
  capsula_tamanho?: '000' | '00' | '0' | '1' | '2' | '3' | '4' | '5';
  capsula_cor?: string;
  capsula_material?: 'GELATINA' | 'VEGETAL' | 'HPMC';
  foto_url?: string;
  
  // ====================================================
  // DADOS COMERCIAIS (como aparecem no XML da NF-e)
  // ====================================================
  preco_unitario_fornecedor?: number;     // vUnCom - preço por unidade do fornecedor
  custo_por_unidade_interna?: number;     // Custo calculado por unidade interna
  moq?: number;                           // Quantidade mínima de pedido
  lead_time_dias?: number;                // Prazo de entrega em dias
  observacoes_comerciais?: string;        // Condições, negociações
  
  // ====================================================
  // DADOS FISCAIS COMPLETOS (como aparecem no XML)
  // ====================================================
  // CFOP padrão
  cfop_entrada_padrao?: string;
  cfop_saida_padrao?: string;
  
  // ICMS
  cst_icms?: string;
  aliquota_icms?: number;
  origem_icms?: string;                   // 0=Nacional, 1=Estrangeira, etc
  mva_st?: number;                        // MVA para Substituição Tributária
  
  // IPI
  cst_ipi?: string;
  aliquota_ipi?: number;
  codigo_enquadramento_ipi?: string;
  
  // PIS
  cst_pis?: string;
  aliquota_pis?: number;
  
  // COFINS
  cst_cofins?: string;
  aliquota_cofins?: number;
  
  // Outros
  cest?: string;                          // Código CEST
  codigo_anp?: string;                    // Código ANP (combustíveis)
  observacoes_fiscais?: string;           // Informações adicionais fiscais
  
  created_at?: string;
  updated_at?: string;
}

export interface LocalItemFornecedor {
  id: string;
  item_id: string;
  fornecedor_id: string;
  codigo_fornecedor?: string;
  descricao_fornecedor?: string;
  unidade_compra_padrao: 'kg' | 'g' | 'un';
  fator_para_unidade_interna: number;
  fornecedor_preferencial: boolean;
  preco_referencia?: number;
  created_at?: string;
}

export interface LocalItemAlias {
  id: string;
  item_id: string;
  fornecedor_id?: string;
  tipo: 'ALIAS_FORNECEDOR' | 'ALIAS_INTERNO' | 'ALIAS_MARKETPLACE';
  texto: string;
  created_at?: string;
}

export interface LocalEstoqueLote {
  id: string;
  item_id: string;
  fornecedor_id?: string;
  nota_entrada_item_id?: string;
  numero_lote: string;
  data_fab?: string;
  data_val?: string;
  // Quantidades originais (da nota)
  quantidade_original: number;
  unidade_original: string; // kg, g, un, ml, etc - exatamente como veio na nota
  custo_unitario_original: number;
  valor_total_item: number; // vProd do XML
  // Quantidades internas (convertidas)
  quantidade_interna: number;
  unidade_interna: string; // g, mg, un, ml - unidade padrão interna
  custo_unitario_interno: number;
  fator_conversao: number; // fator usado para converter original → interno
  status: 'QUARENTENA' | 'DISPONIVEL' | 'BLOQUEADO' | 'VENCIDO';
  observacoes_qc?: string;

  // ====================================================
  // POTÊNCIA DO LOTE (COA DO FORNECEDOR)
  // REGRA: INSUMO MESTRE NÃO TEM POTÊNCIA FIXA.
  // A POTÊNCIA (UI/g, mg/g, %) É ATRIBUTO DO LOTE.
  // ====================================================
  tipo_potencia?: 'NENHUMA' | 'PERCENTUAL' | 'UI_POR_GRAMA' | 'MG_POR_GRAMA';
  potencia_valor?: number;       // Ex: 400000 para 400.000 UI/g
  potencia_unidade?: string;     // Ex: "UI/g", "mg/g", "%"
  potencia_observacoes?: string; // Campo livre (ex: "COA DSM, lote 2025")

  // Dados da Nota de Entrada
  nota_numero?: string;
  nota_serie?: string;
  nota_data?: string;
  nota_chave?: string;
  // Impostos completos do item
  icms_base_calculo?: number;
  icms_aliquota?: number;
  icms_valor?: number;
  icms_cst?: string;
  icms_st_base_calculo?: number;
  icms_st_aliquota?: number;
  icms_st_valor?: number;
  ipi_base_calculo?: number;
  ipi_aliquota?: number;
  ipi_valor?: number;
  ipi_cst?: string;
  pis_base_calculo?: number;
  pis_aliquota?: number;
  pis_valor?: number;
  pis_cst?: string;
  cofins_base_calculo?: number;
  cofins_aliquota?: number;
  cofins_valor?: number;
  cofins_cst?: string;
  // Valores adicionais do item
  valor_frete_item?: number;
  valor_seguro_item?: number;
  valor_desconto_item?: number;
  valor_outros_item?: number;
  // Dados do produto na nota (para referência)
  ncm?: string;
  cfop?: string;
  codigo_produto_fornecedor?: string;
  descricao_produto_nota?: string;
  created_at?: string;
}

export interface LocalLoteDocumento {
  id: string;
  lote_id: string;
  tipo_documento: 'COA' | 'FISPQ' | 'CERTIFICADO' | 'OUTRO';
  arquivo_nome: string;
  arquivo_tipo: string;
  arquivo_size: number;
  arquivo_data?: string; // base64 for local storage
  status_validacao: 'PENDENTE' | 'VALIDADO' | 'REJEITADO';
  observacoes?: string;
  created_at?: string;
}

export function useLocalItens(filters?: { tipo_item?: string; ativo?: boolean }) {
  const [itens, setItens] = useState<LocalItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    let data = LocalDb.getCollection<LocalItem>('itens');
    
    if (filters?.tipo_item) {
      data = data.filter(i => i.tipo_item === filters.tipo_item);
    }
    if (filters?.ativo !== undefined) {
      data = data.filter(i => i.ativo === filters.ativo);
    }
    
    setItens(data);
    setLoading(false);
  }, [filters?.tipo_item, filters?.ativo]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection as string | undefined;
      if (!collection || collection === '*' || collection === 'itens') {
        refresh();
      }
    };

    window.addEventListener('localdb:change', handler as EventListener);
    return () => window.removeEventListener('localdb:change', handler as EventListener);
  }, [refresh]);

  return { data: itens, isLoading: loading, refresh };
}

export function useLocalItem(id: string | undefined) {
  const [item, setItem] = useState<LocalItem | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = LocalDb.getById<LocalItem>('itens', id);
    setItem(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { item, isLoading: loading, refresh };
}

export function useCreateItem() {
  const create = useCallback((data: Omit<LocalItem, 'id' | 'sku_interno'> & { sku_interno?: string }) => {
    const sku = data.sku_interno || LocalDb.generateSKU(data.tipo_item);
    
    // Check for duplicate SKU
    const existing = LocalDb.query<LocalItem>('itens', i => i.sku_interno === sku);
    if (existing.length > 0) {
      toast.error('Já existe um item com este SKU');
      return null;
    }

    // Set defaults based on tipo_item
    let controla_lote = data.controla_lote;
    if (data.tipo_item === 'MP' || data.criticidade === 'CRITICO' || data.criticidade === 'ULTRA') {
      controla_lote = true;
    }

    const item = LocalDb.insert<LocalItem>('itens', {
      ...data,
      sku_interno: sku,
      controla_lote,
      ativo: data.ativo !== undefined ? data.ativo : true,
    });

    toast.success('Item criado com sucesso');
    return item;
  }, []);

  return { create };
}

export function useUpdateItem() {
  const update = useCallback((id: string, data: Partial<LocalItem>) => {
    if (data.sku_interno) {
      const existing = LocalDb.query<LocalItem>('itens', i => i.sku_interno === data.sku_interno && i.id !== id);
      if (existing.length > 0) {
        toast.error('Já existe outro item com este SKU');
        return null;
      }
    }

    const updated = LocalDb.update<LocalItem>('itens', id, data);
    if (updated) {
      toast.success('Item atualizado com sucesso');
    }
    return updated;
  }, []);

  return { update };
}

export function useDeleteItem() {
  const deleteItem = useCallback((id: string) => {
    // Delete related records
    const fornecedores = LocalDb.query<LocalItemFornecedor>('item_fornecedores', f => f.item_id === id);
    fornecedores.forEach(f => LocalDb.remove('item_fornecedores', f.id));
    
    const aliases = LocalDb.query<LocalItemAlias>('item_alias', a => a.item_id === id);
    aliases.forEach(a => LocalDb.remove('item_alias', a.id));
    
    const lotes = LocalDb.query<LocalEstoqueLote>('estoque_lotes', l => l.item_id === id);
    lotes.forEach(l => {
      const docs = LocalDb.query<LocalLoteDocumento>('lote_documentos', d => d.lote_id === l.id);
      docs.forEach(d => LocalDb.remove('lote_documentos', d.id));
      LocalDb.remove('estoque_lotes', l.id);
    });
    
    LocalDb.remove('itens', id);
    toast.success('Item excluído com sucesso');
  }, []);

  return { deleteItem };
}

// Item Fornecedores CRUD
export function useItemFornecedores(itemId: string | undefined) {
  const [fornecedores, setFornecedores] = useState<(LocalItemFornecedor & { fornecedor?: Record<string, unknown> })[]>([]);

  const refresh = useCallback(() => {
    if (!itemId) return;
    const data = LocalDb.query<LocalItemFornecedor>('item_fornecedores', f => f.item_id === itemId);
    
    // Enrich with fornecedor data
    const entidades = LocalDb.getCollection<Record<string, unknown>>('entidades');
    const enriched = data.map(f => ({
      ...f,
      fornecedor: entidades.find(e => e.id === f.fornecedor_id),
    }));
    
    setFornecedores(enriched);
  }, [itemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((data: Omit<LocalItemFornecedor, 'id'>) => {
    // Check for duplicate
    const existing = LocalDb.query<LocalItemFornecedor>('item_fornecedores', 
      f => f.item_id === data.item_id && f.fornecedor_id === data.fornecedor_id);
    if (existing.length > 0) {
      toast.error('Este fornecedor já está vinculado ao item');
      return null;
    }

    const record = LocalDb.insert<LocalItemFornecedor>('item_fornecedores', data);
    refresh();
    toast.success('Fornecedor vinculado');
    return record;
  }, [refresh]);

  const update = useCallback((id: string, data: Partial<LocalItemFornecedor>) => {
    LocalDb.update<LocalItemFornecedor>('item_fornecedores', id, data);
    refresh();
    toast.success('Fornecedor atualizado');
  }, [refresh]);

  const remove = useCallback((id: string) => {
    LocalDb.remove('item_fornecedores', id);
    refresh();
    toast.success('Fornecedor removido');
  }, [refresh]);

  return { fornecedores, create, update, remove, refresh };
}

// Item Aliases CRUD
export function useItemAliases(itemId: string | undefined) {
  const [aliases, setAliases] = useState<LocalItemAlias[]>([]);

  const refresh = useCallback(() => {
    if (!itemId) return;
    const data = LocalDb.query<LocalItemAlias>('item_alias', a => a.item_id === itemId);
    setAliases(data);
  }, [itemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((data: Omit<LocalItemAlias, 'id'>) => {
    const record = LocalDb.insert<LocalItemAlias>('item_alias', data);
    refresh();
    toast.success('Alias adicionado');
    return record;
  }, [refresh]);

  const update = useCallback((id: string, data: Partial<LocalItemAlias>) => {
    LocalDb.update<LocalItemAlias>('item_alias', id, data);
    refresh();
    toast.success('Alias atualizado');
  }, [refresh]);

  const remove = useCallback((id: string) => {
    LocalDb.remove('item_alias', id);
    refresh();
    toast.success('Alias removido');
  }, [refresh]);

  return { aliases, create, update, remove, refresh };
}

// Estoque Lotes CRUD
export function useEstoqueLotes(itemId: string | undefined) {
  const [lotes, setLotes] = useState<(LocalEstoqueLote & { fornecedor?: Record<string, unknown> })[]>([]);

  const refresh = useCallback(() => {
    if (!itemId) return;
    const data = LocalDb.query<LocalEstoqueLote>('estoque_lotes', l => l.item_id === itemId);
    
    // Enrich with fornecedor data
    const entidades = LocalDb.getCollection<Record<string, unknown>>('entidades');
    const enriched = data.map(l => ({
      ...l,
      fornecedor: entidades.find(e => e.id === l.fornecedor_id),
    }));
    
    setLotes(enriched);
  }, [itemId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((data: Omit<LocalEstoqueLote, 'id' | 'quantidade_interna' | 'custo_unitario_interno'> & {
    fator_para_unidade_interna: number;
  }) => {
    // Calculate internal values
    const quantidade_interna = data.quantidade_original * data.fator_para_unidade_interna;
    const custo_unitario_interno = data.custo_unitario_original / data.fator_para_unidade_interna;

    // Check item type for initial status
    const item = LocalDb.getById<LocalItem>('itens', data.item_id);
    let status = data.status;
    if (item && (item.tipo_item === 'MP' || item.criticidade === 'CRITICO' || item.criticidade === 'ULTRA')) {
      status = 'QUARENTENA';
    }

    const lote = LocalDb.insert<LocalEstoqueLote>('estoque_lotes', {
      ...data,
      quantidade_interna,
      custo_unitario_interno,
      status,
    });
    refresh();
    toast.success('Lote criado com sucesso');
    return lote;
  }, [refresh]);

  const update = useCallback((id: string, data: Partial<LocalEstoqueLote>) => {
    LocalDb.update<LocalEstoqueLote>('estoque_lotes', id, data);
    refresh();
    toast.success('Lote atualizado');
  }, [refresh]);

  const remove = useCallback((id: string) => {
    // Delete related documents
    const docs = LocalDb.query<LocalLoteDocumento>('lote_documentos', d => d.lote_id === id);
    docs.forEach(d => LocalDb.remove('lote_documentos', d.id));
    
    LocalDb.remove('estoque_lotes', id);
    refresh();
    toast.success('Lote removido');
  }, [refresh]);

  return { lotes, create, update, remove, refresh };
}

// Lote Documentos CRUD
export function useLoteDocumentos(loteId: string | undefined) {
  const [documentos, setDocumentos] = useState<LocalLoteDocumento[]>([]);

  const refresh = useCallback(() => {
    if (!loteId) return;
    const data = LocalDb.query<LocalLoteDocumento>('lote_documentos', d => d.lote_id === loteId);
    setDocumentos(data);
  }, [loteId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback((data: Omit<LocalLoteDocumento, 'id'>) => {
    const doc = LocalDb.insert<LocalLoteDocumento>('lote_documentos', {
      ...data,
      status_validacao: 'PENDENTE',
    });
    refresh();
    toast.success('Documento anexado');
    return doc;
  }, [refresh]);

  const validate = useCallback((id: string) => {
    LocalDb.update<LocalLoteDocumento>('lote_documentos', id, { status_validacao: 'VALIDADO' });
    refresh();
    toast.success('Documento validado');
  }, [refresh]);

  const reject = useCallback((id: string, observacoes?: string) => {
    LocalDb.update<LocalLoteDocumento>('lote_documentos', id, { status_validacao: 'REJEITADO', observacoes });
    refresh();
    toast.success('Documento rejeitado');
  }, [refresh]);

  const remove = useCallback((id: string) => {
    LocalDb.remove('lote_documentos', id);
    refresh();
    toast.success('Documento removido');
  }, [refresh]);

  return { documentos, create, validate, reject, remove, refresh };
}

// Check if lote can be released
export function canReleaseLote(loteId: string, itemId: string): boolean {
  const item = LocalDb.getById<LocalItem>('itens', itemId);
  if (!item) return false;

  // If not MP or critical, can release
  if (item.tipo_item !== 'MP' && item.criticidade !== 'CRITICO' && item.criticidade !== 'ULTRA') {
    return true;
  }

  // Check for validated COA
  const docs = LocalDb.query<LocalLoteDocumento>('lote_documentos', 
    d => d.lote_id === loteId && d.tipo_documento === 'COA' && d.status_validacao === 'VALIDADO');
  
  return docs.length > 0;
}
