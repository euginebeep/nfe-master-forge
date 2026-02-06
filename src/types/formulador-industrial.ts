// ============================================================
// FORMULADOR INDUSTRIAL - TIPOS E INTERFACES
// Sistema profissional de formulação de suplementos
// ============================================================

// Enums
export type TipoApresentacao = 'CAPSULA' | 'LIQUIDO' | 'PO';
export type StatusFormula = 'RASCUNHO' | 'APROVADA' | 'BLOQUEADA';
export type TipoExcipiente = 'AMIDO' | 'CELULOSE' | 'PRE_BLEND';
export type UnidadeInformada = 'MG' | 'MCG' | 'UI';

// Interface para conversões de unidades
export interface ConversaoUnidade {
  id: string;
  substancia: string;
  fator_ui_para_mg: number;
  fonte_tecnica?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// Interface para item da fórmula
export interface FormulaItem {
  id: string;
  formula_id: string;
  produto_materia_prima_id?: string;
  nome_insumo: string;
  quantidade_informada: number;
  unidade_informada: UnidadeInformada;
  quantidade_convertida_mg: number;
  ativo_critico: boolean;
  exige_premix: boolean;
  ordem_mistura: number;
  percentual_na_capsula?: number;
  created_at?: string;
}

// Interface principal da fórmula
export interface Formula {
  id: string;
  codigo_formula: string;
  nome_formula: string;
  produto_acabado_id?: string;
  
  // Tipo de apresentação
  tipo_apresentacao: TipoApresentacao;
  
  // Campos CÁPSULA
  peso_capsula_alvo_mg?: number;
  peso_capsula_nominal_mg?: number;
  tipo_capsula?: string;
  excipiente_padrao?: TipoExcipiente;
  
  // Campos LÍQUIDO
  volume_frasco_ml?: number;
  volume_por_dose_ml?: number;
  gotas_por_ml?: number;
  doses_por_frasco?: number;
  gotas_por_dose?: number;
  
  // Campos PÓ
  peso_por_dose_g?: number;
  doses_por_pote?: number;
  peso_total_pote_g?: number;
  
  // Metadados
  densidade_media?: number;
  versao: number;
  status: StatusFormula;
  observacoes_tecnicas?: string;
  
  // Auditoria
  criado_por?: string;
  aprovado_por?: string;
  criado_em?: string;
  aprovado_em?: string;
  updated_at?: string;
  
  // Itens (carregados separadamente)
  itens?: FormulaItem[];
}

// Tabela nutricional
export interface TabelaNutricional {
  id: string;
  formula_id: string;
  porcao: number;
  porcao_unidade: string;
  tabela_json_padrao_anvisa: NutrienteANVISA[];
  data_geracao?: string;
}

export interface NutrienteANVISA {
  nutriente: string;
  quantidade_por_porcao: string;
  vd_percentual: string;
}

// Alegações ANVISA
export interface AlegacaoANVISA {
  id: string;
  formula_id: string;
  texto_alegacao: string;
  fonte_anvisa?: string;
  permitido: boolean;
  created_at?: string;
}

// OP gerada
export interface OrdemProducaoGerada {
  id: string;
  formula_id: string;
  op_codigo: string;
  tipo_documento: string;
  data_geracao?: string;
  dados_op: Record<string, unknown>;
}

// Versão da fórmula (histórico)
export interface FormulaVersao {
  id: string;
  formula_id: string;
  versao: number;
  snapshot_json: Record<string, unknown>;
  alterado_por?: string;
  alterado_em?: string;
  motivo_alteracao?: string;
}

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

// Gera código único de fórmula
export function gerarCodigoFormula(sequencia: number): string {
  const ano = new Date().getFullYear();
  return `FRM-${ano}-${String(sequencia).padStart(4, '0')}`;
}

// Converte UI para MG usando fator
export function converterUIparaMG(valorUI: number, fatorUIPorMG: number): number {
  if (fatorUIPorMG <= 0) return 0;
  return valorUI * fatorUIPorMG;
}

// Converte MCG para MG
export function converterMCGparaMG(valorMCG: number): number {
  return valorMCG / 1000;
}

// Determina se é ativo crítico (FLAG AUTOMÁTICA)
// REGRA: Ativo < 1 mg OU unidade original UI/MCG
export function isAtivoCritico(
  quantidadeConvertidaMG: number,
  unidadeOriginal: UnidadeInformada
): boolean {
  // Ativo < 1 mg é sempre crítico
  if (quantidadeConvertidaMG < 1) return true;
  // Unidades de alta precisão são críticas
  if (unidadeOriginal === 'UI' || unidadeOriginal === 'MCG') return true;
  return false;
}

// Verifica se PRÉ-MIX é SUGERIDO (não obrigatório)
// IMPORTANTE: Retorna apenas sugestão, checkbox deve permanecer DESMARCADO por padrão
export function sugerePremix(
  quantidadeConvertidaMG: number,
  unidadeOriginal: UnidadeInformada,
  higroscopico: boolean = false
): { sugerido: boolean; motivo: string } {
  const motivos: string[] = [];
  
  if (quantidadeConvertidaMG < 1) {
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

// Calcula QSP INDUSTRIAL (diluente principal considerando excipientes tecnológicos)
// REGRA INDUSTRIAL CORRETA:
// peso_diluente = peso_alvo - soma_ativos - soma_excipientes_tecnologicos
export function calcularQSP(
  pesoAlvoMG: number,
  totalAtivosMG: number,
  totalExcipientesTecnologicosMG: number = 0
): number {
  const qsp = pesoAlvoMG - totalAtivosMG - totalExcipientesTecnologicosMG;
  return Math.max(0, parseFloat(qsp.toFixed(4)));
}

// Calcula QSP legado (sem excipientes tecnológicos) - mantido para compatibilidade
export function calcularQSPSimples(
  pesoAlvoMG: number,
  totalAtivosMG: number
): number {
  const qsp = pesoAlvoMG - totalAtivosMG;
  return Math.max(0, qsp);
}

// Calcula percentual na cápsula
export function calcularPercentual(
  quantidadeMG: number,
  pesoTotalMG: number
): number {
  if (pesoTotalMG <= 0) return 0;
  return (quantidadeMG / pesoTotalMG) * 100;
}

// Formata quantidade para exibição
export function formatarQuantidade(
  valor: number,
  unidade: UnidadeInformada
): string {
  switch (unidade) {
    case 'UI':
      return `${valor.toLocaleString('pt-BR')} UI`;
    case 'MCG':
      return `${valor.toLocaleString('pt-BR')} mcg`;
    case 'MG':
    default:
      return `${valor.toLocaleString('pt-BR')} mg`;
  }
}

// Validações
export interface ValidacaoFormula {
  valido: boolean;
  erros: string[];
  alertas: string[];
}

export function validarFormula(
  formula: Partial<Formula>,
  itens: FormulaItem[],
  conversoes: ConversaoUnidade[]
): ValidacaoFormula {
  const erros: string[] = [];
  const alertas: string[] = [];
  
  // Validações obrigatórias
  if (!formula.nome_formula?.trim()) {
    erros.push('Nome da fórmula é obrigatório');
  }
  
  if (!formula.tipo_apresentacao) {
    erros.push('Tipo de apresentação é obrigatório');
  }
  
  if (itens.length === 0) {
    erros.push('A fórmula deve ter pelo menos um ativo');
  }
  
  // Validar conversões de UI
  for (const item of itens) {
    if (item.unidade_informada === 'UI') {
      const conversao = conversoes.find(c => 
        c.substancia.toLowerCase().includes(item.nome_insumo.toLowerCase()) ||
        item.nome_insumo.toLowerCase().includes(c.substancia.toLowerCase())
      );
      if (!conversao) {
        erros.push(`Fator de conversão UI→mg não encontrado para: ${item.nome_insumo}`);
      }
    }
  }
  
  // Validações de cápsula
  if (formula.tipo_apresentacao === 'CAPSULA') {
    const pesoAlvo = formula.peso_capsula_alvo_mg || 490;
    const totalAtivos = itens.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
    
    if (totalAtivos > pesoAlvo) {
      erros.push(`Peso dos ativos (${totalAtivos.toFixed(2)} mg) excede a capacidade da cápsula (${pesoAlvo} mg)`);
    }
    
    // Alertas para ativos críticos
    const ativosCriticos = itens.filter(i => i.ativo_critico);
    if (ativosCriticos.length > 0) {
      alertas.push(`${ativosCriticos.length} ativo(s) crítico(s) detectado(s) - considerar pré-blend ou dupla conferência`);
    }
  }
  
  // Validações de líquido
  if (formula.tipo_apresentacao === 'LIQUIDO') {
    if (!formula.volume_frasco_ml || formula.volume_frasco_ml <= 0) {
      erros.push('Volume do frasco é obrigatório para líquidos');
    }
    if (!formula.volume_por_dose_ml || formula.volume_por_dose_ml <= 0) {
      erros.push('Volume por dose é obrigatório para líquidos');
    }
  }
  
  // Validações de pó
  if (formula.tipo_apresentacao === 'PO') {
    if (!formula.peso_por_dose_g || formula.peso_por_dose_g <= 0) {
      erros.push('Peso por dose é obrigatório para pó');
    }
    if (!formula.doses_por_pote || formula.doses_por_pote <= 0) {
      erros.push('Doses por pote é obrigatório para pó');
    }
  }
  
  return {
    valido: erros.length === 0,
    erros,
    alertas,
  };
}

// Gerar estrutura base de OP
export interface OPBase {
  codigo: string;
  formula_id: string;
  formula_codigo: string;
  formula_nome: string;
  versao: number;
  tipo_apresentacao: TipoApresentacao;
  itens: Array<{
    nome: string;
    quantidade_mg: number;
    ativo_critico: boolean;
    exige_premix: boolean;
  }>;
  excipiente?: TipoExcipiente;
  avisos: string[];
}

export function gerarOPBase(
  formula: Formula,
  itens: FormulaItem[],
  sequenciaOP: number
): OPBase {
  const avisos: string[] = [];
  
  // Detectar ativos críticos
  const ativosCriticos = itens.filter(i => i.ativo_critico);
  if (ativosCriticos.length > 0) {
    avisos.push(`ATENÇÃO: ${ativosCriticos.length} ativo(s) crítico(s) - EXIGEM PRÉ-BLEND OU DUPLA CONFERÊNCIA`);
    ativosCriticos.forEach(a => {
      avisos.push(`  - ${a.nome_insumo}: ${a.quantidade_convertida_mg.toFixed(4)} mg`);
    });
  }
  
  // Aviso de excipiente
  if (formula.tipo_apresentacao === 'CAPSULA' && formula.excipiente_padrao) {
    avisos.push(`Excipiente padrão: ${formula.excipiente_padrao}`);
  }
  
  const ano = new Date().getFullYear();
  const opCodigo = `OP-${ano}-${String(sequenciaOP).padStart(4, '0')}`;
  
  return {
    codigo: opCodigo,
    formula_id: formula.id,
    formula_codigo: formula.codigo_formula,
    formula_nome: formula.nome_formula,
    versao: formula.versao,
    tipo_apresentacao: formula.tipo_apresentacao,
    itens: itens.map(i => ({
      nome: i.nome_insumo,
      quantidade_mg: i.quantidade_convertida_mg,
      ativo_critico: i.ativo_critico,
      exige_premix: i.exige_premix,
    })),
    excipiente: formula.excipiente_padrao,
    avisos,
  };
}
