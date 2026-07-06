import {
  calcularCompraArredondada,
  formatarQtdExibicao,
  paraGramas,
  type EmbalagemInfo,
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

export function resolverEmbalagemCotacao(
  item: ItemCotacaoEmbalagem,
  fornecedor: FornecedorCotacaoEmbalagem,
): EmbalagemCotacaoResolvida {
  const faltaG = paraGramas(Number(item.quantidade_faltante) || 0, item.unidade || 'g');

  if (fornecedor.qtd_por_pacote != null && fornecedor.qtd_por_pacote > 0) {
    const unidade = fornecedor.unidade_compra_padrao || item.unidade || 'kg';
    const emb: EmbalagemInfo = {
      qtd: fornecedor.qtd_por_pacote,
      unidade,
      fonte: 'cadastro',
    };
    const compra = calcularCompraArredondada(faltaG, emb);
    const qtdFmt = formatarQtdExibicao(compra.comprarQtd, compra.comprarUnidade);

    if (compra.numEmbalagens === 1) {
      return {
        texto: qtdFmt,
        temPacote: true,
      };
    }

    const sacos = compra.numEmbalagens ?? 1;
    return {
      texto: `${qtdFmt} (${sacos} sacos de ${fornecedor.qtd_por_pacote} ${unidade})`,
      temPacote: true,
    };
  }

  const ultimaUnidade = fornecedor.ultima_unidade?.trim();
  if (ultimaUnidade) {
    return {
      texto: `em ${ultimaUnidade} — informar embalagem mínima vendida`,
      temPacote: false,
    };
  }

  const unidade = fornecedor.unidade_compra_padrao || item.unidade || 'un';
  return {
    texto: `em ${unidade} — informar embalagem mínima vendida`,
    temPacote: false,
  };
}
