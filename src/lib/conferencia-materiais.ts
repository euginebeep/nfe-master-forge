// Utilitários para conferência de materiais na OP

export interface EmbalagemInfo {
  qtd: number;
  unidade: string;
  fonte: 'cadastro' | 'historico' | null;
}

export interface LinhaConferencia {
  insumoId: string | undefined;
  insumoNome: string;
  necessarioG: number;
  estoqueG: number;
  faltaG: number;
  embalagem: EmbalagemInfo | null;
  comprarQtd: number;
  comprarUnidade: string;
  numEmbalagens: number | null;
  semEmbalagem: boolean;
  fornecedorSugerido: string | null;
  ultimoPreco: number | null;
  precoMedio: number | null;
  ok: boolean;
}

const UNIDADES_MASSA = ['g', 'kg', 'mg'];

/** Converte valor para gramas (ou mantém unidades discretas como "un") */
export function paraGramas(valor: number, unidade: string): number {
  const u = (unidade || 'g').toLowerCase();
  if (u === 'kg') return valor * 1000;
  if (u === 'mg') return valor / 1000;
  if (u === 'un' || u === 'unidade' || u === 'und') return valor;
  return valor; // assume gramas
}

/** Converte gramas para a unidade alvo */
export function deGramas(valorG: number, unidade: string): number {
  const u = (unidade || 'g').toLowerCase();
  if (u === 'kg') return valorG / 1000;
  if (u === 'mg') return valorG * 1000;
  return valorG;
}

/** Formata quantidade para exibição legível */
export function formatarQtdExibicao(valor: number, unidade: string): string {
  const u = (unidade || 'g').toLowerCase();
  if (u === 'un' || u === 'unidade' || u === 'und') {
    return `${Math.round(valor).toLocaleString('pt-BR')} un`;
  }
  if (u === 'kg') {
    const fmt = valor >= 1
      ? valor.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : valor.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
    return `${fmt} kg`;
  }
  if (u === 'mg') {
    return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mg`;
  }
  // gramas — escolhe unidade ideal
  if (valor >= 1000) {
    const kg = valor / 1000;
    const fmt = kg >= 1
      ? kg.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
      : kg.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 3 });
    return `${fmt} kg`;
  }
  if (valor < 1) {
    return `${(valor * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} mg`;
  }
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} g`;
}

/** Formata necessário/estoque/falta a partir de gramas */
export function formatarQtdDeGramas(valorG: number): string {
  if (valorG >= 1000) {
    return `${(valorG / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} kg`;
  }
  if (valorG < 1 && valorG > 0) {
    return `${(valorG * 1000).toLocaleString('pt-BR', { maximumFractionDigits: 4 })} mg`;
  }
  return `${valorG.toLocaleString('pt-BR', { maximumFractionDigits: 4 })} g`;
}

/** Calcula quantidade de compra arredondada para embalagens inteiras */
export function calcularCompraArredondada(
  faltaG: number,
  embalagem: EmbalagemInfo | null,
): { comprarQtd: number; comprarUnidade: string; numEmbalagens: number | null; semEmbalagem: boolean } {
  if (faltaG <= 0) {
    return { comprarQtd: 0, comprarUnidade: 'g', numEmbalagens: null, semEmbalagem: false };
  }

  if (!embalagem || embalagem.qtd <= 0) {
    return { comprarQtd: faltaG, comprarUnidade: 'g', numEmbalagens: null, semEmbalagem: true };
  }

  const embG = paraGramas(embalagem.qtd, embalagem.unidade);
  const numPacotes = Math.ceil(faltaG / embG);
  const comprarG = numPacotes * embG;

  return {
    comprarQtd: deGramas(comprarG, embalagem.unidade),
    comprarUnidade: embalagem.unidade,
    numEmbalagens: numPacotes,
    semEmbalagem: false,
  };
}

/** Soma estoque disponível + quarentena por item_id */
export function somarEstoquePorItem(
  lotes: Array<{ item_id: string; quantidade_interna: number }>,
): Record<string, number> {
  const map: Record<string, number> = {};
  for (const l of lotes) {
    map[l.item_id] = (map[l.item_id] || 0) + (l.quantidade_interna || 0);
  }
  return map;
}

/** Monta endereço formatado da empresa */
export function formatarEnderecoEmpresa(company: {
  endereco_logradouro?: string | null;
  endereco_nro?: string | null;
  endereco_bairro?: string | null;
  endereco_cidade?: string | null;
  endereco_uf?: string | null;
  endereco_cep?: string | null;
}): string {
  const logradouro = [company.endereco_logradouro, company.endereco_nro].filter(Boolean).join(', ');
  const cidade = company.endereco_cidade && company.endereco_uf
    ? `${company.endereco_cidade}/${company.endereco_uf}`
    : company.endereco_cidade || company.endereco_uf || '';
  const cep = company.endereco_cep ? `CEP ${company.endereco_cep}` : '';
  return [logradouro, company.endereco_bairro, cidade, cep].filter(Boolean).join(' — ');
}

/** Gera texto monoespaçado da lista pura para fornecedor */
export function gerarTextoListaPura(
  numeroInterno: string,
  razaoSocial: string,
  endereco: string,
  itens: Array<{ nome: string; qtd: string }>,
  opts?: {
    tituloDocumento?: string;
    fornecedorNome?: string;
    grupos?: Array<{ categoria: string; itens: Array<{ nome: string; qtd: string }> }>;
  },
): string {
  const titulo = opts?.tituloDocumento
    ? `${opts.tituloDocumento} — ${numeroInterno}`
    : `LISTA DE COMPRA — ${numeroInterno}`;

  const linhas: string[] = [
    titulo,
    razaoSocial,
    endereco,
  ];

  if (opts?.fornecedorNome) {
    linhas.push(`Fornecedor: ${opts.fornecedorNome}`);
  }

  linhas.push('─'.repeat(30));

  const renderItem = (nome: string, qtd: string, maxNome: number) => {
    const dots = '.'.repeat(Math.max(1, maxNome - nome.length + 6));
    linhas.push(`${nome} ${dots} ${qtd}`);
  };

  if (opts?.grupos && opts.grupos.length > 0) {
    for (const grupo of opts.grupos) {
      if (grupo.itens.length === 0) continue;
      linhas.push('');
      linhas.push(`[ ${grupo.categoria} ]`);
      const maxNome = Math.max(...grupo.itens.map(i => i.nome.length), 10);
      for (const item of grupo.itens) {
        renderItem(item.nome, item.qtd, maxNome);
      }
    }
  } else {
    const maxNome = Math.max(...itens.map(i => i.nome.length), 10);
    for (const item of itens) {
      renderItem(item.nome, item.qtd, maxNome);
    }
  }

  linhas.push('─'.repeat(30));
  return linhas.join('\n');
}

export function isUnidadeMassa(unidade: string): boolean {
  return UNIDADES_MASSA.includes((unidade || 'g').toLowerCase());
}
