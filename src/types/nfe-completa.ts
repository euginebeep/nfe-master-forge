// ============================================
// TIPOS COMPLETOS PARA IMPORTAÇÃO DE NF-e XML
// ============================================

// Status e classificações
export type TipoOperacaoNFe = 'ENTRADA' | 'SAIDA';
export type FinalidadeNFe = 'NORMAL' | 'COMPLEMENTAR' | 'AJUSTE' | 'DEVOLUCAO';
export type AmbienteNFe = 'PRODUCAO' | 'HOMOLOGACAO';
export type StatusSEFAZ = 'AUTORIZADA' | 'CANCELADA' | 'DENEGADA' | 'INUTILIZADA' | 'PENDENTE';
export type ClassificacaoNota = 
  | 'MATERIA_PRIMA' 
  | 'EMBALAGEM' 
  | 'INSUMO_CONSUMO' 
  | 'REMESSA_INDUSTRIALIZACAO' 
  | 'RETORNO_INDUSTRIALIZACAO' 
  | 'PRODUTO_TERCEIRO'
  | 'ATIVO_IMOBILIZADO'
  | 'MATERIAL_USO_CONSUMO'
  | 'OUTRO';
export type ModalidadeFrete = 
  | 'CIF' 
  | 'FOB' 
  | 'TERCEIROS' 
  | 'PROPRIO_REMETENTE' 
  | 'PROPRIO_DESTINATARIO' 
  | 'SEM_FRETE';
export type StatusContaPagar = 'ABERTO' | 'PAGO' | 'PARCIAL' | 'VENCIDO' | 'CANCELADO';

// ============================================
// NOTA FISCAL PRINCIPAL
// ============================================
export interface NotaFiscalCompleta {
  id: string;
  // Identificação
  chave_acesso: string;
  numero: string;
  serie: string;
  modelo: string; // 55 = NF-e, 65 = NFC-e
  natureza_operacao: string;
  dh_emissao: string;
  dh_saida_entrada?: string;
  tipo_operacao: TipoOperacaoNFe;
  finalidade: FinalidadeNFe;
  ambiente: AmbienteNFe;
  
  // SEFAZ
  status_sefaz: StatusSEFAZ;
  protocolo_autorizacao?: string;
  dh_recebimento?: string;
  digest_value?: string;
  
  // Versão e schema
  versao_schema: string;
  
  // Classificação operacional
  classificacao: ClassificacaoNota;
  
  // Entidades vinculadas
  emitente_id: string;
  destinatario_id?: string;
  transportadora_id?: string;
  
  // Totais (redundante para performance)
  total_produtos: number;
  total_icms: number;
  total_icms_st: number;
  total_ipi: number;
  total_pis: number;
  total_cofins: number;
  total_frete: number;
  total_seguro: number;
  total_desconto: number;
  total_outros: number;
  total_nota: number;
  
  // XML original (imutável)
  xml_hash_sha256: string;
  xml_raw: string;
  
  // Auditoria
  importado_por?: string;
  created_at: string;
  updated_at: string;
}

// ============================================
// OBSERVAÇÕES DA NOTA
// ============================================
export interface NotaFiscalObservacao {
  id: string;
  nota_id: string;
  tipo: 'FISCO' | 'CONTRIBUINTE' | 'PROCESSO' | 'OUTRO';
  campo?: string; // xCampo
  texto: string; // xTexto
  created_at: string;
}

// ============================================
// ITENS DA NOTA
// ============================================
export interface NotaFiscalItem {
  id: string;
  nota_id: string;
  n_item: number;
  
  // Produto
  codigo_produto: string; // cProd do fornecedor
  ean: string;
  descricao: string;
  ncm: string;
  cest?: string;
  cfop: string;
  
  // Quantidades e valores
  unidade_comercial: string;
  quantidade_comercial: number;
  valor_unitario_comercial: number;
  valor_total: number;
  
  // Tributária
  unidade_tributaria?: string;
  quantidade_tributaria?: number;
  valor_unitario_tributario?: number;
  ean_tributario?: string;
  
  // Outros
  valor_frete?: number;
  valor_seguro?: number;
  valor_desconto?: number;
  valor_outros?: number;
  
  // Informações adicionais
  info_adicional?: string;
  numero_pedido_compra?: string;
  item_pedido_compra?: string;
  
  // Vínculo com produto interno
  item_id?: string;
  lote_id?: string;
  
  created_at: string;
}

// ============================================
// IMPOSTOS POR ITEM
// ============================================
export interface NotaFiscalItemImposto {
  id: string;
  nota_item_id: string;
  
  // ICMS
  icms_origem?: string;
  icms_cst?: string;
  icms_base_calculo?: number;
  icms_aliquota?: number;
  icms_valor?: number;
  icms_mod_bc?: string;
  
  // ICMS ST
  icms_st_base_calculo?: number;
  icms_st_aliquota?: number;
  icms_st_valor?: number;
  icms_st_mva?: number;
  
  // ICMS Diferido/Desonerado
  icms_diferido_valor?: number;
  icms_desonerado_valor?: number;
  icms_desonerado_motivo?: string;
  
  // IPI
  ipi_cst?: string;
  ipi_base_calculo?: number;
  ipi_aliquota?: number;
  ipi_valor?: number;
  ipi_cnpj_produtor?: string;
  
  // PIS
  pis_cst?: string;
  pis_base_calculo?: number;
  pis_aliquota?: number;
  pis_valor?: number;
  
  // COFINS
  cofins_cst?: string;
  cofins_base_calculo?: number;
  cofins_aliquota?: number;
  cofins_valor?: number;
  
  // II (Importação)
  ii_base_calculo?: number;
  ii_despesas_aduaneiras?: number;
  ii_valor?: number;
  ii_iof?: number;
  
  created_at: string;
}

// ============================================
// RASTREABILIDADE (LOTES NO XML)
// ============================================
export interface NotaFiscalItemRastro {
  id: string;
  nota_item_id: string;
  numero_lote: string;
  quantidade: number;
  data_fabricacao?: string;
  data_validade?: string;
  codigo_agregacao?: string;
  created_at: string;
}

// ============================================
// TOTAIS IMPOSTOS DA NOTA
// ============================================
export interface NotaFiscalTotaisImpostos {
  id: string;
  nota_id: string;
  
  // ICMS
  icms_base_calculo: number;
  icms_valor: number;
  icms_desonerado: number;
  fcp_uf_destino: number;
  icms_uf_destino: number;
  icms_uf_remet: number;
  
  // ICMS ST
  icms_st_base_calculo: number;
  icms_st_valor: number;
  fcp_st: number;
  fcp_st_retido: number;
  
  // Produtos
  valor_produtos: number;
  
  // Outros
  valor_frete: number;
  valor_seguro: number;
  valor_desconto: number;
  valor_ii: number;
  valor_ipi: number;
  valor_ipi_devolvido: number;
  valor_pis: number;
  valor_cofins: number;
  valor_outros: number;
  
  // Total
  valor_nota: number;
  valor_total_tributos?: number;
  
  created_at: string;
}

// ============================================
// TRANSPORTE
// ============================================
export interface NotaFiscalTransporte {
  id: string;
  nota_id: string;
  modalidade_frete: ModalidadeFrete;
  
  // Transportadora (dados do XML)
  transportadora_cnpj?: string;
  transportadora_cpf?: string;
  transportadora_razao_social?: string;
  transportadora_ie?: string;
  transportadora_endereco?: string;
  transportadora_uf?: string;
  transportadora_municipio?: string;
  
  // Veículo
  veiculo_placa?: string;
  veiculo_uf?: string;
  veiculo_rntc?: string;
  
  // Reboque
  reboque_placa?: string;
  reboque_uf?: string;
  reboque_rntc?: string;
  
  created_at: string;
}

// ============================================
// VOLUMES
// ============================================
export interface NotaFiscalVolume {
  id: string;
  nota_id: string;
  quantidade: number;
  especie?: string;
  marca?: string;
  numeracao?: string;
  peso_liquido?: number;
  peso_bruto?: number;
  created_at: string;
}

// ============================================
// COBRANÇA - FATURA
// ============================================
export interface NotaFiscalFatura {
  id: string;
  nota_id: string;
  numero_fatura?: string;
  valor_original?: number;
  valor_desconto?: number;
  valor_liquido?: number;
  created_at: string;
}

// ============================================
// COBRANÇA - DUPLICATAS
// ============================================
export interface NotaFiscalDuplicata {
  id: string;
  nota_id: string;
  fatura_id?: string;
  numero: string;
  data_vencimento: string;
  valor: number;
  created_at: string;
}

// ============================================
// PAGAMENTO
// ============================================
export interface NotaFiscalPagamento {
  id: string;
  nota_id: string;
  forma_pagamento: string; // tPag
  valor: number;
  // Cartão
  tipo_integracao?: string;
  cnpj_credenciadora?: string;
  bandeira?: string;
  cod_autorizacao?: string;
  created_at: string;
}

// ============================================
// CONTAS A PAGAR (GERADAS AUTOMATICAMENTE)
// ============================================
export interface ContaPagar {
  id: string;
  nota_id: string;
  duplicata_id?: string;
  fornecedor_id: string;
  
  descricao: string;
  numero_parcela: number;
  total_parcelas: number;
  
  valor: number;
  data_vencimento: string;
  data_pagamento?: string;
  valor_pago?: number;
  
  forma_pagamento?: string;
  conta_bancaria?: string;
  categoria?: string;
  centro_custo?: string;
  
  status: StatusContaPagar;
  observacoes?: string;
  
  created_at: string;
  updated_at: string;
}

// ============================================
// AUDIT LOG DE IMPORTAÇÃO
// ============================================
export interface ImportacaoLog {
  id: string;
  nota_id: string;
  acao: 'IMPORTACAO' | 'REPROCESSAMENTO' | 'CANCELAMENTO' | 'VINCULACAO_ITEM' | 'CRIACAO_LOTE';
  usuario?: string;
  detalhes?: Record<string, unknown>;
  created_at: string;
}

// ============================================
// RESULTADO DO PARSING COMPLETO
// ============================================
export interface NFeParseResult {
  // Dados gerais
  notaFiscal: Omit<NotaFiscalCompleta, 'id' | 'emitente_id' | 'destinatario_id' | 'transportadora_id' | 'created_at' | 'updated_at'>;
  
  // Observações
  observacoes: Omit<NotaFiscalObservacao, 'id' | 'nota_id' | 'created_at'>[];
  
  // Itens e impostos
  itens: Array<{
    item: Omit<NotaFiscalItem, 'id' | 'nota_id' | 'item_id' | 'lote_id' | 'created_at'>;
    impostos: Omit<NotaFiscalItemImposto, 'id' | 'nota_item_id' | 'created_at'>;
    rastros: Omit<NotaFiscalItemRastro, 'id' | 'nota_item_id' | 'created_at'>[];
  }>;
  
  // Totais
  totaisImpostos: Omit<NotaFiscalTotaisImpostos, 'id' | 'nota_id' | 'created_at'>;
  
  // Transporte
  transporte?: Omit<NotaFiscalTransporte, 'id' | 'nota_id' | 'created_at'>;
  volumes: Omit<NotaFiscalVolume, 'id' | 'nota_id' | 'created_at'>[];
  
  // Cobrança
  fatura?: Omit<NotaFiscalFatura, 'id' | 'nota_id' | 'created_at'>;
  duplicatas: Omit<NotaFiscalDuplicata, 'id' | 'nota_id' | 'fatura_id' | 'created_at'>[];
  pagamentos: Omit<NotaFiscalPagamento, 'id' | 'nota_id' | 'created_at'>[];
  
  // Entidades extraídas
  emitente: EntidadeXML;
  destinatario?: EntidadeXML;
  transportadora?: EntidadeXML;
}

// ============================================
// ENTIDADE EXTRAÍDA DO XML
// ============================================
export interface EntidadeXML {
  tipo_pessoa: 'PF' | 'PJ';
  documento: string; // CNPJ ou CPF
  razao_social: string;
  nome_fantasia?: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  suframa?: string;
  email?: string;
  telefone?: string;
  endereco?: {
    logradouro?: string;
    numero?: string;
    complemento?: string;
    bairro?: string;
    codigo_municipio?: string;
    municipio?: string;
    uf?: string;
    cep?: string;
    codigo_pais?: string;
    pais?: string;
  };
}
