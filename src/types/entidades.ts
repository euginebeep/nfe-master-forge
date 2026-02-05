// Extended Entidades Types

export type TipoPessoa = 'PJ' | 'PF' | 'ESTRANGEIRO';
export type ContribuinteICMS = 'SIM' | 'NAO' | 'ISENTO' | 'NAO_INFORMADO';
export type Departamento = 'COMPRAS' | 'FINANCEIRO' | 'FISCAL' | 'COMERCIAL' | 'RECEBIMENTO' | 'LOGISTICA' | 'DIRETORIA' | 'OUTRO';
export type PreferenciaContato = 'WHATSAPP' | 'EMAIL' | 'LIGACAO' | 'INDIFERENTE';
export type TipoEnderecoExtended = 'FISCAL' | 'ENTREGA' | 'COBRANCA' | 'RETIRADA' | 'COMERCIAL';
export type FormaPagamento = 'PIX' | 'BOLETO' | 'CARTAO' | 'TRANSFERENCIA' | 'DINHEIRO' | 'OUTRO';
export type OrigemLead = 'META' | 'GOOGLE' | 'WHATSAPP' | 'MERCADO_LIVRE' | 'SHOPEE' | 'AMAZON' | 'INDICACAO' | 'ORGANICO' | 'OUTRO';
export type EtapaFunil = 'LEAD' | 'CONTATADO' | 'APRESENTACAO' | 'PROPOSTA' | 'FECHADO' | 'PERDIDO';
export type CanalPreferido = 'WHATSAPP' | 'TELEFONE' | 'EMAIL' | 'VISITA' | 'OUTRO';
export type FretePadrao = 'CIF' | 'FOB' | 'INDEFINIDO';
export type TipoDocumentoEntidade = 'CONTRATO' | 'CERTIDAO' | 'LICENCA' | 'QUALIFICACAO' | 'COMPROVANTE' | 'OUTRO';
export type PapelEntidadeExtended = 'CLIENTE' | 'FORNECEDOR' | 'TRANSPORTADORA' | 'TERCEIRIZADO' | 'VENDEDOR' | 'AFILIADO' | 'REPRESENTANTE' | 'OUTRO';

// Helper para verificar se é estrangeiro
export function isEstrangeiro(tipoPessoa: string): boolean {
  return tipoPessoa === 'ESTRANGEIRO';
}

// Labels para tipos de pessoa
export const TIPO_PESSOA_LABELS: Record<TipoPessoa, string> = {
  PJ: 'Pessoa Jurídica',
  PF: 'Pessoa Física',
  ESTRANGEIRO: 'Estrangeiro',
};

export interface EntidadeFiscalConfig {
  entidade_id: string;
  natureza_operacao_padrao?: string;
  cfop_padrao_entrada?: string;
  cfop_padrao_saida?: string;
  cst_icms_padrao?: string;
  cst_pis_padrao?: string;
  cst_cofins_padrao?: string;
  observacao_fiscal_padrao?: string;
  bloquear_sem_cpf_cnpj_valido: boolean;
  bloquear_sem_ie_quando_exigido: boolean;
  updated_at: string;
}

export interface EntidadeFinanceiroConfig {
  entidade_id: string;
  condicao_pagamento_padrao?: string;
  forma_pagamento_padrao: FormaPagamento;
  limite_credito: number;
  bloquear_inadimplencia: boolean;
  dias_tolerancia: number;
  categoria_financeira_padrao?: string;
  centro_custo_padrao?: string;
  email_nfe?: string;
  email_boleto?: string;
  importar_duplicatas_xml_gera_contas_pagar: boolean;
  updated_at: string;
}

export interface EntidadeComercialCRM {
  entidade_id: string;
  origem_lead: OrigemLead;
  responsavel_usuario_id?: string;
  etapa_funil: EtapaFunil;
  score: number;
  tabela_preco_padrao?: string;
  canal_preferido: CanalPreferido;
  desconto_maximo_percent: number;
  comissao_padrao_percent: number;
  observacoes_comerciais?: string;
  updated_at: string;
}

export interface EntidadeLogisticaConfig {
  entidade_id: string;
  frete_padrao: FretePadrao;
  janela_recebimento?: string;
  observacoes_entrega?: string;
  transportadora_preferencial_entidade_id?: string;
  prazo_medio_entrega_dias?: number;
  pedido_minimo?: number;
  lead_time_dias?: number;
  updated_at: string;
}

export interface EntidadeDocumento {
  id: string;
  entidade_id: string;
  tipo: TipoDocumentoEntidade;
  nome_arquivo: string;
  mime_type?: string;
  tamanho_bytes?: number;
  storage_key: string;
  hash_arquivo?: string;
  observacoes?: string;
  created_at: string;
}

export interface EntidadeContatoExtended {
  id: string;
  entidade_id: string;
  nome: string;
  departamento: Departamento;
  cargo?: string;
  telefone?: string;
  whatsapp?: string;
  email?: string;
  preferencia_contato: PreferenciaContato;
  preferencial: boolean;
  aceita_whatsapp: boolean;
  origem?: string;
  observacoes?: string;
  created_at: string;
}

export interface EntidadeEnderecoExtended {
  id: string;
  entidade_id: string;
  tipo: TipoEnderecoExtended;
  cep?: string;
  logradouro?: string;
  nro?: string;
  compl?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  pais: string;
  cmun?: string;
  cpais?: string;
  referencia?: string;
  contato_local_nome?: string;
  contato_local_fone?: string;
  principal: boolean;
  created_at: string;
}

export interface EntidadeCompleta {
  id: string;
  codigo_interno?: string;
  tipo_pessoa: TipoPessoa;
  documento: string;
  pais?: string; // Required for ESTRANGEIRO
  razao_social: string;
  nome_fantasia?: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  contribuinte_icms: ContribuinteICMS;
  status: 'ATIVO' | 'INATIVO' | 'BLOQUEADO';
  classificacao?: 'VIP' | 'REGULAR' | 'RISCO' | 'RESTRITO';
  tags?: string[];
  observacoes?: string;
  site?: string;
  created_at: string;
  updated_at: string;
  // Relations
  entidade_papeis?: { id: string; papel: PapelEntidadeExtended }[];
  entidade_contatos?: EntidadeContatoExtended[];
  entidade_enderecos?: EntidadeEnderecoExtended[];
  entidade_fiscal_config?: EntidadeFiscalConfig;
  entidade_financeiro_config?: EntidadeFinanceiroConfig;
  entidade_comercial_crm?: EntidadeComercialCRM;
  entidade_logistica_config?: EntidadeLogisticaConfig;
  entidade_documentos?: EntidadeDocumento[];
}

// Labels for UI
export const PAPEL_LABELS: Record<PapelEntidadeExtended, string> = {
  CLIENTE: 'Cliente',
  FORNECEDOR: 'Fornecedor',
  TRANSPORTADORA: 'Transportadora',
  TERCEIRIZADO: 'Terceirizado',
  VENDEDOR: 'Vendedor',
  AFILIADO: 'Afiliado',
  REPRESENTANTE: 'Representante',
  OUTRO: 'Outro',
};

export const DEPARTAMENTO_LABELS: Record<Departamento, string> = {
  COMPRAS: 'Compras',
  FINANCEIRO: 'Financeiro',
  FISCAL: 'Fiscal',
  COMERCIAL: 'Comercial',
  RECEBIMENTO: 'Recebimento',
  LOGISTICA: 'Logística',
  DIRETORIA: 'Diretoria',
  OUTRO: 'Outro',
};

export const TIPO_ENDERECO_LABELS: Record<TipoEnderecoExtended, string> = {
  FISCAL: 'Fiscal',
  ENTREGA: 'Entrega',
  COBRANCA: 'Cobrança',
  RETIRADA: 'Retirada',
  COMERCIAL: 'Comercial',
};

export const FORMA_PAGAMENTO_LABELS: Record<FormaPagamento, string> = {
  PIX: 'PIX',
  BOLETO: 'Boleto',
  CARTAO: 'Cartão',
  TRANSFERENCIA: 'Transferência',
  DINHEIRO: 'Dinheiro',
  OUTRO: 'Outro',
};

export const ORIGEM_LEAD_LABELS: Record<OrigemLead, string> = {
  META: 'Meta (Facebook/Instagram)',
  GOOGLE: 'Google Ads',
  WHATSAPP: 'WhatsApp',
  MERCADO_LIVRE: 'Mercado Livre',
  SHOPEE: 'Shopee',
  AMAZON: 'Amazon',
  INDICACAO: 'Indicação',
  ORGANICO: 'Orgânico',
  OUTRO: 'Outro',
};

export const ETAPA_FUNIL_LABELS: Record<EtapaFunil, string> = {
  LEAD: 'Lead',
  CONTATADO: 'Contatado',
  APRESENTACAO: 'Apresentação',
  PROPOSTA: 'Proposta',
  FECHADO: 'Fechado',
  PERDIDO: 'Perdido',
};

export const TIPO_DOCUMENTO_LABELS: Record<TipoDocumentoEntidade, string> = {
  CONTRATO: 'Contrato',
  CERTIDAO: 'Certidão',
  LICENCA: 'Licença',
  QUALIFICACAO: 'Qualificação',
  COMPROVANTE: 'Comprovante',
  OUTRO: 'Outro',
};
