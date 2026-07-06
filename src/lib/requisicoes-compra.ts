import {
  calcularCompraArredondada,
  deGramas,
  paraGramas,
  type EmbalagemInfo,
} from '@/lib/conferencia-materiais';
import { calcularQuantidadeCotacao } from '@/lib/cotacao-embalagem';

export const STATUS_REQ = {
  ABERTA: 'ABERTA',
  EM_RFQ: 'EM_RFQ',
  EM_MAPA: 'EM_MAPA',
  APROVADA: 'APROVADA',
  PO_EMITIDO: 'PO_EMITIDO',
  RECEBIDA_PARCIAL: 'RECEBIDA_PARCIAL',
  RECEBIDA: 'RECEBIDA',
} as const;

export type StatusRequisicao = (typeof STATUS_REQ)[keyof typeof STATUS_REQ];

const LEGACY_STATUS_MAP: Record<string, StatusRequisicao> = {
  COTACAO: STATUS_REQ.EM_MAPA,
  PEDIDO_ENVIADO: STATUS_REQ.PO_EMITIDO,
};

export function normalizarStatus(status: string): StatusRequisicao {
  const valores = Object.values(STATUS_REQ) as string[];
  if (valores.includes(status)) return status as StatusRequisicao;
  return LEGACY_STATUS_MAP[status] ?? (status as StatusRequisicao);
}

export const STATUS_REQ_ORDEM: StatusRequisicao[] = [
  STATUS_REQ.ABERTA,
  STATUS_REQ.EM_RFQ,
  STATUS_REQ.EM_MAPA,
  STATUS_REQ.APROVADA,
  STATUS_REQ.PO_EMITIDO,
  STATUS_REQ.RECEBIDA_PARCIAL,
  STATUS_REQ.RECEBIDA,
];

export type AbaRequisicaoCompra =
  | 'PEDIDOS_INTERNOS'
  | 'COTACOES'
  | 'COMPARACAO'
  | 'COMPRAS'
  | 'RECEBIMENTO';

export const ABAS_REQUISICAO: Array<{
  id: AbaRequisicaoCompra;
  label: string;
  statuses: StatusRequisicao[];
}> = [
  { id: 'PEDIDOS_INTERNOS', label: 'Pedidos internos', statuses: [STATUS_REQ.ABERTA] },
  { id: 'COTACOES', label: 'Cotações', statuses: [STATUS_REQ.EM_RFQ] },
  { id: 'COMPARACAO', label: 'Comparação', statuses: [STATUS_REQ.EM_MAPA] },
  { id: 'COMPRAS', label: 'Compras', statuses: [STATUS_REQ.APROVADA, STATUS_REQ.PO_EMITIDO] },
  {
    id: 'RECEBIMENTO',
    label: 'Recebimento',
    statuses: [STATUS_REQ.RECEBIDA_PARCIAL, STATUS_REQ.RECEBIDA],
  },
];

const TRANSICOES: Record<StatusRequisicao, StatusRequisicao[]> = {
  [STATUS_REQ.ABERTA]: [STATUS_REQ.EM_RFQ],
  [STATUS_REQ.EM_RFQ]: [STATUS_REQ.EM_MAPA],
  [STATUS_REQ.EM_MAPA]: [STATUS_REQ.APROVADA],
  [STATUS_REQ.APROVADA]: [STATUS_REQ.PO_EMITIDO],
  [STATUS_REQ.PO_EMITIDO]: [STATUS_REQ.RECEBIDA_PARCIAL, STATUS_REQ.RECEBIDA],
  [STATUS_REQ.RECEBIDA_PARCIAL]: [STATUS_REQ.RECEBIDA],
  [STATUS_REQ.RECEBIDA]: [],
};

export function podeTransicionar(de: string, para: StatusRequisicao): boolean {
  const deNorm = normalizarStatus(de);
  const permitidos = TRANSICOES[deNorm];
  return Array.isArray(permitidos) && permitidos.includes(para);
}

export function statusNaAba(status: string, statusesAba: StatusRequisicao[]): boolean {
  return statusesAba.includes(normalizarStatus(status));
}

export interface ItemRequisicaoCalculo {
  quantidade_comprar?: number | null;
  preco_cotado?: number | null;
}

export function calcularValorTotal(itens: ItemRequisicaoCalculo[]): number {
  return itens.reduce((acc, item) => {
    const qtd = Number(item.quantidade_comprar) || 0;
    const preco = Number(item.preco_cotado) || 0;
    return acc + qtd * preco;
  }, 0);
}

export function labelStatus(status: string): string {
  const s = normalizarStatus(status);
  const labels: Record<string, string> = {
    [STATUS_REQ.ABERTA]: 'Aberta',
    [STATUS_REQ.EM_RFQ]: 'Em cotação/RFQ',
    [STATUS_REQ.EM_MAPA]: 'Em comparação',
    [STATUS_REQ.APROVADA]: 'Aprovada',
    [STATUS_REQ.PO_EMITIDO]: 'Pedido emitido',
    [STATUS_REQ.RECEBIDA_PARCIAL]: 'Recebida parcial',
    [STATUS_REQ.RECEBIDA]: 'Recebida',
  };
  return labels[s] || status;
}

export interface ItemEmbalagemCadastro {
  embalagem_compra_qtd?: number | null;
  embalagem_compra_unidade?: string | null;
  unidade_interna?: string | null;
}

export interface SugestaoCompra {
  quantidade: number;
  unidade: string;
  numEmbalagens: number | null;
  semEmbalagem: boolean;
}

export function faltanteEmGramas(
  quantidade: number | null | undefined,
  unidade: string | null | undefined,
): number {
  return paraGramas(Number(quantidade) || 0, unidade || 'g');
}

export function embalagemDoItem(
  item: ItemEmbalagemCadastro | null | undefined,
  draft?: { qtd: number; unidade: string } | null,
): EmbalagemInfo | null {
  if (draft?.qtd && draft.qtd > 0) {
    return { qtd: draft.qtd, unidade: draft.unidade || 'g', fonte: 'cadastro' };
  }
  if (item?.embalagem_compra_qtd && item.embalagem_compra_qtd > 0) {
    return {
      qtd: item.embalagem_compra_qtd,
      unidade: item.embalagem_compra_unidade || item.unidade_interna || 'g',
      fonte: 'cadastro',
    };
  }
  return null;
}

export function sugerirQuantidadeComprar(
  quantidadeComprarManual: number | null | undefined,
  quantidadeFaltante: number | null | undefined,
  unidadeFaltante: string | null | undefined,
  embalagem: EmbalagemInfo | null,
): SugestaoCompra {
  if (quantidadeComprarManual != null && quantidadeComprarManual > 0) {
    return {
      quantidade: quantidadeComprarManual,
      unidade: unidadeFaltante || 'g',
      numEmbalagens: null,
      semEmbalagem: false,
    };
  }

  const faltaG = faltanteEmGramas(quantidadeFaltante, unidadeFaltante);
  const compra = calcularCompraArredondada(faltaG, embalagem);

  if (compra.semEmbalagem) {
    return {
      quantidade: Number(quantidadeFaltante) || 0,
      unidade: unidadeFaltante || 'g',
      numEmbalagens: null,
      semEmbalagem: true,
    };
  }

  return {
    quantidade: compra.comprarQtd,
    unidade: compra.comprarUnidade,
    numEmbalagens: compra.numEmbalagens,
    semEmbalagem: false,
  };
}

export function qtdComprarPadrao(
  quantidadeComprar: number | null | undefined,
  quantidadeFaltante: number | null | undefined,
  unidadeFaltante?: string | null,
  embalagem?: EmbalagemInfo | null,
): number {
  return sugerirQuantidadeComprar(
    quantidadeComprar,
    quantidadeFaltante,
    unidadeFaltante,
    embalagem ?? null,
  ).quantidade;
}

export function formatarQtdItem(valor: number | null | undefined, unidade: string | null | undefined): string {
  const v = Number(valor) || 0;
  const u = (unidade || 'g').trim();
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} ${u}`;
}

export function avaliarRecebimento(
  itens: Array<{ quantidade_comprar?: number | null; quantidade_recebida?: number | null }>,
): StatusRequisicao {
  const comCompra = itens.filter(i => (Number(i.quantidade_comprar) || 0) > 0);
  if (comCompra.length === 0) return STATUS_REQ.RECEBIDA_PARCIAL;

  const todosCompletos = comCompra.every(
    i => (Number(i.quantidade_recebida) || 0) >= (Number(i.quantidade_comprar) || 0),
  );
  const algumRecebido = comCompra.some(i => (Number(i.quantidade_recebida) || 0) > 0);

  if (todosCompletos) return STATUS_REQ.RECEBIDA;
  if (algumRecebido) return STATUS_REQ.RECEBIDA_PARCIAL;
  return STATUS_REQ.PO_EMITIDO;
}

/** Quantidade a comprar na cotação: pacote inteiro ou necessidade exata */
export function calcularQtdComprarCotacao(
  quantidadeFaltante: number | null | undefined,
  unidadeFaltante: string | null | undefined,
  unidadeCompra: string | null | undefined,
  qtdPorPacote: number | null | undefined,
): number {
  return calcularQuantidadeCotacao(
    quantidadeFaltante,
    unidadeFaltante,
    unidadeCompra,
    qtdPorPacote,
  ).quantidade;
}
