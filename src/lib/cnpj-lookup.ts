// CNPJ Lookup Service - Uses BrasilAPI
// https://brasilapi.com.br/docs#tag/CNPJ

export interface CNPJData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string;
  cnae_fiscal: number;
  cnae_fiscal_descricao: string;
  natureza_juridica: string;
  descricao_situacao_cadastral: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  uf: string;
  municipio: string;
  codigo_municipio: number;
  email: string;
  telefone: string;
  porte: string;
  opcao_pelo_simples: boolean;
  opcao_pelo_mei: boolean;
  data_abertura: string;
  inscricao_estadual?: string;
}

export function formatCNPJ(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

export function cleanCNPJ(cnpj: string): string {
  return cnpj.replace(/\D/g, '');
}

export function isValidCNPJFormat(cnpj: string): boolean {
  return cleanCNPJ(cnpj).length === 14;
}

export async function lookupCNPJ(cnpj: string): Promise<CNPJData | null> {
  const cleanedCNPJ = cleanCNPJ(cnpj);
  
  if (cleanedCNPJ.length !== 14) {
    throw new Error('CNPJ inválido: deve conter 14 dígitos');
  }
  
  try {
    // Use edge function proxy to avoid CORS issues
    const supabaseUrl = "https://cqkvekdrifmvedvpjmjr.supabase.co";
    const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxa3Zla2RyaWZtdmVkdnBqbWpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAyODA0MzAsImV4cCI6MjA5NTg1NjQzMH0.6Y6c5-lzCcA5j8ujKMfvOqHBT19gZ4D8_PL1ZqVAYYI";
    
    const response = await fetch(`${supabaseUrl}/functions/v1/cnpj-lookup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({ cnpj: cleanedCNPJ }),
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 404) {
        throw new Error('CNPJ não encontrado na base da Receita Federal');
      }
      if (response.status === 400) {
        throw new Error('CNPJ inválido');
      }
      throw new Error(errorData.error || 'Erro ao consultar CNPJ');
    }
    
    const data = await response.json();
    return data as CNPJData;
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erro de conexão ao consultar CNPJ');
  }
}

// Map CNPJ data to CRT (Código de Regime Tributário)
export function mapToCRT(data: CNPJData): string {
  if (data.opcao_pelo_mei) {
    return '4'; // MEI
  }
  if (data.opcao_pelo_simples) {
    return '1'; // Simples Nacional
  }
  return '3'; // Regime Normal
}

// Map CNPJ data to Regime Tributário
export function mapToRegimeTributario(data: CNPJData): string {
  if (data.opcao_pelo_mei) {
    return 'MEI';
  }
  if (data.opcao_pelo_simples) {
    return 'SIMPLES';
  }
  // Estimate based on company size
  if (data.porte === 'DEMAIS' || data.porte === 'GRANDE') {
    return 'LUCRO_REAL';
  }
  return 'LUCRO_PRESUMIDO';
}

// Format CNAE code
export function formatCNAE(cnae: number): string {
  const str = cnae.toString().padStart(7, '0');
  return `${str.slice(0, 4)}-${str.slice(4, 5)}/${str.slice(5)}`;
}

// Format CNAE with description
export function formatCNAEWithDescription(cnae: number, descricao: string): string {
  const code = formatCNAE(cnae);
  return descricao ? `${code} - ${descricao}` : code;
}
