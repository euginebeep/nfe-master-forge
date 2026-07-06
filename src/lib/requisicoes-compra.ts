export const STATUS_REQ = {
  ABERTA: 'ABERTA',
  COTACAO: 'COTACAO',
  APROVADA: 'APROVADA',
  PEDIDO_ENVIADO: 'PEDIDO_ENVIADO',
  RECEBIDA_PARCIAL: 'RECEBIDA_PARCIAL',
  RECEBIDA: 'RECEBIDA',
} as const;

export type StatusRequisicao = (typeof STATUS_REQ)[keyof typeof STATUS_REQ];

export const STATUS_REQ_ORDEM: StatusRequisicao[] = [
  STATUS_REQ.ABERTA,
  STATUS_REQ.COTACAO,
  STATUS_REQ.APROVADA,
  STATUS_REQ.PEDIDO_ENVIADO,
  STATUS_REQ.RECEBIDA_PARCIAL,
  STATUS_REQ.RECEBIDA,
];

const TRANSICOES: Record<StatusRequisicao, StatusRequisicao[]> = {
  [STATUS_REQ.ABERTA]: [STATUS_REQ.COTACAO],
  [STATUS_REQ.COTACAO]: [STATUS_REQ.APROVADA],
  [STATUS_REQ.APROVADA]: [STATUS_REQ.PEDIDO_ENVIADO],
  [STATUS_REQ.PEDIDO_ENVIADO]: [STATUS_REQ.RECEBIDA_PARCIAL, STATUS_REQ.RECEBIDA],
  [STATUS_REQ.RECEBIDA_PARCIAL]: [STATUS_REQ.RECEBIDA],
  [STATUS_REQ.RECEBIDA]: [],
};

export function podeTransicionar(de: string, para: StatusRequisicao): boolean {
  const permitidos = TRANSICOES[de as StatusRequisicao];
  return Array.isArray(permitidos) && permitidos.includes(para);
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
  const labels: Record<string, string> = {
    [STATUS_REQ.ABERTA]: 'Aberta',
    [STATUS_REQ.COTACAO]: 'Em cotação',
    [STATUS_REQ.APROVADA]: 'Aprovada',
    [STATUS_REQ.PEDIDO_ENVIADO]: 'Pedido enviado',
    [STATUS_REQ.RECEBIDA_PARCIAL]: 'Recebida parcial',
    [STATUS_REQ.RECEBIDA]: 'Recebida',
  };
  return labels[status] || status;
}

export function qtdComprarPadrao(
  quantidadeComprar: number | null | undefined,
  quantidadeFaltante: number | null | undefined,
): number {
  if (quantidadeComprar != null && quantidadeComprar > 0) return quantidadeComprar;
  return Number(quantidadeFaltante) || 0;
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
  return STATUS_REQ.PEDIDO_ENVIADO;
}
