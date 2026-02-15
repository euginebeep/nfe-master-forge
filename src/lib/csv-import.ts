/**
 * CSV Import utility - parses CSV/TSV files with auto-detection of delimiter and encoding.
 */

export interface CSVParseResult {
  headers: string[];
  rows: string[][];
  totalRows: number;
  errors: string[];
}

export interface ColumnMapping {
  csvColumn: string;
  dbField: string;
}

export function parseCSV(text: string): CSVParseResult {
  const errors: string[] = [];
  // Auto-detect delimiter
  const firstLine = text.split('\n')[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    return { headers: [], rows: [], totalRows: 0, errors: ['Arquivo vazio ou sem dados'] };
  }

  const headers = parseLine(lines[0], delimiter);
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const row = parseLine(lines[i], delimiter);
      // Pad or trim to match header count
      while (row.length < headers.length) row.push('');
      rows.push(row.slice(0, headers.length));
    } catch {
      errors.push(`Erro na linha ${i + 1}`);
    }
  }

  return { headers, rows, totalRows: rows.length, errors };
}

function parseLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delimiter) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
    reader.readAsText(file, 'UTF-8');
  });
}

// Pre-defined field mappings for common imports
export const ITEM_FIELDS = [
  { value: 'descricao_interna', label: 'Descrição' },
  { value: 'sku_interno', label: 'SKU / Código' },
  { value: 'tipo_item', label: 'Tipo (MP, PA, EMB, INSUMO)' },
  { value: 'unidade_interna', label: 'Unidade (g, kg, un)' },
  { value: 'ncm', label: 'NCM' },
  { value: 'categoria_operacional', label: 'Categoria' },
  { value: 'armazenamento', label: 'Armazenamento' },
  { value: '__ignorar', label: '— Ignorar coluna —' },
] as const;

export const ENTIDADE_FIELDS = [
  { value: 'razao_social', label: 'Razão Social' },
  { value: 'nome_fantasia', label: 'Nome Fantasia' },
  { value: 'documento', label: 'CNPJ / CPF' },
  { value: 'tipo_pessoa', label: 'Tipo (PJ / PF)' },
  { value: 'ie', label: 'Inscrição Estadual' },
  { value: 'status', label: 'Status' },
  { value: '__ignorar', label: '— Ignorar coluna —' },
] as const;
