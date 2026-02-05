// LEGACY ERP - Type Definitions

export type TipoPessoa = 'PJ' | 'PF';
export type StatusEntidade = 'ATIVO' | 'BLOQUEADO' | 'HOMOLOGACAO';
export type ClassificacaoEntidade = 'VIP' | 'REGULAR' | 'PROBLEMA';
export type PapelEntidade = 'FORNECEDOR' | 'CLIENTE' | 'TRANSPORTADORA' | 'AFILIADO' | 'VENDEDOR' | 'OUTRO';
export type CargoContato = 'COMPRADOR' | 'VENDEDOR' | 'FINANCEIRO' | 'LOGISTICA' | 'QUALIDADE' | 'FISCAL' | 'OUTRO';
export type OrigemContato = 'MANUAL' | 'XML' | 'LEAD_ADS' | 'IMPORT';
export type TipoEndereco = 'FISCAL' | 'ENTREGA' | 'COBRANCA';
export type TipoItem = 'MP' | 'EMBALAGEM' | 'ROTULO' | 'TAMPA' | 'POTE' | 'SILICA' | 'CAPSULA_VAZIA' | 'PA' | 'OUTRO';
export type CriticidadeItem = 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'ULTRA';
export type ArmazenamentoItem = 'AMBIENTE' | 'REFRIGERADO' | 'PROTEGIDO_LUZ' | 'OUTRO';
export type TipoAlias = 'ALIAS_FORNECEDOR' | 'ALIAS_INTERNO' | 'ALIAS_MARKETPLACE';
export type StatusNotaEntrada = 'IMPORTADA' | 'CONFIRMADA' | 'CANCELADA';
export type StatusLote = 'QUARENTENA' | 'DISPONIVEL' | 'BLOQUEADO' | 'VENCIDO';
export type TipoDocumentoLote = 'COA' | 'FISPQ' | 'CERTIFICADO' | 'OUTRO';
export type StatusValidacao = 'PENDENTE' | 'VALIDADO' | 'REJEITADO';
export type AmbienteNFe = 'HOMOLOGACAO' | 'PRODUCAO';
export type CondicaoFrete = 'CIF' | 'FOB' | 'NA';

export interface Arquivo {
  id: string;
  nome_original: string;
  mime_type: string;
  tamanho: number;
  storage_key: string;
  checksum_sha256?: string;
  sensivel: boolean;
  created_at: string;
}

export interface Company {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  regime_tributario?: string;
  endereco_logradouro?: string;
  endereco_nro?: string;
  endereco_compl?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  endereco_cep?: string;
  endereco_pais?: string;
  endereco_cmun?: string;
  endereco_cpais?: string;
  email_financeiro?: string;
  email_fiscal?: string;
  telefone?: string;
  site?: string;
  logo_file_id?: string;
  certificado_a1_file_id?: string;
  certificado_senha_encrypted?: string;
  nfe_ambiente?: AmbienteNFe;
  nfe_serie_padrao?: number;
  nfe_numero_inicial?: number;
  csc_idtoken?: string;
  csc_token?: string;
  regime_apuracao?: string;
  created_at: string;
  updated_at: string;
}

export interface Entidade {
  id: string;
  tipo_pessoa: TipoPessoa;
  documento: string;
  razao_social: string;
  nome_fantasia?: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  status: StatusEntidade;
  classificacao?: ClassificacaoEntidade;
  score_risco?: number;
  limite_credito?: number;
  prazo_pagamento_padrao_dias?: number;
  condicao_frete_padrao?: CondicaoFrete;
  tags?: string[];
  observacoes?: string;
  created_at: string;
  updated_at: string;
  // Relations
  papeis?: EntidadePapel[];
  contatos?: EntidadeContato[];
  enderecos?: EntidadeEndereco[];
}

export interface EntidadePapel {
  id: string;
  entidade_id: string;
  papel: PapelEntidade;
  dados_especificos?: Record<string, unknown>;
  created_at: string;
}

export interface EntidadeContato {
  id: string;
  entidade_id: string;
  nome: string;
  cargo: CargoContato;
  whatsapp?: string;
  telefone?: string;
  email?: string;
  preferencial: boolean;
  aceita_whatsapp: boolean;
  origem: OrigemContato;
  observacoes?: string;
  created_at: string;
}

export interface EntidadeEndereco {
  id: string;
  entidade_id: string;
  tipo: TipoEndereco;
  logradouro?: string;
  nro?: string;
  compl?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  pais?: string;
  cmun?: string;
  cpais?: string;
  created_at: string;
}

export interface Item {
  id: string;
  sku_interno?: string;
  descricao_interna: string;
  descricao_comercial?: string;
  tipo_item: TipoItem;
  categoria_operacional?: string;
  ncm?: string;
  ean?: string;
  unidade_interna: string;
  controla_lote: boolean;
  controla_validade: boolean;
  criticidade: CriticidadeItem;
  higroscopico: boolean;
  armazenamento: ArmazenamentoItem;
  densidade_aparente?: number;
  unidade_declaracao?: string;
  unidade_pesagem?: string;
  fator_conversao?: number;
  potencia_compra?: number;
  potencia_rotulo?: number;
  exige_premix: boolean;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  // Relations
  fornecedores?: ItemFornecedor[];
  aliases?: ItemAlias[];
}

export interface ItemFornecedor {
  id: string;
  item_id: string;
  fornecedor_id: string;
  codigo_fornecedor?: string;
  descricao_fornecedor?: string;
  unidade_compra_padrao: string;
  fator_para_unidade_interna: number;
  lead_time_dias: number;
  moq: number;
  fornecedor_preferencial: boolean;
  preco_referencia?: number;
  created_at: string;
  // Joined
  fornecedor?: Entidade;
}

export interface ItemAlias {
  id: string;
  item_id: string;
  fornecedor_id?: string;
  tipo: TipoAlias;
  texto: string;
  created_at: string;
}

export interface NotaEntrada {
  id: string;
  chave_nfe: string;
  fornecedor_id?: string;
  company_id?: string;
  xml_raw?: string;
  numero?: string;
  serie?: string;
  modelo?: string;
  dh_emissao?: string;
  total_produtos?: number;
  total_nota?: number;
  status: StatusNotaEntrada;
  created_at: string;
  // Relations
  fornecedor?: Entidade;
  itens?: NotaEntradaItem[];
}

export interface NotaEntradaItem {
  id: string;
  nota_entrada_id: string;
  item_id?: string;
  codigo_fornecedor?: string;
  descricao?: string;
  ncm?: string;
  cfop?: string;
  ean?: string;
  ucom?: string;
  qcom?: number;
  vuncom?: number;
  vprod?: number;
  created_at: string;
  // Relations
  item?: Item;
  // Preview data
  matched_item?: Item;
  lote_manual?: {
    numero: string;
    data_fab?: string;
    data_val?: string;
  };
  rastro?: {
    nLote?: string;
    dFab?: string;
    dVal?: string;
    qLote?: number;
  };
}

export interface EstoqueLote {
  id: string;
  item_id: string;
  fornecedor_id?: string;
  nota_entrada_item_id?: string;
  numero_lote: string;
  data_fab?: string;
  data_val?: string;
  quantidade_original: number;
  unidade_original: string;
  quantidade_interna: number;
  custo_unitario_original?: number;
  custo_unitario_interno?: number;
  status: StatusLote;
  observacoes_qc?: string;
  created_at: string;
  // Relations
  item?: Item;
  fornecedor?: Entidade;
  documentos?: LoteDocumento[];
}

export interface LoteDocumento {
  id: string;
  lote_id: string;
  tipo_documento: TipoDocumentoLote;
  arquivo_id?: string;
  hash_arquivo?: string;
  versao: number;
  data_emissao?: string;
  status_validacao: StatusValidacao;
  observacoes?: string;
  created_at: string;
  // Relations
  arquivo?: Arquivo;
}

export interface AuditLog {
  id: string;
  entidade: string;
  entidade_id?: string;
  acao: string;
  payload?: Record<string, unknown>;
  created_at: string;
}

// NF-e XML Parsed types
export interface NFeXMLParsed {
  chave: string;
  numero: string;
  serie: string;
  modelo: string;
  dhEmissao: string;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia?: string;
    ie?: string;
    endereco?: {
      logradouro?: string;
      nro?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      cep?: string;
      cMun?: string;
    };
    email?: string;
    telefone?: string;
  };
  destinatario: {
    cnpj?: string;
    cpf?: string;
    razaoSocial: string;
    ie?: string;
    endereco?: {
      logradouro?: string;
      nro?: string;
      bairro?: string;
      cidade?: string;
      uf?: string;
      cep?: string;
      cMun?: string;
    };
    email?: string;
  };
  transportadora?: {
    cnpj?: string;
    razaoSocial?: string;
    ie?: string;
  };
  itens: NFeItemParsed[];
  total: {
    totalProdutos: number;
    totalNota: number;
  };
}

export interface NFeItemParsed {
  nItem: number;
  cProd: string;
  cEAN?: string;
  xProd: string;
  NCM?: string;
  CFOP?: string;
  uCom: string;
  qCom: number;
  vUnCom: number;
  vProd: number;
  rastro?: {
    nLote: string;
    dFab?: string;
    dVal?: string;
    qLote?: number;
  };
}
