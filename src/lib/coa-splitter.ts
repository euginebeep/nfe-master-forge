export interface CertificadoCoa {
  insumo: string;
  loteFabricante: string;
  loteInterno: string;
  nota: string;
  paginaInicio: number;
  paginaFim: number;
}

const RE_INSUMO_COM_CODIGO = /Insumo:\s*(.+?)\s*C[óo]digo:/i;
const RE_INSUMO_LINHA = /Insumo:\s*([^\n]+)/i;
const RE_LOTE_FABRICANTE = /Lote do Fabricante:\s*(\S+)/i;
/** \S+ para no espaço — na mesma linha que "Lote do Fabricante:" não engole o rótulo seguinte */
const RE_LOTE_INTERNO = /Lote Interno:\s*(\S+)/i;
const RE_NOTA = /Nota Fiscal:\s*0*(\d+)/i;
const RE_TEM_INSUMO = /Insumo:/i;

/** Normaliza número da nota fiscal removendo zeros à esquerda */
export function normalizarNotaFiscal(valor?: string | null): string {
  if (!valor) return '';
  const digits = valor.replace(/\D/g, '');
  if (!digits) return '';
  return String(parseInt(digits, 10));
}

function normalizarTextoCampo(valor: string): string {
  return valor.trim().replace(/\s+/g, ' ');
}

function extrairInsumo(texto: string): string {
  const comCodigo = texto.match(RE_INSUMO_COM_CODIGO);
  if (comCodigo?.[1]) return normalizarTextoCampo(comCodigo[1]);
  const linha = texto.match(RE_INSUMO_LINHA);
  return linha?.[1] ? normalizarTextoCampo(linha[1]) : '';
}

function extrairCampo(texto: string, regex: RegExp): string {
  const match = texto.match(regex);
  return match?.[1] ? normalizarTextoCampo(match[1]) : '';
}

function extrairCamposCertificado(texto: string): Pick<CertificadoCoa, 'insumo' | 'loteFabricante' | 'loteInterno' | 'nota'> {
  const insumo = extrairInsumo(texto);
  const loteFabricante = extrairCampo(texto, RE_LOTE_FABRICANTE);
  const loteInterno = extrairCampo(texto, RE_LOTE_INTERNO);
  const notaRaw = texto.match(RE_NOTA)?.[1] ?? '';
  const nota = normalizarNotaFiscal(notaRaw);
  return { insumo, loteFabricante, loteInterno, nota };
}

/**
 * Identifica certificados em páginas de texto extraídas de um COA compilado.
 * Páginas consecutivas sem "Insumo:" continuam o certificado anterior.
 * Páginas consecutivas com o mesmo insumo são agrupadas.
 */
export function parseCertificados(paginasTexto: string[]): CertificadoCoa[] {
  if (!paginasTexto?.length) return [];

  type Bloco = { paginas: number[]; textos: string[]; insumo: string };
  const blocos: Bloco[] = [];
  let atual: Bloco | null = null;

  for (let i = 0; i < paginasTexto.length; i++) {
    const texto = paginasTexto[i] ?? '';
    const temInsumo = RE_TEM_INSUMO.test(texto);

    if (!temInsumo) {
      if (atual) {
        atual.paginas.push(i + 1);
        atual.textos.push(texto);
      }
      continue;
    }

    const insumo = extrairInsumo(texto);
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
    const textoCompleto = bloco.textos.join('\n');
    const campos = extrairCamposCertificado(textoCompleto);
    return {
      ...campos,
      paginaInicio: bloco.paginas[0],
      paginaFim: bloco.paginas[bloco.paginas.length - 1],
    };
  });
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
  return new Blob([pdfBytes], { type: 'application/pdf' });
}
