/**
 * Utilitário para parsear unidades malformadas do XML da NF-e
 * 
 * Problema: XML vem com unidades como "25 KG", "500 g", etc
 * Solução: Extrair número como multiplicador e unidade como string
 * 
 * Exemplos:
 * - "25 KG" → { unidade: "KG", multiplicador: 25, quantidadeReal: 25 }
 * - "500 g" → { unidade: "g", multiplicador: 500, quantidadeReal: 500 }
 * - "KG" → { unidade: "KG", multiplicador: 1, quantidadeReal: 1 }
 */

import { canonicalizarUnidadeDose } from '@/lib/unidades-dose';

export interface UnidadeParsed {
  unidade: string;           // Unidade corrigida (ex: "KG", "g", "ml")
  multiplicador: number;     // Número extraído (ex: 25, 500, 1)
  quantidadeReal: number;    // quantidade_xml * multiplicador
  temProblema: boolean;      // true se tinha número embutido
}

/**
 * Extrai unidade e multiplicador de string malformada
 * @param unidadeXml - Unidade do XML (ex: "25 KG", "KG")
 * @param quantidadeXml - Quantidade do XML (ex: 1, 25)
 * @returns Objeto com unidade, multiplicador e quantidade real
 */
export function parseUnidade(
  unidadeXml: string | null | undefined,
  quantidadeXml: number = 1
): UnidadeParsed {
  if (!unidadeXml) {
    return {
      unidade: '',
      multiplicador: 1,
      quantidadeReal: quantidadeXml,
      temProblema: false,
    };
  }

  const trimmed = unidadeXml.trim();

  // Regex para detectar padrão "25 KG" (número + espaço + letra)
  // Captura: (1) número com decimais opcionais, (2) unidade
  const regex = /^(\d+(?:\.\d+)?)\s*([A-Za-z%]+)$/;
  const match = trimmed.match(regex);

  if (match) {
    const multiplicador = parseFloat(match[1]);
    const unidade = match[2].toUpperCase();
    const quantidadeReal = quantidadeXml * multiplicador;

    return {
      unidade,
      multiplicador,
      quantidadeReal,
      temProblema: true, // Tinha número embutido
    };
  }

  // Se não encontrar padrão, retornar unidade como está
  return {
    unidade: trimmed.toUpperCase(),
    multiplicador: 1,
    quantidadeReal: quantidadeXml,
    temProblema: false,
  };
}

/**
 * Calcula o fator de conversão correto
 * @param unidadeOrigem - Unidade de origem (ex: "KG")
 * @param unidadeDestino - Unidade de destino (ex: "g")
 * @param multiplicadorOrigem - Multiplicador extraído (ex: 25)
 * @returns Fator de conversão
 */
export function calcularFatorConversao(
  unidadeOrigem: string,
  unidadeDestino: string,
  multiplicadorOrigem: number = 1
): number {
  const origem = unidadeOrigem.toUpperCase();
  const destino = unidadeDestino.toUpperCase();

  // Tabela de conversão padrão
  const conversoes: Record<string, number> = {
    // Peso
    'KG->G': 1000,
    'KG->MG': 1000000,
    'G->MG': 1000,
    'G->KG': 0.001,
    'MG->G': 0.001,
    'MG->KG': 0.000001,

    // Volume
    'L->ML': 1000,
    'ML->L': 0.001,

    // Unidades
    'MILHEIRO->UN': 1000,
    'UN->MILHEIRO': 0.001,
    'CAIXA->UN': 12, // Padrão, pode variar
    'UN->CAIXA': 1 / 12,

    // Sem conversão (mesma unidade)
    'KG->KG': 1,
    'G->G': 1,
    'MG->MG': 1,
    'L->L': 1,
    'ML->ML': 1,
    'UN->UN': 1,
  };

  const chave = `${origem}->${destino}`;
  const fator = conversoes[chave];

  if (fator !== undefined) {
    // Aplicar multiplicador se existir
    return fator * multiplicadorOrigem;
  }

  // Se não encontrar conversão, retornar 1 (sem conversão)
  console.warn(
    `Conversão não encontrada: ${origem} → ${destino}. Usando fator 1.`
  );
  return multiplicadorOrigem;
}

/**
 * Valida se a unidade é conhecida
 */
export function isUnidadeValida(unidade: string): boolean {
  const unidadesValidas = [
    'KG',
    'G',
    'MG',
    'L',
    'ML',
    'UN',
    'MILHEIRO',
    'CAIXA',
    'FARDO',
    'PACOTE',
    'UI_G',
    'MCG_G',
    '%',
  ];
  return unidadesValidas.includes(unidade.toUpperCase());
}

export function normalizarUnidade(unidade: string): string {
  if (canonicalizarUnidadeDose(unidade) === 'mcg') return 'MCG';

  const mapa: Record<string, string> = {
    'UNIDADE': 'UN',
    'UNIDADES': 'UN',
    'KILOGRAMO': 'KG',
    'KILOGRAMOS': 'KG',
    'GRAMA': 'G',
    'GRAMAS': 'G',
    'MILIGRAMA': 'MG',
    'MILIGRAMAS': 'MG',
    'LITRO': 'L',
    'LITROS': 'L',
    'MILILITRO': 'ML',
    'MILILITROS': 'ML',
    'CAIXA': 'CAIXA',
    'CAIXAS': 'CAIXA',
    'FARDO': 'FARDO',
    'FARDOS': 'FARDO',
    'PACOTE': 'PACOTE',
    'PACOTES': 'PACOTE',
    'MILHEIRO': 'MILHEIRO',
    'MILHAR': 'MILHEIRO',
    'MCG': 'MCG',
  };

  const upper = unidade.toUpperCase().trim();
  return mapa[upper] || upper;
}

/**
 * Exemplo de uso:
 * 
 * const resultado = parseUnidade("25 KG", 1);
 * console.log(resultado);
 * // { unidade: "KG", multiplicador: 25, quantidadeReal: 25, temProblema: true }
 * 
 * const fator = calcularFatorConversao("KG", "g", 25);
 * console.log(fator);
 * // 25000 (25 * 1000)
 */
