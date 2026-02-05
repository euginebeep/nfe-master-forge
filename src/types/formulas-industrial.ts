// Sistema de Formulação Industrial de Suplementos Encapsulados
// Seguindo boas práticas de produção em encapsuladora semi-automática

// ========================================
// ENUMS E TIPOS BASE
// ========================================

export type CategoriaInsumo = 'ATIVO' | 'EXCIPIENTE' | 'ADITIVO_TECNOLOGICO';

export type TipoPotencia = 
  | 'NENHUMA'           // Excipiente - sem potência funcional
  | 'PERCENTUAL'        // Ex: 0.2% 
  | 'UI_POR_GRAMA'      // Ex: 100.000 UI/g
  | 'MG_POR_GRAMA';     // Ex: 500 mg/g

export type NivelHigroscopicidade = 'BAIXO' | 'MEDIO' | 'ALTO';

export type TipoCapsulaIndustrial = 
  | '000' | '00' | '0' | '1' | '2' | '3' | '4' | '5' 
  | 'Vegana_00' | 'Vegana_0' | 'Vegana_1';

export type StatusFormulaIndustrial = 'RASCUNHO' | 'ATIVO' | 'REVISAO' | 'ARQUIVADO' | 'APROVADO';

export type SeveridadeAlerta = 'info' | 'warning' | 'error';

export type TipoAlertaFormula = 
  | 'EXCEDE_CAPACIDADE'
  | 'HIGROSCOPICO_DETECTADO'
  | 'POTENCIA_AUSENTE'
  | 'CAPACIDADE_BAIXA'
  | 'QSP_NEGATIVO';

// ========================================
// CAPACIDADES DE CÁPSULAS (mg)
// ========================================

export const CAPSULAS_CAPACIDADE: Record<TipoCapsulaIndustrial, { 
  min: number; 
  max: number; 
  alvo: number;  // Capacidade alvo industrial (margem de segurança)
  descricao: string;
}> = {
  '000':        { min: 800,  max: 1200, alvo: 1000, descricao: 'Cápsula 000 (maior)' },
  '00':         { min: 500,  max: 800,  alvo: 650,  descricao: 'Cápsula 00' },
  '0':          { min: 400,  max: 600,  alvo: 490,  descricao: 'Cápsula 0' },
  '1':          { min: 300,  max: 500,  alvo: 400,  descricao: 'Cápsula 1' },
  '2':          { min: 200,  max: 400,  alvo: 300,  descricao: 'Cápsula 2' },
  '3':          { min: 150,  max: 300,  alvo: 225,  descricao: 'Cápsula 3' },
  '4':          { min: 100,  max: 200,  alvo: 150,  descricao: 'Cápsula 4' },
  '5':          { min: 50,   max: 100,  alvo: 75,   descricao: 'Cápsula 5 (menor)' },
  'Vegana_00':  { min: 500,  max: 750,  alvo: 600,  descricao: 'Cápsula Vegana 00' },
  'Vegana_0':   { min: 400,  max: 580,  alvo: 480,  descricao: 'Cápsula Vegana 0' },
  'Vegana_1':   { min: 300,  max: 480,  alvo: 380,  descricao: 'Cápsula Vegana 1' },
};

// ========================================
// CADASTRO DE INSUMOS
// ========================================

export interface InsumoFormulacao {
  id: string;
  
  // Identificação
  item_id?: string;           // Referência ao cadastro de itens (matéria-prima)
  nome_interno: string;       // Nome interno para produção
  nome_rotulo: string;        // Nome que aparece no rótulo
  
  // Categoria e Potência
  categoria: CategoriaInsumo;
  tipo_potencia: TipoPotencia;
  valor_potencia?: number;    // Valor da potência (ex: 0.002 para 0.2%, 100000 para UI/g)
  
  // Para minerais - percentual elementar
  percentual_elementar?: number; // Ex: Citrato de Magnésio tem ~16% de Mg elementar
  
  // CUSTO
  custo_por_kg?: number;      // Custo do insumo por kg (R$/kg)
  
  // Flags técnicas
  higroscopico: boolean;
  nivel_higroscopicidade?: NivelHigroscopicidade;
  
  // Observações de processo
  observacoes_processo?: string;
  
  created_at: string;
  updated_at: string;
}

// ========================================
// PERFIS DE EXCIPIENTE INDUSTRIAL
// ========================================

export interface PerfilExcipienteItem {
  insumo_id: string;
  nome: string;
  tipo: 'PERCENTUAL_FIXO' | 'QSP';  // Percentual fixo ou Q.S.P.
  valor_percentual?: number;        // Ex: 1.0 para 1%
}

export interface PerfilExcipiente {
  id: string;
  nome: string;
  descricao?: string;
  
  // Componentes do perfil
  itens: PerfilExcipienteItem[];
  
  // Configurações padrão
  capacidade_alvo_padrao: number;   // Ex: 490mg
  
  // Observações técnicas
  observacoes?: string;             // Ex: "otimizado para encapsuladora semi-automática"
  
  // Flags
  ativo: boolean;
  padrao: boolean;                  // É o perfil padrão?
  
  created_at: string;
  updated_at: string;
}

// Perfil padrão de fábrica
export const PERFIL_SEMI_AUTOMATICA: Omit<PerfilExcipiente, 'id' | 'created_at' | 'updated_at'> = {
  nome: 'Semi-Automática Industrial',
  descricao: 'Otimizado para encapsuladora semi-automática',
  itens: [
    { insumo_id: '', nome: 'Dióxido de Silício', tipo: 'PERCENTUAL_FIXO', valor_percentual: 1.0 },
    { insumo_id: '', nome: 'Estearato de Magnésio', tipo: 'PERCENTUAL_FIXO', valor_percentual: 0.5 },
    { insumo_id: '', nome: 'Talco Farmacêutico', tipo: 'QSP', valor_percentual: undefined },
  ],
  capacidade_alvo_padrao: 490,
  observacoes: 'Perfil padrão para encapsuladora semi-automática industrial',
  ativo: true,
  padrao: true,
};

// ========================================
// CADASTRO DE PRODUTO
// ========================================

export interface ProdutoAtivoConfig {
  id: string;
  
  // Referência ao insumo
  insumo_id: string;
  nome_insumo: string;
  
  // Dose diária total (por dia)
  dose_diaria: number;
  unidade_dose: 'mg' | 'mcg' | 'UI' | 'g';
  
  // Matéria-prima padrão (com potência já definida)
  materia_prima_padrao_id?: string;
}

export interface ProdutoFormulacao {
  id: string;
  codigo: string;              // Código único do produto (ex: PROD-0001)
  
  // Identificação
  nome_comercial: string;
  descricao?: string;
  
  // Dose
  dose_diaria: number;         // Quantas doses por dia (geralmente 1)
  
  // Ativos da fórmula
  ativos: ProdutoAtivoConfig[];
  
  // Configurações padrão
  tipo_capsula_padrao: TipoCapsulaIndustrial;
  capacidade_alvo: number;      // Ex: 490mg
  perfil_excipiente_id?: string;
  
  // Status
  ativo: boolean;
  
  created_at: string;
  updated_at: string;
}

// ========================================
// FÓRMULA INDUSTRIAL
// ========================================

export interface FormulaIngredienteIndustrial {
  id: string;
  
  // Referências
  insumo_id: string;
  item_id?: string;              // Matéria-prima do cadastro de itens
  
  // Identificação
  nome_interno: string;
  nome_rotulo: string;
  categoria: CategoriaInsumo;
  
  // Dose desejada (por cápsula)
  dose_por_capsula: number;
  unidade_dose: 'mg' | 'mcg' | 'UI' | 'g';
  
  // Potência do insumo
  tipo_potencia: TipoPotencia;
  valor_potencia?: number;
  
  // PESO A PESAR (calculado automaticamente)
  // peso_a_pesar = dose_por_capsula / potencia
  peso_a_pesar_mg: number;
  
  // CUSTO
  custo_por_kg?: number;         // Custo do insumo por kg
  custo_por_capsula?: number;    // Custo deste ingrediente por cápsula
  
  // Flags
  higroscopico: boolean;
  nivel_higroscopicidade?: NivelHigroscopicidade;
  
  // Ordem no rótulo/ficha
  ordem: number;
}

export interface FormulaExcipienteIndustrial {
  id: string;
  nome: string;
  tipo: 'PERCENTUAL_FIXO' | 'QSP';
  valor_percentual?: number;
  peso_mg: number;               // Peso calculado em mg
  custo_por_kg?: number;         // Custo do excipiente por kg
  custo_por_capsula?: number;    // Custo deste excipiente por cápsula
}

export interface AlertaFormulaIndustrial {
  tipo: TipoAlertaFormula;
  mensagem: string;
  severidade: SeveridadeAlerta;
  ingrediente_id?: string;
  sugestoes?: string[];
}

export interface FormulaIndustrial {
  id: string;
  codigo: string;                // Código único (ex: FRM-0001)
  
  // Vínculo com produto
  produto_id?: string;
  produto_nome?: string;
  
  // Identificação
  nome: string;
  descricao?: string;
  
  // Configuração de dose
  capsulas_por_dose: number;     // 1 ou 2 cápsulas por dose
  numero_doses: number;          // Quantidade total de doses (ex: 30)
  
  // Tipo de cápsula
  tipo_capsula: TipoCapsulaIndustrial;
  capacidade_alvo_mg: number;    // Capacidade alvo da cápsula
  
  // Ingredientes ativos
  ingredientes: FormulaIngredienteIndustrial[];
  
  // Excipientes (do perfil ou customizados)
  perfil_excipiente_id?: string;
  excipientes: FormulaExcipienteIndustrial[];
  
  // CÁLCULOS AUTOMÁTICOS
  total_ativos_mg: number;           // Soma dos pesos a pesar dos ativos
  total_excipientes_fixos_mg: number; // Soma dos excipientes fixos (não QSP)
  qsp_mg: number;                     // Q.S.P. calculado
  peso_total_capsula_mg: number;      // Peso total final por cápsula
  percentual_ocupacao: number;        // % de ocupação da cápsula
  
  // CUSTO
  custo_total_capsula?: number;      // Custo total por cápsula (R$)
  custo_total_lote?: number;         // Custo total do lote (R$)
  
  // Status de ocupação
  status_ocupacao: 'OK' | 'ATENCAO' | 'NAO_CABE';
  
  // Alertas
  alertas: AlertaFormulaIndustrial[];
  
  // Versionamento
  versao: number;
  versao_anterior_id?: string;
  status: StatusFormulaIndustrial;
  
  // Metadados
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// ========================================
// FUNÇÕES DE CÁLCULO
// ========================================

/**
 * Converte dose para mg
 */
export function converterParaMg(valor: number, unidade: 'mg' | 'mcg' | 'UI' | 'g'): number {
  switch (unidade) {
    case 'g':
      return valor * 1000;
    case 'mcg':
      return valor / 1000;
    case 'UI':
      // UI genérico - usar fator médio conservador
      // Vitamina D: 1 UI = 0.025 mcg = 0.000025 mg
      // Para ser seguro, retornamos um fator que precisa ser ajustado pela potência
      return valor * 0.000025;
    case 'mg':
    default:
      return valor;
  }
}

/**
 * Calcula o peso a pesar considerando a potência do ativo
 */
export function calcularPesoAPesar(
  dose_desejada: number,
  unidade_dose: 'mg' | 'mcg' | 'UI' | 'g',
  tipo_potencia: TipoPotencia,
  valor_potencia?: number,
  percentual_elementar?: number
): { peso_mg: number; erro?: string } {
  
  // Converter dose para mg
  let dose_mg = converterParaMg(dose_desejada, unidade_dose);
  
  // Se tem percentual elementar, ajustar (para minerais)
  if (percentual_elementar && percentual_elementar > 0 && percentual_elementar < 100) {
    dose_mg = dose_mg / (percentual_elementar / 100);
  }
  
  // Aplicar potência
  switch (tipo_potencia) {
    case 'NENHUMA':
      // Excipiente - não tem ajuste de potência
      return { peso_mg: dose_mg };
      
    case 'PERCENTUAL':
      // Potência em % (ex: 0.2% = 0.002)
      if (!valor_potencia || valor_potencia <= 0) {
        return { peso_mg: 0, erro: 'Potência percentual não informada' };
      }
      return { peso_mg: dose_mg / valor_potencia };
      
    case 'UI_POR_GRAMA':
      // Potência em UI/g (ex: 100.000 UI/g)
      if (!valor_potencia || valor_potencia <= 0) {
        return { peso_mg: 0, erro: 'Potência UI/g não informada' };
      }
      // dose em UI, potência em UI/g -> peso em g -> converter para mg
      const peso_g = dose_desejada / valor_potencia;
      return { peso_mg: peso_g * 1000 };
      
    case 'MG_POR_GRAMA':
      // Potência em mg/g (ex: 500 mg/g)
      if (!valor_potencia || valor_potencia <= 0) {
        return { peso_mg: 0, erro: 'Potência mg/g não informada' };
      }
      // dose em mg, potência em mg/g -> peso em g -> converter para mg
      const peso_g_mg = dose_mg / valor_potencia;
      return { peso_mg: peso_g_mg * 1000 };
      
    default:
      return { peso_mg: dose_mg };
  }
}

/**
 * Calcula Q.S.P. automático
 */
export function calcularQSPIndustrial(
  capacidade_alvo: number,
  total_ativos: number,
  total_excipientes_fixos: number
): number {
  const qsp = capacidade_alvo - total_ativos - total_excipientes_fixos;
  return Math.max(0, qsp);
}

/**
 * Calcula os excipientes baseado no perfil
 */
export function calcularExcipientes(
  perfil: PerfilExcipiente,
  capacidade_alvo: number,
  total_ativos: number
): FormulaExcipienteIndustrial[] {
  const resultado: FormulaExcipienteIndustrial[] = [];
  let total_fixos = 0;
  
  // Primeiro, calcular os fixos (percentuais)
  perfil.itens
    .filter(item => item.tipo === 'PERCENTUAL_FIXO' && item.valor_percentual)
    .forEach(item => {
      const peso = capacidade_alvo * (item.valor_percentual! / 100);
      total_fixos += peso;
      resultado.push({
        id: crypto.randomUUID(),
        nome: item.nome,
        tipo: 'PERCENTUAL_FIXO',
        valor_percentual: item.valor_percentual,
        peso_mg: Math.round(peso * 100) / 100,
      });
    });
  
  // Depois, calcular o Q.S.P.
  const qsp_item = perfil.itens.find(item => item.tipo === 'QSP');
  if (qsp_item) {
    const qsp = calcularQSPIndustrial(capacidade_alvo, total_ativos, total_fixos);
    resultado.push({
      id: crypto.randomUUID(),
      nome: qsp_item.nome,
      tipo: 'QSP',
      peso_mg: Math.round(qsp * 100) / 100,
    });
  }
  
  return resultado;
}

/**
 * Gera alertas automáticos para a fórmula
 */
export function gerarAlertasFormula(formula: Partial<FormulaIndustrial>): AlertaFormulaIndustrial[] {
  const alertas: AlertaFormulaIndustrial[] = [];
  
  const capacidade = formula.capacidade_alvo_mg || 0;
  const pesoTotal = formula.peso_total_capsula_mg || 0;
  const ingredientes = formula.ingredientes || [];
  
  // Alerta: Excede capacidade
  if (pesoTotal > capacidade) {
    alertas.push({
      tipo: 'EXCEDE_CAPACIDADE',
      mensagem: `Fórmula não cabe na cápsula. Total: ${pesoTotal.toFixed(1)}mg > Capacidade: ${capacidade}mg`,
      severidade: 'error',
      sugestoes: [
        'Aumentar cápsulas por dose (de 1 para 2)',
        'Trocar para cápsula maior',
        'Reduzir dose de ativos',
        'Usar ativo com maior potência',
      ],
    });
  }
  
  // Alerta: Ingredientes higroscópicos
  const higroscopicos = ingredientes.filter(i => i.higroscopico);
  if (higroscopicos.length > 0) {
    const nomes = higroscopicos.map(h => h.nome_interno).join(', ');
    const nivelAlto = higroscopicos.some(h => h.nivel_higroscopicidade === 'ALTO');
    
    alertas.push({
      tipo: 'HIGROSCOPICO_DETECTADO',
      mensagem: `${higroscopicos.length} ingrediente(s) higroscópico(s) detectado(s): ${nomes}`,
      severidade: nivelAlto ? 'error' : 'warning',
      sugestoes: [
        'Adicionar sílica (Dióxido de Silício) se não houver',
        'Manipular em ambiente com umidade controlada (<40%)',
        'Encapsular rapidamente após mistura',
        'Usar embalagem com barreira de umidade',
      ],
    });
  }
  
  // Alerta: Potência ausente em ativo
  ingredientes
    .filter(i => i.categoria === 'ATIVO' && i.tipo_potencia !== 'NENHUMA')
    .forEach(ing => {
      if (!ing.valor_potencia || ing.valor_potencia <= 0) {
        alertas.push({
          tipo: 'POTENCIA_AUSENTE',
          mensagem: `Potência não informada para "${ing.nome_interno}". Não é possível calcular peso a pesar.`,
          severidade: 'error',
          ingrediente_id: ing.id,
        });
      }
    });
  
  // Alerta: Capacidade muito baixa (< 50%)
  const percentOcupacao = capacidade > 0 ? (pesoTotal / capacidade) * 100 : 0;
  if (percentOcupacao < 50 && percentOcupacao > 0) {
    alertas.push({
      tipo: 'CAPACIDADE_BAIXA',
      mensagem: `Ocupação baixa (${percentOcupacao.toFixed(0)}%). Considere usar cápsula menor.`,
      severidade: 'info',
    });
  }
  
  // Alerta: Q.S.P. negativo
  if ((formula.qsp_mg || 0) < 0) {
    alertas.push({
      tipo: 'QSP_NEGATIVO',
      mensagem: 'Q.S.P. negativo - fórmula excede capacidade da cápsula',
      severidade: 'error',
    });
  }
  
  return alertas;
}

/**
 * Determina status de ocupação
 */
export function determinarStatusOcupacao(
  pesoTotal: number,
  capacidade: number
): 'OK' | 'ATENCAO' | 'NAO_CABE' {
  if (pesoTotal > capacidade) {
    return 'NAO_CABE';
  }
  const percentual = (pesoTotal / capacidade) * 100;
  if (percentual > 95) {
    return 'ATENCAO';
  }
  return 'OK';
}

/**
 * Calcula custo por cápsula baseado no peso em mg e custo por kg
 */
export function calcularCustoPorCapsula(
  peso_mg: number,
  custo_por_kg?: number
): number {
  if (!custo_por_kg || custo_por_kg <= 0) return 0;
  // peso_mg / 1000 = peso_g, peso_g / 1000 = peso_kg
  // custo = peso_kg * custo_por_kg
  const peso_kg = peso_mg / 1_000_000;
  return peso_kg * custo_por_kg;
}

// ========================================
// VALORES DIÁRIOS DE REFERÊNCIA (RDC 360)
// ========================================

export const VD_REFERENCIA_INDUSTRIAL: Record<string, { valor: number; unidade: string }> = {
  'Vitamina A': { valor: 600, unidade: 'mcg' },
  'Vitamina D': { valor: 5, unidade: 'mcg' },
  'Vitamina D3': { valor: 5, unidade: 'mcg' },
  'Vitamina E': { valor: 10, unidade: 'mg' },
  'Vitamina K': { valor: 65, unidade: 'mcg' },
  'Vitamina K2': { valor: 65, unidade: 'mcg' },
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
