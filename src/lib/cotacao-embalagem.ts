import {
  deGramas,
  formatarQtdExibicao,
  paraGramas,
} from '@/lib/conferencia-materiais';

export interface ItemCotacaoEmbalagem {
  quantidade_faltante: number | null | undefined;
  unidade: string | null | undefined;
  tipo_item?: string | null;
}

export interface FornecedorCotacaoEmbalagem {
  qtd_por_pacote: number | null;
  unidade_compra_padrao: string | null;
  ultima_unidade?: string | null;
  ultima_qtd?: number | null;
}

export interface EmbalagemCotacaoResolvida {
  texto: string;
  temPacote: boolean;
}

export interface QuantidadeCotacaoCalculada {
  quantidade: number;
  unidade: string;
  numPacotes: number | null;
  temPacote: boolean;
}

export function grupoCategoria(tipo_item: string | null | undefined): string {
  const t = (tipo_item || '').toUpperCase();
  if (['MP', 'SILICA', 'PREMIX'].includes(t)) return 'ATIVOS / MATÉRIA-PRIMA';
  if (['EMBALAGEM', 'POTE', 'TAMPA', 'ROTULO', 'CAPSULA_VAZIA'].includes(t)) return 'EMBALAGENS';
  return 'OUTROS';
}

export const ORDEM_CATEGORIAS_RFQ = [
  'ATIVOS / MATÉRIA-PRIMA',
  'EMBALAGENS',
  'OUTROS',
] as const;

/**
 * COM pacote: arredonda para cima em embalagens inteiras (via gramas).
 * SEM pacote: necessidade exata na unidade original, sem arredondar.
 */
export function calcularQuantidadeCotacao(
  quantidadeFaltante: number | null | undefined,
  unidadeFaltante: string | null | undefined,
  unidadeCompra: string | null | undefined,
  qtdPorPacote: number | null | undefined,
): QuantidadeCotacaoCalculada {
  const falta = Number(quantidadeFaltante) || 0;
  const unidadeItem = (unidadeFaltante || 'g').trim();

  if (qtdPorPacote != null && qtdPorPacote > 0) {
    const unidadeCompraEff = (unidadeCompra || unidadeItem || 'kg').trim();
    const faltaG = paraGramas(falta, unidadeItem);
    const pacoteG = paraGramas(qtdPorPacote, unidadeCompraEff);
    const numPacotes = pacoteG > 0 ? Math.ceil(faltaG / pacoteG) : 1;
    const comprarG = numPacotes * pacoteG;

    return {
      quantidade: deGramas(comprarG, unidadeCompraEff),
      unidade: unidadeCompraEff,
      numPacotes,
      temPacote: true,
    };
  }

  return {
    quantidade: falta,
    unidade: unidadeItem,
    numPacotes: null,
    temPacote: false,
  };
}

function formatarNecessidadeExata(valor: number, unidade: string): string {
  return formatarQtdExibicao(valor, unidade);
}

export function resolverEmbalagemCotacao(
  item: ItemCotacaoEmbalagem,
  fornecedor: FornecedorCotacaoEmbalagem,
): EmbalagemCotacaoResolvida {
  const calc = calcularQuantidadeCotacao(
    item.quantidade_faltante,
    item.unidade,
    fornecedor.unidade_compra_padrao,
    fornecedor.qtd_por_pacote,
  );

  if (calc.temPacote) {
    const qtdFmt = formatarQtdExibicao(calc.quantidade, calc.unidade);
    const pacote = fornecedor.qtd_por_pacote!;

    if (calc.numPacotes === 1) {
      return { texto: qtdFmt, temPacote: true };
    }

    return {
      texto: `${qtdFmt} (${calc.numPacotes} sacos de ${pacote} ${calc.unidade})`,
      temPacote: true,
    };
  }

  const necessidade = formatarNecessidadeExata(calc.quantidade, calc.unidade);
  return {
    texto: `${necessidade} — informar embalagem mínima vendida`,
    temPacote: false,
  };
}
