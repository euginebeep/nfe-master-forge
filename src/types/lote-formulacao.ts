// Lote para Formulação Industrial
// REGRA MESTRE: Potência é atributo do LOTE, não do Insumo Mestre

import { TipoPotencia } from './formulas-industrial';

/**
 * Lote de insumo disponível para formulação
 * A potência vem do lote específico (certificado de análise do fornecedor)
 */
export interface LoteFormulacao {
  id: string;
  insumo_id: string;
  item_id?: string;
  
  // Identificação do lote
  numero_lote: string;
  fornecedor_id?: string;
  fornecedor_nome?: string;
  
  // Datas
  data_fabricacao?: string;
  data_validade?: string;
  
  // POTÊNCIA DO LOTE (COA - Certificado de Análise)
  tipo_potencia: TipoPotencia;
  potencia_valor?: number;      // Ex: 400000 para 400.000 UI/g
  potencia_unidade?: string;    // Ex: "UI/g", "mg/g", "%"
  
  // Estoque
  quantidade_disponivel: number; // Em unidade interna (g ou kg)
  unidade_estoque: string;
  
  // Custo
  custo_por_kg?: number;
  
  // Status
  status: 'DISPONIVEL' | 'QUARENTENA' | 'BLOQUEADO' | 'ESGOTADO';
  
  created_at: string;
  updated_at: string;
}

/**
 * Configuração de ativo na fórmula do produto
 * Agora inclui seleção de lote para obter potência
 */
export interface ProdutoAtivoComLote {
  id: string;
  
  // Insumo selecionado (do cadastro)
  insumo_id: string;
  nome_insumo: string;
  nome_rotulo?: string;
  
  // Lote selecionado (para obter potência)
  lote_id?: string;
  lote_numero?: string;
  lote_potencia_tipo?: TipoPotencia;
  lote_potencia_valor?: number;
  
  // Dose declarada (o que o operador informa)
  dose_declarada: number;
  unidade_dose: 'mg' | 'mcg' | 'UI' | 'g';
  
  // CÁLCULOS AUTOMÁTICOS (baseados na potência do lote)
  massa_real_mg?: number;          // Peso a pesar por cápsula
  equivalente_mcg?: number;        // Para rotulagem nutricional (Vit D: 2000 UI = 50 mcg)
  
  // Flags de segurança
  pesagem_critica?: boolean;       // < 5mg
  requer_diluicao?: boolean;       // < 1mg
  sugestao_premix?: string;
}

// ========================================
// CÁLCULOS COM POTÊNCIA DO LOTE
// ========================================

/**
 * Calcula a massa real a pesar baseado na potência do lote
 * 
 * Exemplo: Vitamina D3 com potência 400.000 UI/g
 * - Dose declarada: 2.000 UI
 * - Massa real = 2.000 / 400.000 = 0,005g = 5mg
 */
export function calcularMassaRealComPotenciaLote(
  dose_declarada: number,
  unidade_dose: 'mg' | 'mcg' | 'UI' | 'g',
  tipo_potencia: TipoPotencia,
  potencia_valor?: number
): { 
  massa_mg: number; 
  equivalente_mcg: number;
  erro?: string;
  bloqueado?: boolean;
} {
  
  // Validar potência para conversões que exigem
  if (unidade_dose === 'UI') {
    if (tipo_potencia !== 'UI_POR_GRAMA' || !potencia_valor || potencia_valor <= 0) {
      return {
        massa_mg: 0,
        equivalente_mcg: 0,
        erro: 'BLOQUEADO: Conversão UI requer potência UI/g do lote',
        bloqueado: true,
      };
    }
    
    // Cálculo: dose_UI / potencia_UI_g = gramas → ×1000 = mg
    const massa_g = dose_declarada / potencia_valor;
    const massa_mg = massa_g * 1000;
    
    // Para Vitamina D: 1 UI = 0.025 mcg
    // Fator de conversão padrão (pode variar por tipo de vitamina)
    const equivalente_mcg = dose_declarada * 0.025;
    
    return {
      massa_mg: Math.round(massa_mg * 1000) / 1000,
      equivalente_mcg: Math.round(equivalente_mcg * 1000) / 1000,
    };
  }
  
  if (unidade_dose === 'mcg') {
    // mcg direto ou com potência mg/g
    let massa_mg = dose_declarada / 1000; // mcg → mg
    let equivalente_mcg = dose_declarada;
    
    if (tipo_potencia === 'MG_POR_GRAMA' && potencia_valor && potencia_valor > 0) {
      // Ajustar pela potência
      const dose_mg = dose_declarada / 1000;
      const massa_g = dose_mg / potencia_valor;
      massa_mg = massa_g * 1000;
    }
    
    return {
      massa_mg: Math.round(massa_mg * 1000) / 1000,
      equivalente_mcg: Math.round(equivalente_mcg * 1000) / 1000,
    };
  }
  
  if (unidade_dose === 'g') {
    const massa_mg = dose_declarada * 1000;
    return {
      massa_mg: Math.round(massa_mg * 1000) / 1000,
      equivalente_mcg: massa_mg * 1000, // mg → mcg
    };
  }
  
  // unidade_dose === 'mg' (padrão)
  let massa_mg = dose_declarada;
  
  if (tipo_potencia === 'PERCENTUAL' && potencia_valor && potencia_valor > 0) {
    // Potência percentual (ex: 0.2% = 0.002)
    massa_mg = dose_declarada / potencia_valor;
  } else if (tipo_potencia === 'MG_POR_GRAMA' && potencia_valor && potencia_valor > 0) {
    // Potência em mg/g
    const massa_g = dose_declarada / potencia_valor;
    massa_mg = massa_g * 1000;
  }
  
  return {
    massa_mg: Math.round(massa_mg * 1000) / 1000,
    equivalente_mcg: Math.round(massa_mg * 1000 * 1000) / 1000,
  };
}

/**
 * Verifica se a massa requer diluição geométrica
 */
export function verificarDiluicaoGeometrica(massa_mg: number): {
  requer_diluicao: boolean;
  pesagem_critica: boolean;
  severidade: 'OK' | 'ATENCAO' | 'CRITICO';
  mensagem?: string;
  sugestao_premix?: string;
} {
  if (massa_mg < 1) {
    return {
      requer_diluicao: true,
      pesagem_critica: true,
      severidade: 'CRITICO',
      mensagem: `${massa_mg.toFixed(3)}mg - DILUIÇÃO GEOMÉTRICA OBRIGATÓRIA`,
      sugestao_premix: `Preparar pré-mistura: ${massa_mg.toFixed(3)}mg de ativo + ${(10 - massa_mg).toFixed(3)}mg de diluente = 10mg/cápsula`,
    };
  }
  
  if (massa_mg < 5) {
    return {
      requer_diluicao: false,
      pesagem_critica: true,
      severidade: 'ATENCAO',
      mensagem: `${massa_mg.toFixed(2)}mg - Pesagem crítica, usar balança analítica`,
    };
  }
  
  return {
    requer_diluicao: false,
    pesagem_critica: false,
    severidade: 'OK',
  };
}

// ========================================
// AUTOCOMPLETE PARA NOME NO RÓTULO
// ========================================

export const NOMES_ROTULO_AUTOCOMPLETE: Record<string, string> = {
  // Vitaminas
  'vitamina d': 'Vitamina D (Colecalciferol)',
  'vitamina d3': 'Vitamina D3 (Colecalciferol)',
  'vitamina d2': 'Vitamina D2 (Ergocalciferol)',
  'vitamina k': 'Vitamina K (Filoquinona)',
  'vitamina k2': 'Vitamina K2 (Menaquinona-7)',
  'vitamina k1': 'Vitamina K1 (Filoquinona)',
  'vitamina a': 'Vitamina A (Retinol)',
  'vitamina e': 'Vitamina E (alfa-Tocoferol)',
  'vitamina c': 'Vitamina C (Ácido Ascórbico)',
  'vitamina b1': 'Vitamina B1 (Tiamina)',
  'vitamina b2': 'Vitamina B2 (Riboflavina)',
  'vitamina b3': 'Vitamina B3 (Niacina)',
  'vitamina b5': 'Vitamina B5 (Ácido Pantotênico)',
  'vitamina b6': 'Vitamina B6 (Piridoxina)',
  'vitamina b7': 'Vitamina B7 (Biotina)',
  'vitamina b9': 'Vitamina B9 (Ácido Fólico)',
  'vitamina b12': 'Vitamina B12 (Cianocobalamina)',
  'biotina': 'Biotina (Vitamina B7)',
  'acido folico': 'Ácido Fólico (Vitamina B9)',
  'folato': 'Folato (5-MTHF)',
  'metilfolato': 'L-Metilfolato (5-MTHF)',
  
  // Minerais
  'zinco': 'Zinco',
  'zinco quelato': 'Zinco (Bisglicinato)',
  'magnesio': 'Magnésio',
  'magnesio quelato': 'Magnésio (Bisglicinato)',
  'calcio': 'Cálcio',
  'ferro': 'Ferro (Bisglicinato)',
  'selenio': 'Selênio (Selenometionina)',
  'cobre': 'Cobre (Bisglicinato)',
  'manganes': 'Manganês',
  'cromo': 'Cromo (Picolinato)',
  'iodo': 'Iodo (Iodeto de Potássio)',
  
  // Ômega e óleos
  'omega 3': 'Óleo de Peixe (Ômega-3)',
  'oleo de peixe': 'Óleo de Peixe (EPA/DHA)',
  'dha': 'DHA (Ácido Docosahexaenoico)',
  'epa': 'EPA (Ácido Eicosapentaenoico)',
  
  // Outros
  'coenzima q10': 'Coenzima Q10 (Ubiquinona)',
  'coq10': 'Coenzima Q10 (Ubiquinona)',
  'resveratrol': 'Resveratrol (trans-Resveratrol)',
  'curcumina': 'Curcumina (Curcuma longa)',
  'ashwagandha': 'Ashwagandha (Withania somnifera)',
  'melatonina': 'Melatonina',
  'colágeno': 'Colágeno Hidrolisado',
  'colageno': 'Colágeno Hidrolisado',
  'probiotico': 'Probiótico (Lactobacillus)',
};

/**
 * Autocomplete para nome no rótulo (TAB)
 */
export function autocompletarNomeRotulo(input: string): string | null {
  const normalizado = input.toLowerCase().trim();
  return NOMES_ROTULO_AUTOCOMPLETE[normalizado] || null;
}
