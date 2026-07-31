// ============================================================
// FORMULADOR INDUSTRIAL - TIPOS E INTERFACES
// Sistema profissional de formulação de suplementos
// VERSÃO DEFINITIVA
// ============================================================

import { CAPSULA_PESO_ALVO_MG, calcularCapsulasPorDose, CAPSULA_TAMANHO_PADRAO, DENSIDADE_PADRAO_KG_L } from "@/lib/formulador-industrial-rules";

// ============================================================
// ENUMS E TIPOS BASE
// ============================================================

export type TipoApresentacao = 'CAPSULA' | 'LIQUIDO' | 'PO';
export type StatusFormula = 'RASCUNHO' | 'APROVADA' | 'BLOQUEADA';
export type TipoVeiculoBase = 'AMIDO' | 'CELULOSE' | 'PRE_BLEND';
export type UnidadeInformada = 'MG' | 'MCG' | 'UI' | 'G' | 'ML';

// ============================================================
// CONVERSÕES DE UNIDADES
// ============================================================

export interface ConversaoUnidade {
  id: string;
  substancia: string;
  fator_ui_para_mg: number;
  conversao_ui_mcg?: number | null;
  fonte_tecnica?: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

// ============================================================
// ITEM DA FÓRMULA (ATIVO)
// ============================================================

export interface FormulaItem {
  id: string;
  formula_id: string;
  produto_materia_prima_id?: string | null;
  nome_insumo: string;
  quantidade_informada: number;
  unidade_informada: UnidadeInformada;
  quantidade_convertida_mg: number;
  ativo_critico: boolean; // FLAG AUTOMÁTICA
  exige_premix: boolean; // USUÁRIO DECIDE
  ordem_mistura: number;
  percentual_na_capsula?: number;
  created_at?: string;
}

// ============================================================
// FÓRMULA PRINCIPAL
// ============================================================

export interface Formula {
  id: string;
  codigo_formula: string;
  nome_formula: string;
  produto_acabado_id?: string | null;
  
  // Tipo de apresentação
  tipo_apresentacao: TipoApresentacao;
  
  // Campos CÁPSULA
  peso_capsula_alvo_mg?: number;
  peso_capsula_nominal_mg?: number;
  tipo_capsula?: string;
  excipiente_padrao?: TipoVeiculoBase;
  peso_enchimento_mg?: number;
  densidade_aparente_kg_l?: number;
  
  // FASE 2: Cápsulas por dose
  n_capsulas_por_dose?: number;
  peso_por_capsula_mg?: number;
  massa_ativos_dose_mg?: number;

  /** Grupo populacional-alvo canônico (19_mais, 4_8_anos, …) — chk_grupo_populacional */
  grupo_populacional_alvo?: string | null;
  /** Doses por dia (recomendação diária) — usado no motor regulatório */
  doses_por_dia?: number | null;
  
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

// ============================================================
// TABELA NUTRICIONAL
// ============================================================

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

// ============================================================
// ALEGAÇÕES ANVISA
// ============================================================

export interface AlegacaoANVISA {
  id: string;
  formula_id: string;
  texto_alegacao: string;
  fonte_anvisa?: string;
  permitido: boolean;
  created_at?: string;
}

// ============================================================
// OP GERADA
// ============================================================

export interface OrdemProducaoGerada {
  id: string;
  formula_id: string;
  op_codigo: string;
  tipo_documento: string;
  data_geracao?: string;
  dados_op: Record<string, unknown>;
}

// ============================================================
// VERSÃO DA FÓRMULA (HISTÓRICO)
// ============================================================

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

/**
 * Gera código único de fórmula
 */
export function gerarCodigoFormula(sequencia: number): string {
  const ano = new Date().getFullYear();
  return `FRM-${ano}-${String(sequencia).padStart(4, '0')}`;
}

/**
 * Gerar estrutura base de OP
 */
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
  veiculo_base?: TipoVeiculoBase;
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
    avisos.push(`ATENÇÃO: ${ativosCriticos.length} ativo(s) crítico(s) - DUPLA CONFERÊNCIA OBRIGATÓRIA`);
    ativosCriticos.forEach(a => {
      avisos.push(`  • ${a.nome_insumo}: ${a.quantidade_convertida_mg.toFixed(4)} mg`);
    });
  }
  
  // Veículo base
  if (formula.tipo_apresentacao === 'CAPSULA' && formula.excipiente_padrao) {
    avisos.push(`Veículo base: ${formula.excipiente_padrao}`);
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
    veiculo_base: formula.excipiente_padrao,
    avisos,
  };
}

// ============================================================
// VALIDAÇÃO DA FÓRMULA
// ============================================================

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
  const normalizarTexto = (texto: string): string => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  };

  const extrairIdVitamina = (nome: string): string | null => {
    const s = normalizarTexto(nome);
    const m = s.match(/(?:vitamina|vit)?([a-z]\d+)/);
    if (m?.[1]) return m[1];

    const afterPrefix = s.replace(/^vitamina/, '').replace(/^vit/, '');
    if (afterPrefix.length > 0) return afterPrefix[0];

    return null;
  };

  const encontrarConversaoUI = (nomeInsumo: string): ConversaoUnidade | undefined => {
    const alvoNorm = normalizarTexto(nomeInsumo);
    const idAlvo = extrairIdVitamina(nomeInsumo);

    return conversoes.find((c) => {
      const candNorm = normalizarTexto(c.substancia);

      // Match por inclusão (fallback)
      if (candNorm.includes(alvoNorm) || alvoNorm.includes(candNorm)) return true;

      // Match por identificador de vitamina (ex: d3, b12, k1)
      const idCand = extrairIdVitamina(c.substancia);
      if (idAlvo && idCand && idAlvo === idCand) return true;

      return false;
    });
  };

  // BLOCO 1: Validar que todos os itens tem produto_materia_prima_id
  for (const item of itens) {
    if (!item.produto_materia_prima_id) {
      erros.push(`Item "${item.nome_insumo}" nao tem materia-prima vinculada. Edite e selecione do cadastro.`);
    }
    if (item.unidade_informada === 'UI') {
      const conversao = encontrarConversaoUI(item.nome_insumo);
      if (!conversao) {
        erros.push(`Fator de conversão UI→mg não encontrado para: ${item.nome_insumo}`);
      }
    }
  }
  
  // Validações de cápsula
  if (formula.tipo_apresentacao === 'CAPSULA') {
    const totalAtivos = itens.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
    const densidade = formula.densidade_aparente_kg_l || DENSIDADE_PADRAO_KG_L;
    const tipoCapsula = (formula.tipo_capsula as any) || CAPSULA_TAMANHO_PADRAO;
    
    // Calcular cápsulas por dose para obter a massa total da dose
    const capsulasPorDose = calcularCapsulasPorDose(totalAtivos, densidade, tipoCapsula);
    const massaTotalDose = capsulasPorDose.n_capsulas * capsulasPorDose.peso_por_capsula_mg;
    
    // Considerar excipientes tecnológicos fixos (8% da dose total)
    const totalExcipientesTec = massaTotalDose * 0.08;
    
    // Só lançar erro se a dose realmente não cabe (capsulasPorDose.nivel === 'error')
    if (capsulasPorDose.nivel === 'error') {
      erros.push(`Dose excede 6 cápsulas! Ativos (${totalAtivos.toFixed(2)} mg) + excipientes não cabem. Reduza ativos ou aumente densidade.`);
    }
    
    // Alertas para ativos críticos (INFORMATIVOS)
    const ativosCriticos = itens.filter(i => i.ativo_critico);
    if (ativosCriticos.length > 0) {
      alertas.push(`${ativosCriticos.length} ativo(s) crítico(s) - dupla conferência recomendada`);
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
