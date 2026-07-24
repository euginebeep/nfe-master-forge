export interface CertificadoCoa {
  insumo: string;
  /** Lote comercial / "Lote :" / "Lote do Fabricante:" */
  loteFabricante: string;
  /** Lote interno / "Lote Fab.:" quando distinto */
  loteInterno: string;
  /** Número da NF normalizado (só dígitos, sem zeros à esquerda) */
  nota: string;
  /** Validade extraída do PDF (texto original, ex. 20/10/28) */
  validade?: string;
  /** Fabricação extraída do PDF */
  fabricacao?: string;
  /** Conclusão APROVADO / REPROVADO quando presente */
  conclusao?: string | null;
  paginaInicio: number;
  paginaFim: number;
}

type CampoCoa =
  | 'insumo'
  | 'loteInterno'
  | 'loteFabricante'
  | 'nota'
  | 'validade'
  | 'fabricacao'
  | 'conclusao';

type RotuloDef =
  | { tipo: 'campo'; campo: CampoCoa; label: string; isolado?: boolean }
  | { tipo: 'fronteira'; label: string };

/**
 * Rótulos de campo → CertificadoCoa.
 * Copiar EXATAMENTE — fornecedor novo = acrescentar variante na lista.
 */
const ROTULOS_CAMPO: RotuloDef[] = [
  { tipo: 'campo', campo: 'insumo', label: 'Matéria-prima' },
  { tipo: 'campo', campo: 'insumo', label: 'Materia-prima' },
  { tipo: 'campo', campo: 'insumo', label: 'Insumo' },
  { tipo: 'campo', campo: 'insumo', label: 'Produto' },
  { tipo: 'campo', campo: 'insumo', label: 'Material' },

  { tipo: 'campo', campo: 'loteInterno', label: 'Lote Interno' },
  { tipo: 'campo', campo: 'loteInterno', label: 'Lote Fab.' },
  { tipo: 'campo', campo: 'loteInterno', label: 'Lote Fab' },

  { tipo: 'campo', campo: 'loteFabricante', label: 'Lote do Fabricante' },
  /** "Lote" isolado — não casa Lote Interno / Lote Fab / Lote do Fabricante */
  { tipo: 'campo', campo: 'loteFabricante', label: 'Lote', isolado: true },

  { tipo: 'campo', campo: 'nota', label: 'Nota Fiscal' },
  { tipo: 'campo', campo: 'nota', label: 'NF.' },
  { tipo: 'campo', campo: 'nota', label: 'NFe' },
  { tipo: 'campo', campo: 'nota', label: 'NF' },

  { tipo: 'campo', campo: 'validade', label: 'Data de Vencimento' },
  { tipo: 'campo', campo: 'validade', label: 'Data de Validade' },
  { tipo: 'campo', campo: 'validade', label: 'Vencimento' },
  { tipo: 'campo', campo: 'validade', label: 'Validade' },

  { tipo: 'campo', campo: 'fabricacao', label: 'Data de Fabricação' },
  { tipo: 'campo', campo: 'fabricacao', label: 'Data de Fabricacao' },
  { tipo: 'campo', campo: 'fabricacao', label: 'Fabricação' },
  { tipo: 'campo', campo: 'fabricacao', label: 'Fabricacao' },

  { tipo: 'campo', campo: 'conclusao', label: 'Conclusão' },
  { tipo: 'campo', campo: 'conclusao', label: 'Conclusao' },
];

/** Não viram campo — só delimitam o fim do valor anterior. */
const ROTULOS_FRONTEIRA: RotuloDef[] = [
  'Origem',
  'Procedência',
  'Procedencia',
  'CAS',
  'DCB',
  'DCI',
  'Data da Análise',
  'Data da Analise',
  'Número da Ordem',
  'Numero da Ordem',
  'Condições de Armazenamento',
  'Condicoes de Armazenamento',
  'Fórmula Molecular',
  'Formula Molecular',
  'Peso Molecular',
  'Código',
  'Codigo',
  'Data de Emissão',
  'Data de Emissao',
  'TESTES',
  'ESPECIFICAÇÕES',
  'ESPECIFICACOES',
].map((label) => ({ tipo: 'fronteira' as const, label }));

const TODOS_ROTULOS: RotuloDef[] = [...ROTULOS_CAMPO, ...ROTULOS_FRONTEIRA];

/** Normaliza número da nota fiscal removendo pontuação e zeros à esquerda */
export function normalizarNotaFiscal(valor?: string | null): string {
  if (!valor) return '';
  const digits = valor.replace(/\D/g, '');
  if (!digits) return '';
  return String(parseInt(digits, 10));
}

function normalizarTextoCampo(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}

/** Padrão regex com espaços flexíveis e acentos opcionais (casamento case-insensitive). */
function padraoRotulo(label: string): string {
  const semAcento = label.normalize('NFD').replace(/\p{M}/gu, '');
  let out = '';
  for (const ch of semAcento) {
    if (/\s/.test(ch)) {
      out += '\\s+';
      continue;
    }
    const lower = ch.toLowerCase();
    const groups: Record<string, string> = {
      a: '[AaÁáÀàÂâÃãÄä]',
      e: '[EeÉéÈèÊêËë]',
      i: '[IiÍíÌìÎîÏï]',
      o: '[OoÓóÒòÔôÕõÖö]',
      u: '[UuÚúÙùÛûÜü]',
      c: '[CcÇç]',
      n: '[NnÑñ]',
    };
    if (groups[lower]) {
      out += groups[lower];
    } else if (/[.*+?^${}()|[\]\\]/.test(ch)) {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }
  return out;
}

type Marcacao = {
  start: number;
  end: number; // fim do rótulo (após ":" opcional)
  labelLen: number;
  campo: CampoCoa | null;
};

function marcarRotulos(texto: string): Marcacao[] {
  const candidatos: Marcacao[] = [];

  for (const rot of TODOS_ROTULOS) {
    const corpo = padraoRotulo(rot.label);
    let source: string;
    if (rot.tipo === 'campo' && rot.isolado) {
      // "Lote" isolado (ex. ProLab "Lote : HA…#3"): exige ":" para não
      // casar o prefixo de "LOTE-ABC-123" nem "Lote Interno"/"Lote Fab".
      source =
        `\\b(?:${corpo})(?!\\s+(?:Interno|Fab\\.?|do\\s+Fabricante)\\b)\\s*:`;
    } else if (rot.tipo === 'campo' && rot.campo === 'insumo') {
      // Evita prosa ("de insumo nesta página") — não precedido de de/do/da/em.
      source =
        `(?<!\\bde\\s)(?<!\\bdo\\s)(?<!\\bda\\s)(?<!\\bem\\s)\\b(?:${corpo})\\s*:?`;
    } else {
      source = `\\b(?:${corpo})\\s*:?`;
    }

    const re = new RegExp(source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = re.exec(texto)) !== null) {
      candidatos.push({
        start: m.index,
        end: m.index + m[0].length,
        labelLen: rot.label.length,
        campo: rot.tipo === 'campo' ? rot.campo : null,
      });
      if (m[0].length === 0) re.lastIndex++;
    }
  }

  // Preferir rótulo mais longo em sobreposição; depois o que começa antes
  candidatos.sort((a, b) => a.start - b.start || b.labelLen - a.labelLen);

  const escolhidos: Marcacao[] = [];
  for (const c of candidatos) {
    const overlap = escolhidos.some((e) => c.start < e.end && c.end > e.start);
    if (!overlap) escolhidos.push(c);
  }

  return escolhidos.sort((a, b) => a.start - b.start);
}

function limparValorNota(bruto: string): string {
  // "101.019   de 21/07/2026" → só o número da NF
  const m = bruto.match(/[\d.]+/);
  return m ? normalizarNotaFiscal(m[0]) : '';
}

function limparValorConclusao(bruto: string): string | null {
  const m = bruto.match(/\b(APROVADO|REPROVADO|CONFORME|N[AÃ]O\s+CONFORME)\b/i);
  return m?.[1] ? normalizarTextoCampo(m[1]).toUpperCase() : null;
}

function limparValorData(bruto: string): string {
  const m = bruto.match(/\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}/);
  return m ? m[0] : normalizarTextoCampo(bruto);
}

/**
 * Extrai campos varrendo rótulos conhecidos (campo + fronteira).
 * Valor = texto entre o fim do rótulo e o início do próximo rótulo qualquer.
 * Dois-pontos após o rótulo é opcional.
 */
export function extrairCamposPorDicionario(
  texto: string,
): Pick<
  CertificadoCoa,
  'insumo' | 'loteFabricante' | 'loteInterno' | 'nota' | 'validade' | 'fabricacao' | 'conclusao'
> {
  const vazio = {
    insumo: '',
    loteFabricante: '',
    loteInterno: '',
    nota: '',
    validade: undefined as string | undefined,
    fabricacao: undefined as string | undefined,
    conclusao: null as string | null,
  };
  if (!texto?.trim()) return vazio;

  const marcas = marcarRotulos(texto);
  const bruto: Partial<Record<CampoCoa, string>> = {};

  for (let i = 0; i < marcas.length; i++) {
    const marca = marcas[i];
    if (!marca.campo) continue;
    // Já tem valor neste campo → primeira ocorrência ganha
    if (bruto[marca.campo] != null && bruto[marca.campo] !== '') continue;

    const fimValor = i + 1 < marcas.length ? marcas[i + 1].start : texto.length;
    const valor = normalizarTextoCampo(texto.slice(marca.end, fimValor));
    if (valor) bruto[marca.campo] = valor;
  }

  let loteFabricante = bruto.loteFabricante ?? '';
  let loteInterno = bruto.loteInterno ?? '';
  // Se só veio Lote Fab. / Interno, usar também como fabricante (legado ProLab)
  if (!loteFabricante && loteInterno) loteFabricante = loteInterno;

  const nota = bruto.nota ? limparValorNota(bruto.nota) : '';
  const validade = bruto.validade ? limparValorData(bruto.validade) : undefined;
  const fabricacao = bruto.fabricacao ? limparValorData(bruto.fabricacao) : undefined;
  const conclusao = bruto.conclusao ? limparValorConclusao(bruto.conclusao) : null;

  return {
    insumo: bruto.insumo ?? '',
    loteFabricante,
    loteInterno,
    nota,
    validade,
    fabricacao,
    conclusao,
  };
}

function paginaTemRotuloInsumo(texto: string): boolean {
  for (const rot of ROTULOS_CAMPO) {
    if (rot.tipo !== 'campo' || rot.campo !== 'insumo') continue;
    const corpo = padraoRotulo(rot.label);
    const re = new RegExp(
      `(?<!\\bde\\s)(?<!\\bdo\\s)(?<!\\bda\\s)(?<!\\bem\\s)\\b(?:${corpo})\\s*:?`,
      'i',
    );
    if (re.test(texto)) return true;
  }
  return false;
}

/**
 * Identifica certificados em páginas de texto extraídas de um COA compilado.
 * Páginas consecutivas sem rótulo de insumo continuam o certificado anterior.
 * Páginas consecutivas com o mesmo insumo são agrupadas.
 */
export function parseCertificados(paginasTexto: string[]): CertificadoCoa[] {
  if (!paginasTexto?.length) return [];

  type Bloco = { paginas: number[]; textos: string[]; insumo: string };
  const blocos: Bloco[] = [];
  let atual: Bloco | null = null;

  for (let i = 0; i < paginasTexto.length; i++) {
    const texto = paginasTexto[i] ?? '';
    const temInsumo = paginaTemRotuloInsumo(texto);

    if (!temInsumo) {
      if (atual) {
        atual.paginas.push(i + 1);
        atual.textos.push(texto);
      }
      continue;
    }

    const campos = extrairCamposPorDicionario(texto);
    const insumo = campos.insumo;
    if (!insumo) continue;

    if (!atual) {
      atual = { paginas: [i + 1], textos: [texto], insumo };
      continue;
    }

    if (insumo === atual.insumo) {
      atual.paginas.push(i + 1);
      atual.textos.push(texto);
      continue;
    }

    blocos.push(atual);
    atual = { paginas: [i + 1], textos: [texto], insumo };
  }

  if (atual) blocos.push(atual);

  return blocos.map((bloco) => {
    const textoCompleto = bloco.textos.join(' ');
    const campos = extrairCamposPorDicionario(textoCompleto);
    return {
      ...campos,
      paginaInicio: bloco.paginas[0],
      paginaFim: bloco.paginas[bloco.paginas.length - 1],
    };
  });
}

/** Extrai o número de NF mais frequente nos certificados (para auto-seleção). */
export function notaPredominanteNosCertificados(certs: CertificadoCoa[]): string | null {
  const contagem = new Map<string, number>();
  for (const c of certs) {
    const n = normalizarNotaFiscal(c.nota);
    if (!n) continue;
    contagem.set(n, (contagem.get(n) || 0) + 1);
  }
  let best: string | null = null;
  let max = 0;
  for (const [n, q] of contagem) {
    if (q > max) {
      max = q;
      best = n;
    }
  }
  return best;
}

/** Extrai texto de cada página de um PDF usando pdfjs-dist */
export async function extrairTextoPorPagina(file: File): Promise<string[]> {
  if (!file) return [];

  const pdfjsLib = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjsLib.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const paginas: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    paginas.push(text);
  }

  return paginas;
}

/**
 * Recorta um intervalo de páginas (1-based, inclusivo) em um novo PDF.
 */
export async function fatiarCertificado(file: File, inicio: number, fim: number): Promise<Blob> {
  if (!file) throw new Error('Arquivo PDF não informado');
  if (!Number.isFinite(inicio) || !Number.isFinite(fim) || inicio < 1 || fim < inicio) {
    throw new Error(`Intervalo de páginas inválido: ${inicio}-${fim}`);
  }

  const { PDFDocument } = await import('pdf-lib');
  const bytes = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(bytes);
  const total = srcDoc.getPageCount();

  if (fim > total) {
    throw new Error(`Página final ${fim} excede o total (${total}) do PDF`);
  }

  const newDoc = await PDFDocument.create();
  const indices = Array.from({ length: fim - inicio + 1 }, (_, idx) => inicio - 1 + idx);
  const copied = await newDoc.copyPages(srcDoc, indices);
  copied.forEach((page) => newDoc.addPage(page));

  const pdfBytes = await newDoc.save();
  return new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
}
