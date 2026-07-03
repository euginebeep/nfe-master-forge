// ====================================================
// VALIDAÇÕES E BLOQUEIOS DE SEGURANÇA ERP
// ====================================================
// PRIORIDADE ABSOLUTA: SEGURANÇA, RASTREABILIDADE, CUSTO REAL E ESTOQUE REAL.
// ====================================================

import type { UnidadeFornecedor, UnidadeInternaLocal } from '@/hooks/use-local-itens';
import { SIMBOLO_MICROGRAMA } from '@/lib/unidades-dose';

// ====================================================
// REGRAS DE CONVERSÃO
// ====================================================

/**
 * Verifica se duas unidades são compatíveis para conversão
 * @returns true se podem ser convertidas, false se incompatíveis
 */
export function unidadesCompativeis(
  unidadeFornecedor: UnidadeFornecedor,
  unidadeInterna: UnidadeInternaLocal
): boolean {
  // Unidades de massa
  const massaFornecedor = ['kg', 'g', 'mg'];
  const massaInterna = ['kg', 'g', 'mg'];
  
  // Unidades de volume
  const volumeFornecedor = ['l', 'ml'];
  const volumeInterna = ['l', 'ml'];
  
  // Unidades discretas (contáveis)
  const discretasFornecedor = ['un', 'milheiro', 'caixa', 'fardo', 'pacote'];
  const discretasInternas = ['un'];
  
  // Massa com massa
  if (massaFornecedor.includes(unidadeFornecedor) && massaInterna.includes(unidadeInterna)) {
    return true;
  }
  
  // Volume com volume
  if (volumeFornecedor.includes(unidadeFornecedor) && volumeInterna.includes(unidadeInterna)) {
    return true;
  }
  
  // Discretas com discretas
  if (discretasFornecedor.includes(unidadeFornecedor) && discretasInternas.includes(unidadeInterna)) {
    return true;
  }
  
  // Concentrações especiais (UI/g, mcg/g) - precisam de tratamento especial
  if (unidadeFornecedor === 'UI_g' || unidadeFornecedor === 'mcg_g') {
    return false; // Não podem ser convertidas diretamente
  }
  
  return false;
}

/**
 * Calcula o fator de conversão automático para unidades conhecidas
 */
export function calcularFatorConversaoAutomatico(
  unidadeFornecedor: UnidadeFornecedor,
  unidadeInterna: UnidadeInternaLocal
): number | null {
  // Conversões de massa
  const conversoesMassa: Record<string, Record<string, number>> = {
    'kg': { 'kg': 1, 'g': 1000, 'mg': 1000000 },
    'g': { 'kg': 0.001, 'g': 1, 'mg': 1000 },
    'mg': { 'kg': 0.000001, 'g': 0.001, 'mg': 1 },
  };
  
  // Conversões de volume
  const conversoesVolume: Record<string, Record<string, number>> = {
    'l': { 'l': 1, 'ml': 1000 },
    'ml': { 'l': 0.001, 'ml': 1 },
  };
  
  // Conversões discretas conhecidas
  const conversoesDiscretas: Record<string, Record<string, number>> = {
    'un': { 'un': 1 },
    'milheiro': { 'un': 1000 },
    // caixa, fardo, pacote precisam de fator manual
  };
  
  // Buscar conversão
  if (conversoesMassa[unidadeFornecedor]?.[unidadeInterna]) {
    return conversoesMassa[unidadeFornecedor][unidadeInterna];
  }
  
  if (conversoesVolume[unidadeFornecedor]?.[unidadeInterna]) {
    return conversoesVolume[unidadeFornecedor][unidadeInterna];
  }
  
  if (conversoesDiscretas[unidadeFornecedor]?.[unidadeInterna]) {
    return conversoesDiscretas[unidadeFornecedor][unidadeInterna];
  }
  
  // Fator não pode ser calculado automaticamente
  return null;
}

// ====================================================
// CÁLCULOS DE ESTOQUE (REGRA CRÍTICA)
// ====================================================

/**
 * Calcula o estoque real na unidade interna
 * estoque_real = quantidade_fornecedor × fator_conversao
 */
export function calcularEstoqueReal(
  quantidadeFornecedor: number,
  fatorConversao: number
): number {
  return quantidadeFornecedor * fatorConversao;
}

// ====================================================
// CÁLCULOS DE CUSTO (REGRA CRÍTICA)
// ====================================================

/**
 * Calcula o custo unitário interno
 * custo_unitario_interno = custo_unitario_fornecedor ÷ fator_conversao
 * 
 * NUNCA USAR O CUSTO DO FORNECEDOR DIRETAMENTE NA UNIDADE INTERNA.
 */
export function calcularCustoUnitarioInterno(
  custoUnitarioFornecedor: number,
  fatorConversao: number
): number {
  if (fatorConversao <= 0) {
    throw new Error('Fator de conversão deve ser maior que zero');
  }
  return custoUnitarioFornecedor / fatorConversao;
}

/**
 * Calcula custo unitário interno a partir do valor total
 * custo_unitario_interno = valor_total / (quantidade_fornecedor × fator_conversao)
 */
export function calcularCustoUnitarioInternoDoTotal(
  valorTotal: number,
  quantidadeFornecedor: number,
  fatorConversao: number
): number {
  const quantidadeInterna = calcularEstoqueReal(quantidadeFornecedor, fatorConversao);
  if (quantidadeInterna <= 0) {
    throw new Error('Quantidade interna deve ser maior que zero');
  }
  return valorTotal / quantidadeInterna;
}

// ====================================================
// VALIDAÇÕES DE FORMULAÇÃO
// ====================================================

export interface ValidacaoPotenciaResult {
  valido: boolean;
  erro?: string;
  sugestao?: string;
}

/**
 * Valida se é possível converter UI sem concentração
 * PROIBIDO: Converter UI sem UI/g
 */
export function validarConversaoUI(
  unidadeDose: 'mg' | 'mcg' | 'UI' | 'g',
  tipoPotencia?: string,
  valorPotencia?: number
): ValidacaoPotenciaResult {
  if (unidadeDose === 'UI') {
    if (tipoPotencia !== 'UI_POR_GRAMA' || !valorPotencia || valorPotencia <= 0) {
      return {
        valido: false,
        erro: 'BLOQUEADO: Não é possível converter UI sem informar a concentração UI/g',
        sugestao: 'Informe a potência do ativo em UI/g (ex: 100.000 UI/g para Vitamina D3)',
      };
    }
  }
  return { valido: true };
}

/**
 * Valida se é possível converter mcg sem concentração
 * PROIBIDO: Converter mcg sem mcg/g
 */
export function validarConversaoMcg(
  unidadeDose: 'mg' | 'mcg' | 'UI' | 'g',
  tipoPotencia?: string,
  valorPotencia?: number
): ValidacaoPotenciaResult {
  if (unidadeDose === 'mcg') {
    // mcg pode ser convertido diretamente para mg sem potência
    // Mas se o ativo tem potência em mcg/g, deve ser informada
    if (tipoPotencia === 'MCG_POR_GRAMA' && (!valorPotencia || valorPotencia <= 0)) {
      return {
        valido: false,
        erro: 'BLOQUEADO: Potência mcg/g informada mas valor não definido',
        sugestao: 'Informe o valor da potência em mcg/g',
      };
    }
  }
  return { valido: true };
}

// ====================================================
// DILUIÇÃO GEOMÉTRICA
// ====================================================

export interface ValidacaoDiluicaoResult {
  pesagemCritica: boolean;
  sugerirPreMistura: boolean;
  mensagem?: string;
}

/**
 * Verifica se a quantidade final por cápsula exige diluição geométrica
 * SE A QUANTIDADE FINAL POR CÁPSULA FOR < 1 mg:
 * - MARCAR COMO PESAGEM CRÍTICA
 * - EXIGIR CONFIRMAÇÃO
 * - SUGERIR PRÉ-MISTURA (DILUIÇÃO GEOMÉTRICA)
 */
export function validarDiluicaoGeometrica(
  pesoPorCapsula_mg: number
): ValidacaoDiluicaoResult {
  if (pesoPorCapsula_mg < 1) {
    return {
      pesagemCritica: true,
      sugerirPreMistura: true,
      mensagem: `ATENÇÃO: Peso por cápsula (${pesoPorCapsula_mg.toFixed(4)} mg) é menor que 1 mg. Recomendado: Diluição Geométrica com pré-mistura.`,
    };
  }
  
  if (pesoPorCapsula_mg < 10) {
    return {
      pesagemCritica: true,
      sugerirPreMistura: false,
      mensagem: `CUIDADO: Peso por cápsula (${pesoPorCapsula_mg.toFixed(2)} mg) exige balança de precisão e técnica apurada.`,
    };
  }
  
  return {
    pesagemCritica: false,
    sugerirPreMistura: false,
  };
}

// ====================================================
// VALIDAÇÕES GERAIS
// ====================================================

/**
 * Valida se o fator de conversão é obrigatório e está definido
 */
export function validarFatorConversao(
  unidadeFornecedor: UnidadeFornecedor,
  unidadeInterna: UnidadeInternaLocal,
  fatorConversao?: number
): { valido: boolean; erro?: string } {
  // Se unidades são diferentes, fator é OBRIGATÓRIO
  if (unidadeFornecedor !== unidadeInterna) {
    if (!fatorConversao || fatorConversao <= 0) {
      return {
        valido: false,
        erro: `Fator de conversão é OBRIGATÓRIO quando unidades diferem (${unidadeFornecedor} → ${unidadeInterna})`,
      };
    }
  }
  
  return { valido: true };
}

/**
 * Formata unidade para exibição
 */
export function formatarUnidade(unidade: string): string {
  const mapa: Record<string, string> = {
    'kg': 'kg',
    'g': 'g',
    'mg': 'mg',
    'un': 'unidade(s)',
    'milheiro': 'milheiro(s)',
    'caixa': 'caixa(s)',
    'fardo': 'fardo(s)',
    'pacote': 'pacote(s)',
    'l': 'L',
    'ml': 'mL',
    'UI_g': 'UI/g',
    'mcg_g': `${SIMBOLO_MICROGRAMA}/g`,
  };
  return mapa[unidade] || unidade;
}

/**
 * Retorna a unidade interna padrão sugerida para um tipo de item
 */
export function unidadeInternaSugerida(tipoItem: string): UnidadeInternaLocal {
  switch (tipoItem) {
    case 'MP':
    case 'ATIVO':
    case 'EXCIPIENTE':
      return 'g';
    case 'EMBALAGEM':
    case 'ROTULO':
    case 'TAMPA':
    case 'POTE':
    case 'SILICA':
    case 'CAPSULA':
    case 'CAPSULA_VAZIA':
    case 'ACESSORIO':
      return 'un';
    default:
      return 'g';
  }
}

/**
 * Retorna a unidade de fornecedor padrão sugerida para um tipo de item
 */
export function unidadeFornecedorSugerida(tipoItem: string): UnidadeFornecedor {
  switch (tipoItem) {
    case 'MP':
    case 'ATIVO':
    case 'EXCIPIENTE':
      return 'kg';
    case 'CAPSULA':
    case 'CAPSULA_VAZIA':
      return 'milheiro';
    case 'EMBALAGEM':
    case 'ROTULO':
    case 'TAMPA':
    case 'POTE':
    case 'SILICA':
    case 'ACESSORIO':
      return 'un';
    default:
      return 'kg';
  }
}
