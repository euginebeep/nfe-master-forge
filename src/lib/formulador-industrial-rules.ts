// ============================================================
// FORMULADOR INDUSTRIAL - REGRAS DE NEGÓCIO
// PADRÃO INDUSTRIAL SEMI-AUTOMÁTICO
// VERSÃO DEFINITIVA - SEM EDIÇÃO DE PERCENTUAIS
// ============================================================

// ============================================================
// CONSTANTES INDUSTRIAIS FIXAS
// ============================================================

/**
 * PESO DE REFERÊNCIA (FALLBACK) DA CÁPSULA
 * Usado APENAS quando uma fórmula antiga não tem peso_enchimento_mg.
 * A máquina opera cápsula tamanho 0; o peso real vem sempre da fórmula
 * (medido em lab) e é validado contra o volume físico da cápsula.
 */
export const CAPSULA_PESO_NOMINAL_MG = 500; // legádo (referência 00) — só compat.
export const CAPSULA_PESO_ALVO_MG = 490;    // fallback de fórmulas antigas

/**
 * PERCENTUAIS INDUSTRIAIS FIXOS
 * Regra de encapsulamento semi-automático
 * NÃO EDITÁVEIS - PADRÃO DE MERCADO
 */
export const EXCIPIENTES_INDUSTRIAIS = {
  DIOXIDO_SILICIO: {
    nome: 'Dióxido de Silício',
    percentual: 2, // FIXO 2%
    funcao: 'Antiumectante / Deslizante',
    ordem_mistura: 5, // Próximo ao final
  },
  ESTEARATO_MAGNESIO: {
    nome: 'Estearato de Magnésio',
    percentual: 1, // FIXO 1%
    funcao: 'Lubrificante',
    ordem_mistura: 6, // SEMPRE último
  },
  TALCO: {
    nome: 'Talco Farmacêutico',
    percentual: 5, // FIXO 5%
    funcao: 'Deslizante / Carga',
    ordem_mistura: 4, // Antes de sílica e estearato
  },
} as const;

// Total fixo de excipientes tecnológicos: 8%
export const TOTAL_PERCENTUAL_TECNOLOGICOS = 
  EXCIPIENTES_INDUSTRIAIS.DIOXIDO_SILICIO.percentual +
  EXCIPIENTES_INDUSTRIAIS.ESTEARATO_MAGNESIO.percentual +
  EXCIPIENTES_INDUSTRIAIS.TALCO.percentual;

/**
 * VEÍCULOS BASE (Q.S.P.)
 * Selecionado pelo usuário, completa o peso restante
 */
export const VEICULOS_BASE = {
  AMIDO: {
    codigo: 'AMIDO',
    nome: 'Amido de Milho',
    descricao: 'Diluente tradicional, baixo custo',
  },
  CELULOSE: {
    codigo: 'CELULOSE',
    nome: 'Celulose Microcristalina',
    descricao: 'Melhor fluxo e compressibilidade',
  },
  PRE_BLEND: {
    codigo: 'PRE_BLEND',
    nome: 'Pré-blend Industrial',
    descricao: 'Mistura pronta otimizada',
  },
} as const;

export type CodigoVeiculoBase = keyof typeof VEICULOS_BASE;

// ============================================================
// CÁPSULAS — CATÁLOGO FÍSICO E VALIDAÇÃO DE VOLUME
// ============================================================

/** Volume geométrico nominal de cada cápsula (mL). */
export const CAPSULAS = {
  '000': { volume_ml: 1.37 },
  '00':  { volume_ml: 0.91 },
  '0':   { volume_ml: 0.68 },
  '1':   { volume_ml: 0.50 },
  '2':   { volume_ml: 0.37 },
} as const;
export type TamanhoCapsula = keyof typeof CAPSULAS;

/** Tamanho operado pela máquina. TROCAR AQUI se mudar de cápsula. */
export const CAPSULA_TAMANHO_PADRAO: TamanhoCapsula = '0';

/** Densidade default (kg/L) enquanto não há medição de laboratório. */
export const DENSIDADE_PADRAO_KG_L = 0.65;

/** Fator prático de aproveitamento do volume (folga de enchimento). */
export const FATOR_APROVEITAMENTO_VOLUME = 0.90;

/** Peso mínimo aceitável de enchimento (mg). */
export const CAPSULA_PESO_MIN_MG = 100;

export function volumeCapsulaMl(tamanho: TamanhoCapsula = CAPSULA_TAMANHO_PADRAO): number {
  return CAPSULAS[tamanho]?.volume_ml ?? CAPSULAS[CAPSULA_TAMANHO_PADRAO].volume_ml;
}

/** Capacidade da cápsula em massa, dada a densidade do blend. */
export function calcularCapacidadeCapsula(
  densidade_kg_l: number,
  tamanho: TamanhoCapsula = CAPSULA_TAMANHO_PADRAO,
) {
  const vol = volumeCapsulaMl(tamanho);
  const dens = (!densidade_kg_l || densidade_kg_l <= 0) ? DENSIDADE_PADRAO_KG_L : densidade_kg_l;
  const tetoFisicoMg = vol * dens * 1000;                              // limite absoluto
  const recomendadoMaxMg = tetoFisicoMg * FATOR_APROVEITAMENTO_VOLUME; // faixa segura
  return {
    tamanho,
    volume_ml: vol,
    densidade: dens,
    teto_fisico_mg: +tetoFisicoMg.toFixed(1),
    recomendado_max_mg: +recomendadoMaxMg.toFixed(1),
  };
}

/** Peso alvo sugerido — sempre fisicamente válido para a densidade informada. */
export function sugerirPesoAlvoMg(
  densidade_kg_l: number,
  tamanho: TamanhoCapsula = CAPSULA_TAMANHO_PADRAO,
): number {
  const cap = calcularCapacidadeCapsula(densidade_kg_l, tamanho);
  return Math.floor(cap.recomendado_max_mg / 10) * 10;
}

export interface ValidacaoPesoAlvo {
  ok: boolean;
  nivel: 'ok' | 'warning' | 'error';
  mensagem: string;
  volume_necessario_ml: number;
  volume_ml: number;
  teto_fisico_mg: number;
  recomendado_max_mg: number;
  tamanho: TamanhoCapsula;
}

/** Valida se o peso alvo cabe fisicamente na cápsula, dada a densidade. */
export function validarPesoAlvoFisico(
  pesoAlvoMg: number,
  densidade_kg_l: number,
  tamanho: TamanhoCapsula = CAPSULA_TAMANHO_PADRAO,
): ValidacaoPesoAlvo {
  const cap = calcularCapacidadeCapsula(densidade_kg_l, tamanho);
  const volNecessarioMl = (pesoAlvoMg / 1000) / cap.densidade;
  const base = {
    volume_necessario_ml: +volNecessarioMl.toFixed(3),
    volume_ml: cap.volume_ml,
    teto_fisico_mg: cap.teto_fisico_mg,
    recomendado_max_mg: cap.recomendado_max_mg,
    tamanho: cap.tamanho,
  };

  if (!pesoAlvoMg || pesoAlvoMg < CAPSULA_PESO_MIN_MG) {
    return { ok: false, nivel: 'error',
      mensagem: `Peso alvo muito baixo (mín. ${CAPSULA_PESO_MIN_MG} mg).`, ...base };
  }
  if (pesoAlvoMg > cap.teto_fisico_mg) {
    return { ok: false, nivel: 'error',
      mensagem: `Não cabe na cápsula ${cap.tamanho}: ${pesoAlvoMg} mg exigem ${volNecessarioMl.toFixed(2)} mL, `
        + `mas o volume é ${cap.volume_ml} mL (teto ${cap.teto_fisico_mg} mg nesta densidade). `
        + `Reduza o alvo, aumente a densidade medida do blend, ou use pré-mix.`, ...base };
  }
  if (pesoAlvoMg > cap.recomendado_max_mg) {
    return { ok: true, nivel: 'warning',
      mensagem: `No limite da cápsula ${cap.tamanho} (recomendado até ${cap.recomendado_max_mg} mg). `
        + `Confirme a densidade real medida em laboratório antes de aprovar.`, ...base };
  }
  return { ok: true, nivel: 'ok', mensagem: '', ...base };
}

// ============================================================
// INTERFACES DE CÁLCULO
// ============================================================

export interface ExcipienteTecnologicoCalculado {
  nome: string;
  percentual: number;
  quantidade_mg: number;
  funcao: string;
  ordem_mistura: number;
}

export interface CalculoCapsulaIndustrial {
  // Configuração
  peso_nominal_mg: number;
  peso_alvo_mg: number;
  
  // Ativos
  total_ativos_mg: number;
  percentual_ativos: number;
  
  // Excipientes Tecnológicos (FIXOS)
  excipientes_tecnologicos: ExcipienteTecnologicoCalculado[];
  total_excipientes_tecnologicos_mg: number;
  percentual_excipientes_tecnologicos: number;
  
  // Veículo Base (Q.S.P.)
  veiculo_base_codigo: CodigoVeiculoBase;
  veiculo_base_nome: string;
  veiculo_base_mg: number;
  percentual_veiculo_base: number;
  
  // Totais
  peso_total_calculado_mg: number;
  ocupacao_percentual: number;
  
  // Validações
  excedeu_capacidade: boolean;
  qsp_negativo: boolean;
  formula_valida: boolean;
}

// ============================================================
// FUNÇÕES DE CÁLCULO - MODELO INDUSTRIAL
// ============================================================

/**
 * Calcula os excipientes tecnológicos com percentuais FIXOS
 * REGRA INDUSTRIAL: Sempre aplicados em cápsulas
 */
export function calcularExcipientesTecnologicos(pesoAlvoMg: number): ExcipienteTecnologicoCalculado[] {
  return [
    {
      nome: EXCIPIENTES_INDUSTRIAIS.DIOXIDO_SILICIO.nome,
      percentual: EXCIPIENTES_INDUSTRIAIS.DIOXIDO_SILICIO.percentual,
      quantidade_mg: (pesoAlvoMg * EXCIPIENTES_INDUSTRIAIS.DIOXIDO_SILICIO.percentual) / 100,
      funcao: EXCIPIENTES_INDUSTRIAIS.DIOXIDO_SILICIO.funcao,
      ordem_mistura: EXCIPIENTES_INDUSTRIAIS.DIOXIDO_SILICIO.ordem_mistura,
    },
    {
      nome: EXCIPIENTES_INDUSTRIAIS.ESTEARATO_MAGNESIO.nome,
      percentual: EXCIPIENTES_INDUSTRIAIS.ESTEARATO_MAGNESIO.percentual,
      quantidade_mg: (pesoAlvoMg * EXCIPIENTES_INDUSTRIAIS.ESTEARATO_MAGNESIO.percentual) / 100,
      funcao: EXCIPIENTES_INDUSTRIAIS.ESTEARATO_MAGNESIO.funcao,
      ordem_mistura: EXCIPIENTES_INDUSTRIAIS.ESTEARATO_MAGNESIO.ordem_mistura,
    },
    {
      nome: EXCIPIENTES_INDUSTRIAIS.TALCO.nome,
      percentual: EXCIPIENTES_INDUSTRIAIS.TALCO.percentual,
      quantidade_mg: (pesoAlvoMg * EXCIPIENTES_INDUSTRIAIS.TALCO.percentual) / 100,
      funcao: EXCIPIENTES_INDUSTRIAIS.TALCO.funcao,
      ordem_mistura: EXCIPIENTES_INDUSTRIAIS.TALCO.ordem_mistura,
    },
  ];
}

/**
 * Calcula o veículo base (Q.S.P.)
 * FÓRMULA: peso_alvo - ativos - excipientes_tecnologicos
 */
export function calcularVeiculoBase(
  pesoAlvoMg: number,
  totalAtivosMg: number,
  totalExcipientesTecnologicosMg: number
): number {
  const qsp = pesoAlvoMg - totalAtivosMg - totalExcipientesTecnologicosMg;
  return Math.max(0, parseFloat(qsp.toFixed(4)));
}

/**
 * Realiza o cálculo completo da cápsula seguindo modelo industrial
 * REGRA FIXA: Silício 2% + Estearato 1% + Talco 5%
 */
export function calcularCapsulaIndustrial(
  totalAtivosMg: number,
  veiculoBaseCodigo: CodigoVeiculoBase = 'AMIDO',
  pesoAlvoMg: number = CAPSULA_PESO_ALVO_MG
): CalculoCapsulaIndustrial {
  // Calcular excipientes tecnológicos (FIXOS)
  const excipientesTec = calcularExcipientesTecnologicos(pesoAlvoMg);
  const totalExcipientesMg = excipientesTec.reduce((sum, e) => sum + e.quantidade_mg, 0);
  
  // Calcular veículo base (Q.S.P.)
  const veiculoBaseMg = calcularVeiculoBase(pesoAlvoMg, totalAtivosMg, totalExcipientesMg);
  
  // Peso total real
  const pesoTotal = totalAtivosMg + totalExcipientesMg + veiculoBaseMg;
  
  // Validações
  const excedeuCapacidade = (totalAtivosMg + totalExcipientesMg) > pesoAlvoMg;
  const qspNegativo = veiculoBaseMg <= 0;
  
  // Info do veículo
  const veiculoInfo = VEICULOS_BASE[veiculoBaseCodigo] || VEICULOS_BASE.AMIDO;
  
  return {
    peso_nominal_mg: CAPSULA_PESO_NOMINAL_MG,
    peso_alvo_mg: pesoAlvoMg,
    
    total_ativos_mg: parseFloat(totalAtivosMg.toFixed(4)),
    percentual_ativos: parseFloat(((totalAtivosMg / pesoAlvoMg) * 100).toFixed(2)),
    
    excipientes_tecnologicos: excipientesTec,
    total_excipientes_tecnologicos_mg: parseFloat(totalExcipientesMg.toFixed(4)),
    percentual_excipientes_tecnologicos: TOTAL_PERCENTUAL_TECNOLOGICOS,
    
    veiculo_base_codigo: veiculoBaseCodigo,
    veiculo_base_nome: veiculoInfo.nome,
    veiculo_base_mg: veiculoBaseMg,
    percentual_veiculo_base: parseFloat(((veiculoBaseMg / pesoAlvoMg) * 100).toFixed(2)),
    
    peso_total_calculado_mg: parseFloat(pesoTotal.toFixed(4)),
    ocupacao_percentual: parseFloat(((totalAtivosMg / pesoAlvoMg) * 100).toFixed(2)),
    
    excedeu_capacidade: excedeuCapacidade,
    qsp_negativo: qspNegativo,
    formula_valida: !excedeuCapacidade && !qspNegativo,
  };
}

// ============================================================
// REGRAS DE ATIVOS CRÍTICOS
// ============================================================

/**
 * Determina se um ativo é CRÍTICO
 * FLAG AUTOMÁTICA - Não editável
 * 
 * REGRA: Ativo < 1 mg OU unidade original UI/MCG
 */
export function isAtivoCritico(
  quantidadeConvertidaMg: number,
  unidadeOriginal: 'MG' | 'MCG' | 'UI' | 'G' | 'ML'
): boolean {
  // Ativo < 1 mg é sempre crítico
  if (quantidadeConvertidaMg < 1) return true;
  
  // Unidades de alta precisão são críticas
  if (unidadeOriginal === 'UI' || unidadeOriginal === 'MCG') return true;
  
  return false;
}

/**
 * Verifica se um ativo SUGERE pré-mix
 * APENAS SUGESTÃO - Checkbox permanece DESMARCADO
 * 
 * CONDIÇÕES:
 * - Quantidade < 1 mg
 * - Unidade = mcg ou UI
 * - Higroscópico (quando informado)
 */
export function verificarSugestaoPremix(
  quantidadeConvertidaMg: number,
  unidadeOriginal: 'MG' | 'MCG' | 'UI' | 'G' | 'ML',
  higroscopico: boolean = false
): { sugerido: boolean; motivo: string } {
  const motivos: string[] = [];
  
  if (quantidadeConvertidaMg < 1) {
    motivos.push('Quantidade < 1 mg');
  }
  
  if (unidadeOriginal === 'MCG' || unidadeOriginal === 'UI') {
    motivos.push(`Unidade ${unidadeOriginal}`);
  }
  
  if (higroscopico) {
    motivos.push('Higroscópico');
  }
  
  return {
    sugerido: motivos.length > 0,
    motivo: motivos.join(', '),
  };
}

// ============================================================
// CONVERSÕES DE UNIDADES
// ============================================================

/**
 * Converte mcg para mg
 */
export function converterMCGparaMG(valorMCG: number): number {
  return valorMCG / 1000;
}

/**
 * Converte UI para mg usando fator
 */
export function converterUIparaMG(valorUI: number, fatorUIPorMG: number): number {
  if (fatorUIPorMG <= 0) return 0;
  return valorUI * fatorUIPorMG;
}

/**
 * Converte g para mg
 */
export function converterGparaMG(valorG: number): number {
  return valorG * 1000;
}

// ============================================================
// ALERTAS DA FÓRMULA
// ============================================================

export interface AlertaFormula {
  tipo: 'info' | 'warning' | 'error';
  codigo: string;
  mensagem: string;
}

/**
 * Gera alertas informativos para a fórmula
 * ALERTAS são informativos, NÃO impositivos
 */
export function gerarAlertasFormula(
  calculos: CalculoCapsulaIndustrial,
  quantidadeAtivosCriticos: number,
  quantidadeComSugestaoPremix: number
): AlertaFormula[] {
  const alertas: AlertaFormula[] = [];
  
  // Erro: capacidade excedida
  if (calculos.excedeu_capacidade) {
    alertas.push({
      tipo: 'error',
      codigo: 'CAPACIDADE_EXCEDIDA',
      mensagem: `Peso dos ativos + excipientes excede ${calculos.peso_alvo_mg} mg`,
    });
  }
  
  // Erro: Q.S.P. negativo
  if (calculos.qsp_negativo) {
    alertas.push({
      tipo: 'error',
      codigo: 'QSP_NEGATIVO',
      mensagem: 'Não há espaço para o veículo base. Reduza os ativos.',
    });
  }
  
  // Aviso: ativos críticos
  if (quantidadeAtivosCriticos > 0) {
    alertas.push({
      tipo: 'warning',
      codigo: 'ATIVOS_CRITICOS',
      mensagem: `${quantidadeAtivosCriticos} ativo(s) crítico(s) - dupla conferência recomendada`,
    });
  }
  
  // Info: sugestão de pré-mix
  if (quantidadeComSugestaoPremix > 0) {
    alertas.push({
      tipo: 'info',
      codigo: 'SUGESTAO_PREMIX',
      mensagem: `${quantidadeComSugestaoPremix} ativo(s) com sugestão de pré-mix`,
    });
  }
  
  // Info: baixa ocupação
  if (calculos.ocupacao_percentual < 20 && calculos.total_ativos_mg > 0) {
    alertas.push({
      tipo: 'info',
      codigo: 'BAIXA_OCUPACAO',
      mensagem: `Baixa ocupação (${calculos.ocupacao_percentual}%). Muito veículo base.`,
    });
  }
  
  return alertas;
}

// ============================================================
// ORDEM DE MISTURA INDUSTRIAL
// ============================================================

/**
 * Ordem correta de mistura para encapsulamento
 * 1. Diluições / Pré-mix
 * 2. Ativos
 * 3. Veículo Base
 * 4. Talco
 * 5. Dióxido de Silício
 * 6. Estearato de Magnésio (SEMPRE último)
 */
export interface ItemOrdemMistura {
  ordem: number;
  categoria: 'PREMIX' | 'ATIVO' | 'VEICULO_BASE' | 'TECNOLOGICO';
  nome: string;
  quantidade_mg: number;
  observacao?: string;
}

export function gerarOrdemMistura(
  ativos: Array<{ nome: string; quantidade_mg: number; exige_premix: boolean; ativo_critico: boolean }>,
  veiculoBaseCodigo: CodigoVeiculoBase,
  veiculoBaseMg: number,
  excipientesTec: ExcipienteTecnologicoCalculado[]
): ItemOrdemMistura[] {
  const ordem: ItemOrdemMistura[] = [];
  let seq = 1;
  
  // 1. Pré-mix (se houver)
  const comPremix = ativos.filter(a => a.exige_premix);
  comPremix.forEach(a => {
    ordem.push({
      ordem: seq++,
      categoria: 'PREMIX',
      nome: `Pré-mix: ${a.nome}`,
      quantidade_mg: a.quantidade_mg,
      observacao: a.ativo_critico ? 'ATIVO CRÍTICO - Dupla conferência' : undefined,
    });
  });
  
  // 2. Ativos (sem pré-mix)
  const semPremix = ativos.filter(a => !a.exige_premix);
  semPremix.forEach(a => {
    ordem.push({
      ordem: seq++,
      categoria: 'ATIVO',
      nome: a.nome,
      quantidade_mg: a.quantidade_mg,
      observacao: a.ativo_critico ? 'ATIVO CRÍTICO - Dupla conferência' : undefined,
    });
  });
  
  // 3. Veículo Base
  const veiculoInfo = VEICULOS_BASE[veiculoBaseCodigo] || VEICULOS_BASE.AMIDO;
  ordem.push({
    ordem: seq++,
    categoria: 'VEICULO_BASE',
    nome: veiculoInfo.nome,
    quantidade_mg: veiculoBaseMg,
    observacao: 'Q.S.P.',
  });
  
  // 4-6. Excipientes Tecnológicos (na ordem correta)
  const tecOrdenados = [...excipientesTec].sort((a, b) => a.ordem_mistura - b.ordem_mistura);
  tecOrdenados.forEach(exc => {
    ordem.push({
      ordem: seq++,
      categoria: 'TECNOLOGICO',
      nome: exc.nome,
      quantidade_mg: exc.quantidade_mg,
      observacao: exc.funcao,
    });
  });
  
  return ordem;
}

// ============================================================
// DADOS PARA OP INDUSTRIAL
// ============================================================

export interface DadosOPIndustrial {
  formula_codigo: string;
  formula_nome: string;
  tipo_apresentacao: string;
  
  // Composição
  ativos: Array<{
    nome: string;
    quantidade_mg: number;
    ativo_critico: boolean;
    exige_premix: boolean;
  }>;
  
  // Excipientes
  excipientes_tecnologicos: ExcipienteTecnologicoCalculado[];
  veiculo_base: {
    codigo: string;
    nome: string;
    quantidade_mg: number;
  };
  
  // Totais
  peso_capsula_mg: number;
  percentual_ocupacao: number;
  
  // Ordem de mistura
  ordem_mistura: ItemOrdemMistura[];
  
  // Alertas
  ativos_criticos: string[];
  sugestoes_premix: string[];
}

export function gerarDadosOP(
  formulaCodigo: string,
  formulaNome: string,
  tipoApresentacao: string,
  ativos: Array<{ nome: string; quantidade_mg: number; ativo_critico: boolean; exige_premix: boolean }>,
  calculos: CalculoCapsulaIndustrial
): DadosOPIndustrial {
  const ordemMistura = gerarOrdemMistura(
    ativos,
    calculos.veiculo_base_codigo,
    calculos.veiculo_base_mg,
    calculos.excipientes_tecnologicos
  );
  
  return {
    formula_codigo: formulaCodigo,
    formula_nome: formulaNome,
    tipo_apresentacao: tipoApresentacao,
    
    ativos,
    
    excipientes_tecnologicos: calculos.excipientes_tecnologicos,
    veiculo_base: {
      codigo: calculos.veiculo_base_codigo,
      nome: calculos.veiculo_base_nome,
      quantidade_mg: calculos.veiculo_base_mg,
    },
    
    peso_capsula_mg: calculos.peso_alvo_mg,
    percentual_ocupacao: calculos.ocupacao_percentual,
    
    ordem_mistura: ordemMistura,
    
    ativos_criticos: ativos.filter(a => a.ativo_critico).map(a => a.nome),
    sugestoes_premix: ativos.filter(a => !a.exige_premix && a.ativo_critico).map(a => a.nome),
  };
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Obtém o nome do veículo base pelo código
 */
export function getNomeVeiculoBase(codigo: string): string {
  const veiculo = VEICULOS_BASE[codigo as CodigoVeiculoBase];
  return veiculo?.nome || codigo;
}

/**
 * Lista de veículos base para select
 */
export function getListaVeiculosBase(): Array<{ codigo: string; nome: string; descricao: string }> {
  return Object.values(VEICULOS_BASE);
}
