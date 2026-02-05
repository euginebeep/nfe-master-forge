// Tipos para o Formulador ANVISA

export type TipoCapsula = 
  | '000' | '00' | '0' | '1' | '2' | '3' | '4' | '5' 
  | 'Softgel' | 'Vegana' | 'Liquida' | 'Comprimido' | 'Sachê';

export type UnidadeDeclaracao = 'mg' | 'mcg' | 'UI' | 'g' | 'ml' | '%VD';

export type StatusFormula = 'RASCUNHO' | 'ATIVO' | 'REVISAO' | 'ARQUIVADO';

// Capacidades típicas por tipo de cápsula (em mg)
export const CAPSULA_CAPACIDADES: Record<string, { min: number; max: number; tipico: number }> = {
  '000': { min: 800, max: 1200, tipico: 1000 },
  '00': { min: 500, max: 800, tipico: 650 },
  '0': { min: 400, max: 600, tipico: 500 },
  '1': { min: 300, max: 500, tipico: 400 },
  '2': { min: 200, max: 400, tipico: 300 },
  '3': { min: 150, max: 300, tipico: 225 },
  '4': { min: 100, max: 200, tipico: 150 },
  '5': { min: 50, max: 100, tipico: 75 },
  'Softgel': { min: 500, max: 1500, tipico: 1000 },
  'Vegana': { min: 400, max: 600, tipico: 500 },
  'Liquida': { min: 500, max: 2000, tipico: 1000 },
  'Comprimido': { min: 500, max: 1500, tipico: 1000 },
  'Sachê': { min: 1000, max: 10000, tipico: 5000 },
};

// Fatores de conversão para UI → mg (aproximados - variam por ativo)
export const UI_PARA_MG: Record<string, number> = {
  'VITAMINA_A': 0.0003, // 1 UI = 0.3 mcg retinol
  'VITAMINA_D': 0.000025, // 1 UI = 0.025 mcg
  'VITAMINA_E': 0.67, // 1 UI = 0.67 mg (d-alpha-tocoferol)
  'VITAMINA_K': 1, // geralmente em mcg direto
};

// Ingrediente da fórmula
export interface FormulaIngrediente {
  id: string;
  item_id: string; // Referência ao item do cadastro
  item_descricao: string;
  item_sku?: string;
  
  // Quantidade declarada no rótulo
  quantidade_rotulo: number;
  unidade_rotulo: UnidadeDeclaracao;
  
  // Quantidade real de manipulação (considerando potência)
  quantidade_manipulacao: number;
  unidade_manipulacao: 'mg' | 'g';
  
  // Potência do ativo (ex: 10% = 0.1)
  potencia?: number;
  
  // Para exibição no rótulo
  nome_rotulo?: string; // Ex: "Vitamina D3 (Colecalciferol)"
  
  // Flags
  higroscopico: boolean;
  exige_premix: boolean;
  
  // Ordem no rótulo
  ordem: number;
}

// Fórmula completa
export interface Formula {
  id: string;
  codigo: string;
  nome: string;
  nome_comercial?: string;
  descricao?: string;
  
  // Tipo de forma farmacêutica
  tipo_capsula: TipoCapsula;
  capacidade_mg: number; // Capacidade total em mg
  
  // Ingredientes
  ingredientes: FormulaIngrediente[];
  
  // Cálculos automáticos
  total_ativos_mg: number;
  qsp_mg: number; // Q.S.P. (excipiente q.s.p.)
  excipiente_padrao?: string; // Ex: "Maltodextrina"
  
  // Status e versionamento
  status: StatusFormula;
  versao: number;
  versao_anterior_id?: string;
  
  // Metadados
  created_at: string;
  updated_at: string;
  created_by?: string;
  
  // Alertas calculados
  alertas: FormulaAlerta[];
}

export interface FormulaAlerta {
  tipo: 'HIGROSCOPICO' | 'EXCEDE_CAPACIDADE' | 'POTENCIA_BAIXA' | 'SEM_VD' | 'INTERACAO';
  mensagem: string;
  severidade: 'info' | 'warning' | 'error';
  ingrediente_id?: string;
}

// Tabela nutricional gerada
export interface TabelaNutricional {
  formula_id: string;
  porcao: string; // Ex: "1 cápsula (500mg)"
  linhas: TabelaNutricionalLinha[];
  advertencias?: string[];
}

export interface TabelaNutricionalLinha {
  nutriente: string;
  quantidade: string;
  unidade: string;
  vd_percent?: number; // % do Valor Diário
}

// Valores Diários de Referência (RDC 360/2003 e atualizações)
export const VD_REFERENCIA: Record<string, { valor: number; unidade: string }> = {
  'Vitamina A': { valor: 600, unidade: 'mcg' },
  'Vitamina D': { valor: 5, unidade: 'mcg' },
  'Vitamina E': { valor: 10, unidade: 'mg' },
  'Vitamina K': { valor: 65, unidade: 'mcg' },
  'Vitamina C': { valor: 45, unidade: 'mg' },
  'Vitamina B1': { valor: 1.2, unidade: 'mg' },
  'Vitamina B2': { valor: 1.3, unidade: 'mg' },
  'Vitamina B3': { valor: 16, unidade: 'mg' },
  'Vitamina B5': { valor: 5, unidade: 'mg' },
  'Vitamina B6': { valor: 1.3, unidade: 'mg' },
  'Vitamina B7': { valor: 30, unidade: 'mcg' },
  'Vitamina B9': { valor: 240, unidade: 'mcg' },
  'Vitamina B12': { valor: 2.4, unidade: 'mcg' },
  'Cálcio': { valor: 1000, unidade: 'mg' },
  'Ferro': { valor: 14, unidade: 'mg' },
  'Magnésio': { valor: 260, unidade: 'mg' },
  'Zinco': { valor: 7, unidade: 'mg' },
  'Selênio': { valor: 34, unidade: 'mcg' },
  'Cobre': { valor: 900, unidade: 'mcg' },
  'Manganês': { valor: 2.3, unidade: 'mg' },
  'Cromo': { valor: 35, unidade: 'mcg' },
  'Molibdênio': { valor: 45, unidade: 'mcg' },
  'Iodo': { valor: 130, unidade: 'mcg' },
  'Fósforo': { valor: 700, unidade: 'mg' },
  'Potássio': { valor: 3500, unidade: 'mg' },
  'Colina': { valor: 550, unidade: 'mg' },
};
