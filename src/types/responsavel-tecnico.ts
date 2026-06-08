// ============================================================
// TIPOS: Responsáveis Técnicos (RT) - ANVISA
// ============================================================

export type TipoConselho = 'CRN' | 'CRQ' | 'CRF';

export const CONSELHOS: Record<TipoConselho, { nome: string; descricao: string }> = {
  CRN: { nome: 'CRN', descricao: 'Conselho Regional de Nutricionistas' },
  CRQ: { nome: 'CRQ', descricao: 'Conselho Regional de Química' },
  CRF: { nome: 'CRF', descricao: 'Conselho Regional de Farmácia' },
};

export const UFS_BRASIL = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
] as const;

export interface ResponsavelTecnico {
  id: string;
  nome_completo: string;
  cpf: string;
  email: string;
  telefone?: string;
  status: 'ATIVO' | 'INATIVO';
  tipo_conselho: TipoConselho;
  numero_registro: string;
  uf_conselho: string;
  validade_registro: string; // DATE
  documento_comprobatorio_id?: string;
  regime_trabalho: 'CLT' | 'PJ';
  contrato_prestacao_servico_id?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface AssinaturaRT {
  id: string;
  op_id: string;
  responsavel_tecnico_id: string;
  rt_nome: string;
  rt_cpf: string;
  rt_tipo_conselho: TipoConselho;
  rt_numero_registro: string;
  rt_uf_conselho: string;
  ip_address?: string;
  user_agent?: string;
  hash_op: string;
  assinatura_timestamp: string;
  declaracao_aceita: boolean;
  created_at: string;
}

export interface LoteProdutoAcabado {
  id: string;
  op_id: string;
  numero_lote: string;
  codigo_auditoria: string;
  qr_code_hash: string;
  produto_id?: string;
  produto_nome: string;
  produto_codigo?: string;
  data_fabricacao: string;
  data_validade: string;
  quantidade_produzida: number;
  quantidade_aprovada?: number;
  quantidade_rejeitada?: number;
  status: 'QUARENTENA' | 'APROVADO' | 'BLOQUEADO' | 'LIBERADO';
  motivo_bloqueio?: string;
  responsavel_tecnico_id?: string;
  rt_nome: string;
  rt_tipo_conselho: TipoConselho;
  rt_numero_registro: string;
  rt_uf_conselho: string;
  assinatura_liberacao_id?: string;
  liberado_em?: string;
  liberado_por?: string;
  created_at: string;
  updated_at: string;
}

export interface LoteMateriaPrima {
  id: string;
  lote_produto_acabado_id: string;
  insumo_id?: string;
  insumo_nome: string;
  insumo_lote: string;
  fornecedor_id?: string;
  fornecedor_nome: string;
  quantidade_utilizada_g: number;
  created_at: string;
}

export interface AuditTrailEvento {
  id: string;
  tipo_evento: string;
  descricao: string;
  entidade_tipo: string;
  entidade_id: string;
  entidade_codigo?: string;
  usuario_id?: string;
  usuario_nome?: string;
  ip_address?: string;
  user_agent?: string;
  dados_evento: Record<string, unknown>;
  dados_anteriores?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
  hash_anterior?: string;
  hash_atual: string;
  sequencia: number;
  created_at: string;
}

// Validação de compatibilidade RT x Tipo de Produto
export function validarCompatibilidadeRT(
  tipoConselho: TipoConselho,
  tipoProduto: 'CAPSULA' | 'LIQUIDO' | 'PO' | 'CRITICO'
): boolean {
  switch (tipoProduto) {
    case 'CAPSULA':
      return tipoConselho === 'CRF' || tipoConselho === 'CRQ';
    case 'CRITICO':
      return tipoConselho === 'CRQ' || tipoConselho === 'CRF';
    default:
      return true; // CRN, CRQ, CRF são válidos para líquido e pó
  }
}

// Verificar se RT está válido
export function rtEstaValido(rt: ResponsavelTecnico): boolean {
  if (rt.status !== 'ATIVO') return false;
  const validade = new Date(rt.validade_registro);
  return validade >= new Date();
}

// Gerar hash SHA-256 (cliente)
export async function gerarHashSHA256(dados: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(dados);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
