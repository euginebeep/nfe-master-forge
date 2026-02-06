// ============================================================
// FORMULADOR INDUSTRIAL - REGRAS DE NEGÓCIO
// Boas práticas de mercado para encapsulamento semi-automático
// ============================================================

// ============================================================
// GRUPO A - EXCIPIENTES TECNOLÓGICOS (AUTOMÁTICO)
// ============================================================

export interface ExcipienteTecnologico {
  nome: string;
  percentual_min: number;
  percentual_max: number;
  percentual_padrao: number;
  obrigatorio: boolean;
}

// Configuração padrão dos excipientes tecnológicos
// Estes valores podem ser editados pelo administrador do sistema futuramente
export const EXCIPIENTES_TECNOLOGICOS: ExcipienteTecnologico[] = [
  {
    nome: 'Dióxido de Silício',
    percentual_min: 1,
    percentual_max: 2,
    percentual_padrao: 1.5,
    obrigatorio: true,
  },
  {
    nome: 'Estearato de Magnésio',
    percentual_min: 0.5,
    percentual_max: 1,
    percentual_padrao: 0.75,
    obrigatorio: true,
  },
  {
    nome: 'Talco',
    percentual_min: 1,
    percentual_max: 3,
    percentual_padrao: 2,
    obrigatorio: true, // Padrão industrial
  },
];

// ============================================================
// INTERFACES DE CÁLCULO
// ============================================================

export interface ExcipienteCalculado {
  nome: string;
  percentual: number;
  quantidade_mg: number;
}

export interface CalculoCapsulaIndustrial {
  peso_alvo_mg: number;
  total_ativos_mg: number;
  excipientes_tecnologicos: ExcipienteCalculado[];
  total_excipientes_tecnologicos_mg: number;
  diluente_principal_nome: string;
  diluente_principal_mg: number;
  peso_total_calculado_mg: number;
  ocupacao_percentual: number;
  excedeu_capacidade: boolean;
}

export interface SugestaoPremix {
  insumo: string;
  motivo: string;
  recomendado: boolean;
}

// ============================================================
// FUNÇÕES DE CÁLCULO - MODELO INDUSTRIAL
// ============================================================

/**
 * Calcula os excipientes tecnológicos baseado no peso alvo
 * GRUPO A - Sempre incluídos automaticamente
 */
export function calcularExcipientesTecnologicos(
  pesoAlvoMg: number,
  percentuaisPersonalizados?: Record<string, number>
): ExcipienteCalculado[] {
  return EXCIPIENTES_TECNOLOGICOS.filter(e => e.obrigatorio).map(exc => {
    // Usar percentual personalizado se fornecido, senão usar padrão
    const percentual = percentuaisPersonalizados?.[exc.nome] ?? exc.percentual_padrao;
    const quantidade_mg = (pesoAlvoMg * percentual) / 100;
    
    return {
      nome: exc.nome,
      percentual,
      quantidade_mg: parseFloat(quantidade_mg.toFixed(4)),
    };
  });
}

/**
 * Calcula o diluente principal (Q.S.P.) considerando excipientes tecnológicos
 * GRUPO B - Completa o peso restante
 * 
 * REGRA INDUSTRIAL CORRETA:
 * peso_diluente = peso_alvo - soma_ativos - soma_excipientes_tecnologicos
 */
export function calcularDiluentePrincipal(
  pesoAlvoMg: number,
  totalAtivosMg: number,
  totalExcipientesTecnologicosMg: number
): number {
  const diluente = pesoAlvoMg - totalAtivosMg - totalExcipientesTecnologicosMg;
  return Math.max(0, parseFloat(diluente.toFixed(4)));
}

/**
 * Realiza o cálculo completo da cápsula seguindo modelo industrial
 */
export function calcularCapsulaIndustrial(
  pesoAlvoMg: number,
  totalAtivosMg: number,
  diluenteNome: string,
  percentuaisExcipientes?: Record<string, number>
): CalculoCapsulaIndustrial {
  // Calcular excipientes tecnológicos (Grupo A)
  const excipientes = calcularExcipientesTecnologicos(pesoAlvoMg, percentuaisExcipientes);
  const totalExcipientes = excipientes.reduce((sum, e) => sum + e.quantidade_mg, 0);
  
  // Calcular diluente principal (Grupo B - Q.S.P.)
  const diluenteMg = calcularDiluentePrincipal(pesoAlvoMg, totalAtivosMg, totalExcipientes);
  
  // Peso total real
  const pesoTotal = totalAtivosMg + totalExcipientes + diluenteMg;
  
  // Ocupação (apenas ativos, sem excipientes)
  const ocupacao = (totalAtivosMg / pesoAlvoMg) * 100;
  
  return {
    peso_alvo_mg: pesoAlvoMg,
    total_ativos_mg: parseFloat(totalAtivosMg.toFixed(4)),
    excipientes_tecnologicos: excipientes,
    total_excipientes_tecnologicos_mg: parseFloat(totalExcipientes.toFixed(4)),
    diluente_principal_nome: diluenteNome,
    diluente_principal_mg: diluenteMg,
    peso_total_calculado_mg: parseFloat(pesoTotal.toFixed(4)),
    ocupacao_percentual: parseFloat(ocupacao.toFixed(2)),
    excedeu_capacidade: totalAtivosMg + totalExcipientes > pesoAlvoMg,
  };
}

// ============================================================
// REGRAS DE PRÉ-MIX (CORREÇÃO CRÍTICA)
// ============================================================

/**
 * Verifica se um ativo SUGERE pré-mix (NÃO obrigatório)
 * 
 * CONDIÇÕES PARA SUGESTÃO:
 * - Quantidade convertida < 1 mg
 * - Unidade original = mcg ou UI
 * - Ativo marcado como higroscópico
 * 
 * IMPORTANTE: Retorna apenas sugestão, checkbox deve permanecer DESMARCADO
 */
export function verificarSugestaoPremix(
  quantidadeConvertidaMg: number,
  unidadeOriginal: 'MG' | 'MCG' | 'UI',
  higroscopico: boolean = false
): SugestaoPremix {
  const motivos: string[] = [];
  
  // Condição 1: Quantidade muito baixa
  if (quantidadeConvertidaMg < 1) {
    motivos.push('Quantidade < 1 mg (pesagem crítica)');
  }
  
  // Condição 2: Unidade de alta precisão
  if (unidadeOriginal === 'MCG' || unidadeOriginal === 'UI') {
    motivos.push(`Unidade ${unidadeOriginal} requer alta precisão`);
  }
  
  // Condição 3: Higroscópico
  if (higroscopico) {
    motivos.push('Ativo higroscópico');
  }
  
  return {
    insumo: '',
    motivo: motivos.join('; '),
    recomendado: motivos.length > 0,
  };
}

/**
 * Determina se um ativo é CRÍTICO (automático, não editável)
 * Mantido conforme especificação original
 */
export function isAtivoCriticoIndustrial(
  quantidadeConvertidaMg: number,
  unidadeOriginal: 'MG' | 'MCG' | 'UI'
): boolean {
  // Ativo < 1 mg é sempre crítico
  if (quantidadeConvertidaMg < 1) return true;
  
  // Unidades de alta precisão são críticas
  if (unidadeOriginal === 'UI' || unidadeOriginal === 'MCG') return true;
  
  return false;
}

// ============================================================
// ALERTAS E VALIDAÇÕES (INFORMATIVOS)
// ============================================================

export interface AlertaFormula {
  tipo: 'info' | 'warning' | 'error';
  mensagem: string;
  campo?: string;
}

/**
 * Gera alertas informativos (não impositivos) para a fórmula
 */
export function gerarAlertasFormula(
  calculos: CalculoCapsulaIndustrial,
  ativosCriticos: number,
  ativosComSugestaoPremix: number
): AlertaFormula[] {
  const alertas: AlertaFormula[] = [];
  
  // Alerta de capacidade excedida (erro)
  if (calculos.excedeu_capacidade) {
    alertas.push({
      tipo: 'error',
      mensagem: `Peso dos ativos + excipientes excede a capacidade da cápsula (${calculos.peso_alvo_mg} mg)`,
    });
  }
  
  // Alerta de diluente negativo ou zero (erro)
  if (calculos.diluente_principal_mg <= 0) {
    alertas.push({
      tipo: 'error',
      mensagem: 'Não há espaço para o diluente principal. Reduza os ativos ou use cápsula maior.',
    });
  }
  
  // Alerta de ativos críticos (informativo)
  if (ativosCriticos > 0) {
    alertas.push({
      tipo: 'warning',
      mensagem: `${ativosCriticos} ativo(s) crítico(s) - considere dupla conferência na pesagem`,
    });
  }
  
  // Alerta de sugestão de pré-mix (informativo)
  if (ativosComSugestaoPremix > 0) {
    alertas.push({
      tipo: 'info',
      mensagem: `${ativosComSugestaoPremix} ativo(s) com sugestão de pré-mix`,
    });
  }
  
  // Alerta de ocupação baixa (informativo)
  if (calculos.ocupacao_percentual < 20 && calculos.total_ativos_mg > 0) {
    alertas.push({
      tipo: 'info',
      mensagem: `Baixa ocupação de ativos (${calculos.ocupacao_percentual.toFixed(1)}%). Fórmula com muito diluente.`,
    });
  }
  
  return alertas;
}

// ============================================================
// MAPA DE DILUENTES (GRUPO B)
// ============================================================

export const DILUENTES_PRINCIPAIS: Record<string, string> = {
  'AMIDO': 'Amido de Milho',
  'CELULOSE': 'Celulose Microcristalina',
  'PRE_BLEND': 'Pré-blend Industrial',
};

/**
 * Obtém o nome completo do diluente
 */
export function getNomeDiluente(codigo: string): string {
  return DILUENTES_PRINCIPAIS[codigo] || codigo;
}

// ============================================================
// DADOS PARA OP (FUTURA)
// ============================================================

export interface DadosFormulaParaOP {
  excipientes_tecnologicos: ExcipienteCalculado[];
  diluente_principal: {
    nome: string;
    quantidade_mg: number;
  };
  ativos_com_sugestao_premix: string[];
  ativos_criticos: string[];
  peso_total_mg: number;
}

/**
 * Gera os dados da fórmula para uso futuro na OP
 */
export function gerarDadosParaOP(
  calculos: CalculoCapsulaIndustrial,
  ativosCriticos: string[],
  ativosComSugestaoPremix: string[]
): DadosFormulaParaOP {
  return {
    excipientes_tecnologicos: calculos.excipientes_tecnologicos,
    diluente_principal: {
      nome: calculos.diluente_principal_nome,
      quantidade_mg: calculos.diluente_principal_mg,
    },
    ativos_com_sugestao_premix: ativosComSugestaoPremix,
    ativos_criticos: ativosCriticos,
    peso_total_mg: calculos.peso_total_calculado_mg,
  };
}
