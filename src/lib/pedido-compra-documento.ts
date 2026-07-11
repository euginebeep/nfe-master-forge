import type { PedidoCompraItem } from '@/hooks/use-pedidos-compra';
import { formatCurrency } from '@/lib/formatters';
import { formatarQtdItem } from '@/lib/requisicoes-compra';

function textoQuantidadeItem(item: PedidoCompraItem): string {
  const qtd = formatarQtdItem(item.quantidade, item.unidade);
  if (
    item.num_pacotes != null
    && item.qtd_por_pacote != null
    && item.unidade
  ) {
    return `${qtd} (${item.num_pacotes} × ${item.qtd_por_pacote} ${item.unidade})`;
  }
  return qtd;
}

export function subtotalItensPedido(itens: PedidoCompraItem[]): number {
  return itens.reduce((acc, item) => acc + (item.subtotal ?? 0), 0);
}

export function calcularFretePedido(
  valorTotal: number,
  itens: PedidoCompraItem[],
  freteInformado?: number | null,
): number {
  if (freteInformado != null && freteInformado >= 0) return freteInformado;
  const subtotal = subtotalItensPedido(itens);
  const diff = valorTotal - subtotal;
  return diff > 0.0001 ? diff : 0;
}

export interface TextoPedidoCompraParams {
  razaoSocial: string;
  endereco: string;
  cnpj?: string | null;
  numeroInterno: string;
  dataEmissao: string;
  fornecedorNome: string;
  itens: PedidoCompraItem[];
  frete: number;
  valorTotal: number;
  condicaoPrazo?: string | null;
}

export function buildTextoPedidoCompra(params: TextoPedidoCompraParams): string {
  const {
    razaoSocial,
    endereco,
    cnpj,
    numeroInterno,
    dataEmissao,
    fornecedorNome,
    itens,
    frete,
    valorTotal,
    condicaoPrazo,
  } = params;

  const linhas: string[] = [
    `PEDIDO DE COMPRA — ${numeroInterno}`,
    razaoSocial,
  ];

  if (cnpj) linhas.push(`CNPJ ${cnpj}`);
  if (endereco) linhas.push(endereco);
  linhas.push(`Data: ${dataEmissao}`);
  linhas.push('');
  linhas.push(`Fornecedor destino: ${fornecedorNome}`);
  linhas.push('');
  linhas.push('Item | Qtd | Preço unit. | Subtotal');

  for (const item of itens) {
    const preco = item.preco_unitario != null ? formatCurrency(item.preco_unitario) : '—';
    const sub = item.subtotal != null ? formatCurrency(item.subtotal) : '—';
    linhas.push(`${item.item_nome} | ${textoQuantidadeItem(item)} | ${preco} | ${sub}`);
  }

  linhas.push('');
  if (frete > 0) linhas.push(`Frete: ${formatCurrency(frete)}`);
  linhas.push(`TOTAL: ${formatCurrency(valorTotal)}`);
  if (condicaoPrazo?.trim()) {
    linhas.push(`Condição/Prazo: ${condicaoPrazo.trim()}`);
  }

  return linhas.join('\n');
}

export { textoQuantidadeItem };
