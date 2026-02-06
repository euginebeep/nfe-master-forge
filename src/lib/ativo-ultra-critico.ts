// ============================================================
// ATIVO ULTRA CRÍTICO - REGRAS DE SEGURANÇA
// Vitamina D3, Vitamina A e outros ativos de alta potência
// ============================================================

import { supabase } from "@/integrations/supabase/client";

// ============================================================
// TIPOS E INTERFACES
// ============================================================

export type ClassificacaoRisco = 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'ULTRA_CRITICO';
export type MetodoDistribuicao = 'PESAGEM_DIRETA' | 'DISTRIBUICAO_GEOMETRICA' | 'DISTRIBUICAO_GEOMETRICA_POR_PREMIX';

export interface ConversaoUICompleta {
  id: string;
  substancia: string;
  fator_ui_para_mg: number;
  conversao_ui_mcg?: number;        // 1 UI = X mcg
  potencia_faixa_min?: number;      // UI/g mínimo esperado no COA
  potencia_faixa_max?: number;      // UI/g máximo esperado no COA
  classificacao_risco: ClassificacaoRisco;
  fonte_tecnica?: string;
  ativo: boolean;
}

export interface AtivoUltraCriticoInfo {
  classificacao_risco: ClassificacaoRisco;
  bloquear_entrada_mg_manual: boolean;
  exigir_premix: boolean;
  metodo_distribuicao?: MetodoDistribuicao;
  texto_alerta_padrao?: string;
  conversao_ui_mcg?: number;
  potencia_faixa_min?: number;
  potencia_faixa_max?: number;
}

// ============================================================
// CONSTANTES
// ============================================================

export const ALERTA_ULTRA_CRITICO_PADRAO = 
  "⚠️ ATIVO ULTRA CRÍTICO – PROIBIDA PESAGEM DIRETA NO LOTE FINAL. " +
  "Utilizar DILUIÇÃO GEOMÉTRICA com pré-mistura obrigatória.";

export const REFERENCIAS_TECNICAS = [
  "FISPQ – Colecalciferol",
  "USP – 1 UI = 0,025 mcg (Vitamina D3)",
  "COA do Fornecedor (potência real)",
];

// ============================================================
// FUNÇÕES DE VERIFICAÇÃO
// ============================================================

/**
 * Normaliza texto para comparação (remove acentos, pontuação, espaços extras)
 */
function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/[^a-z0-9]/g, '') // Remove pontuação e espaços
    .trim();
}

/**
 * Extrai tokens chave de um nome de substância para matching
 */
function extrairTokensChave(nome: string): string[] {
  const normalizado = normalizarTexto(nome);
  const tokens: string[] = [];
  
  // Detecta vitaminas com letra/número (D3, B12, A, E, K2, etc.)
  const vitaminaMatch = normalizado.match(/vit(?:amina)?([a-z]?\d*)/);
  if (vitaminaMatch) {
    tokens.push('vitamina');
    tokens.push(vitaminaMatch[1] || '');
  }
  
  // Detecta D3, B12, etc. isolados
  const vitMatch = normalizado.match(/([a-z])(\d+)/);
  if (vitMatch) {
    tokens.push(vitMatch[1] + vitMatch[2]);
  }
  
  // Token específico para "d3"
  if (normalizado.includes('d3') || normalizado.includes('d-3')) {
    tokens.push('d3');
  }
  
  return tokens.filter(t => t.length > 0);
}

/**
 * Verifica se dois nomes de substância são equivalentes
 */
function substanciasEquivalentes(nome1: string, nome2: string): boolean {
  const norm1 = normalizarTexto(nome1);
  const norm2 = normalizarTexto(nome2);
  
  // Match direto
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return true;
  }
  
  // Match por tokens chave
  const tokens1 = extrairTokensChave(nome1);
  const tokens2 = extrairTokensChave(nome2);
  
  // Se ambos têm "d3" ou equivalente
  if (tokens1.includes('d3') && tokens2.includes('d3')) {
    return true;
  }
  
  // Verifica vitaminas com mesmo identificador
  const vitPattern1 = tokens1.find(t => /^[a-z]\d+$/.test(t));
  const vitPattern2 = tokens2.find(t => /^[a-z]\d+$/.test(t));
  if (vitPattern1 && vitPattern2 && vitPattern1 === vitPattern2) {
    return true;
  }
  
  return false;
}

/**
 * Busca informações de conversão/risco para uma substância
 */
export async function buscarInfoConversaoCompleta(nomeSubstancia: string): Promise<ConversaoUICompleta | null> {
  try {
    const { data, error } = await supabase
      .from('conversoes_unidades')
      .select('*')
      .eq('ativo', true)
      .order('substancia');

    if (error) throw error;

    // Busca com algoritmo melhorado de matching
    const encontrado = (data || []).find(c => substanciasEquivalentes(c.substancia, nomeSubstancia));

    return encontrado as ConversaoUICompleta | null;
  } catch (err) {
    console.error('Erro ao buscar conversão:', err);
    return null;
  }
}

/**
 * Verifica se um insumo é ultra crítico baseado nas conversões cadastradas
 */
export async function verificarAtivoUltraCritico(nomeInsumo: string): Promise<AtivoUltraCriticoInfo | null> {
  const conversao = await buscarInfoConversaoCompleta(nomeInsumo);
  
  if (!conversao) return null;
  
  if (conversao.classificacao_risco === 'ULTRA_CRITICO') {
    return {
      classificacao_risco: 'ULTRA_CRITICO',
      bloquear_entrada_mg_manual: true,
      exigir_premix: true,
      metodo_distribuicao: 'DISTRIBUICAO_GEOMETRICA_POR_PREMIX',
      texto_alerta_padrao: ALERTA_ULTRA_CRITICO_PADRAO,
      conversao_ui_mcg: conversao.conversao_ui_mcg,
      potencia_faixa_min: conversao.potencia_faixa_min,
      potencia_faixa_max: conversao.potencia_faixa_max,
    };
  }
  
  if (conversao.classificacao_risco === 'CRITICO') {
    return {
      classificacao_risco: 'CRITICO',
      bloquear_entrada_mg_manual: false,
      exigir_premix: false, // Sugestão apenas
      metodo_distribuicao: 'DISTRIBUICAO_GEOMETRICA',
      conversao_ui_mcg: conversao.conversao_ui_mcg,
      potencia_faixa_min: conversao.potencia_faixa_min,
      potencia_faixa_max: conversao.potencia_faixa_max,
    };
  }
  
  return {
    classificacao_risco: conversao.classificacao_risco || 'NORMAL',
    bloquear_entrada_mg_manual: false,
    exigir_premix: false,
    conversao_ui_mcg: conversao.conversao_ui_mcg,
  };
}

/**
 * Determina classificação de risco baseada em quantidade e unidade
 */
export function determinarClassificacaoRisco(
  quantidadeConvertidaMg: number,
  unidadeOriginal: string,
  classificacaoExistente?: ClassificacaoRisco
): ClassificacaoRisco {
  // Se já é ULTRA_CRITICO, manter
  if (classificacaoExistente === 'ULTRA_CRITICO') {
    return 'ULTRA_CRITICO';
  }
  
  // Dose extremamente baixa (< 0.1 mg) = Ultra crítico
  if (quantidadeConvertidaMg < 0.1) {
    return 'ULTRA_CRITICO';
  }
  
  // Dose baixa (< 1 mg) ou UI/MCG = Crítico
  if (quantidadeConvertidaMg < 1 || unidadeOriginal === 'UI' || unidadeOriginal === 'MCG') {
    // Preservar classificação existente se for mais severa
    if (classificacaoExistente === 'CRITICO') return 'CRITICO';
    return 'CRITICO';
  }
  
  // Dose moderada (< 10 mg) = Atenção
  if (quantidadeConvertidaMg < 10) {
    return 'ATENCAO';
  }
  
  return 'NORMAL';
}

/**
 * Gera alertas de segurança para ativos ultra críticos
 */
export function gerarAlertasUltraCritico(
  nomeInsumo: string,
  classificacao: ClassificacaoRisco,
  quantidadeMg: number
): string[] {
  const alertas: string[] = [];
  
  if (classificacao === 'ULTRA_CRITICO') {
    alertas.push(`🚨 ${nomeInsumo}: ATIVO ULTRA CRÍTICO`);
    alertas.push('⛔ PROIBIDA pesagem direta no lote final');
    alertas.push('✅ OBRIGATÓRIA diluição geométrica com pré-mistura');
    alertas.push(`📊 Dose: ${quantidadeMg.toFixed(4)} mg (requer balança analítica)`);
  } else if (classificacao === 'CRITICO') {
    alertas.push(`⚠️ ${nomeInsumo}: Ativo crítico`);
    alertas.push('📌 Recomendada dupla conferência na pesagem');
    if (quantidadeMg < 1) {
      alertas.push('💡 Sugestão: Considerar diluição geométrica');
    }
  } else if (classificacao === 'ATENCAO') {
    alertas.push(`📋 ${nomeInsumo}: Atenção na pesagem`);
  }
  
  return alertas;
}

/**
 * Verifica se a potência do COA está dentro da faixa esperada
 */
export function validarPotenciaCOA(
  potenciaCOA: number,
  faixaMin?: number,
  faixaMax?: number
): { valido: boolean; mensagem?: string } {
  if (!faixaMin && !faixaMax) {
    return { valido: true };
  }
  
  if (faixaMin && potenciaCOA < faixaMin) {
    return {
      valido: false,
      mensagem: `Potência (${potenciaCOA.toLocaleString()} UI/g) abaixo do mínimo esperado (${faixaMin.toLocaleString()} UI/g)`,
    };
  }
  
  if (faixaMax && potenciaCOA > faixaMax) {
    return {
      valido: false,
      mensagem: `Potência (${potenciaCOA.toLocaleString()} UI/g) acima do máximo esperado (${faixaMax.toLocaleString()} UI/g)`,
    };
  }
  
  return { valido: true };
}

/**
 * Calcula a quantidade real de ativo com base na potência do lote
 * Fórmula: massa_real = (dose_desejada_UI / potencia_lote_UI_por_g) * 1000 (para mg)
 */
export function calcularMassaRealPorPotencia(
  doseDesejadaUI: number,
  potenciaLoteUIporG: number
): { massa_mg: number; fator_correcao: number } {
  if (potenciaLoteUIporG <= 0) {
    throw new Error('Potência do lote deve ser maior que zero');
  }
  
  // massa em gramas = dose_UI / potencia_UI_por_g
  const massaG = doseDesejadaUI / potenciaLoteUIporG;
  const massaMg = massaG * 1000;
  
  // Fator de correção em relação ao padrão teórico (40.000.000 UI/g para D3)
  const potenciaPadraoD3 = 40000000; // 40M UI/g
  const fatorCorrecao = potenciaPadraoD3 / potenciaLoteUIporG;
  
  return {
    massa_mg: parseFloat(massaMg.toFixed(6)),
    fator_correcao: parseFloat(fatorCorrecao.toFixed(4)),
  };
}

/**
 * Formata a classificação de risco para exibição
 */
export function formatarClassificacaoRisco(classificacao: ClassificacaoRisco): {
  label: string;
  cor: string;
  icone: string;
} {
  switch (classificacao) {
    case 'ULTRA_CRITICO':
      return { label: 'Ultra Crítico', cor: 'destructive', icone: '🚨' };
    case 'CRITICO':
      return { label: 'Crítico', cor: 'warning', icone: '⚠️' };
    case 'ATENCAO':
      return { label: 'Atenção', cor: 'secondary', icone: '📋' };
    default:
      return { label: 'Normal', cor: 'default', icone: '✅' };
  }
}
