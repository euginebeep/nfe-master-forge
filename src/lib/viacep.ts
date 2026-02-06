/**
 * Integração com API ViaCEP para busca automática de endereços
 * https://viacep.com.br/
 */

export interface ViaCepResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;  // Código IBGE do município (cmun)
  gia: string;
  ddd: string;
  siafi: string;
  erro?: boolean;
}

export interface EnderecoViaCep {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  cmun: string;  // Código IBGE do município
  pais: string;
  cpais: string;
}

/**
 * Busca endereço pelo CEP usando a API ViaCEP
 * @param cep CEP no formato 00000-000 ou 00000000
 * @returns Dados do endereço ou null se não encontrado
 */
export async function buscarCep(cep: string): Promise<EnderecoViaCep | null> {
  // Remove caracteres não numéricos
  const cepLimpo = cep.replace(/\D/g, '');
  
  if (cepLimpo.length !== 8) {
    throw new Error('CEP deve ter 8 dígitos');
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
    
    if (!response.ok) {
      throw new Error('Erro ao consultar ViaCEP');
    }

    const data: ViaCepResponse = await response.json();

    if (data.erro) {
      return null;
    }

    return {
      cep: data.cep,
      logradouro: data.logradouro,
      complemento: data.complemento,
      bairro: data.bairro,
      cidade: data.localidade,
      uf: data.uf,
      cmun: data.ibge,
      pais: 'Brasil',
      cpais: '1058',
    };
  } catch (error) {
    console.error('Erro ao buscar CEP:', error);
    throw error;
  }
}

/**
 * Formata CEP para exibição (00000-000)
 */
export function formatCep(cep: string): string {
  const cepLimpo = cep.replace(/\D/g, '');
  if (cepLimpo.length !== 8) return cep;
  return `${cepLimpo.slice(0, 5)}-${cepLimpo.slice(5)}`;
}

/**
 * Valida formato de CEP
 */
export function isValidCep(cep: string): boolean {
  const cepLimpo = cep.replace(/\D/g, '');
  return cepLimpo.length === 8;
}
