// ============================================================
// TIPOS: VALIDADOR LEGAL AUTOMÁTICO ANVISA
// ============================================================

export type TipoEntidadeValidacao = 'FORMULA' | 'OP' | 'INSUMO';
export type ResultadoValidacao = 'OK' | 'ALERTA' | 'BLOQUEIO';

export interface LogValidacaoANVISA {
  id: string;
  tipo_entidade: TipoEntidadeValidacao;
  entidade_id: string;
  entidade_codigo: string;
  resultado: ResultadoValidacao;
  regra_aplicada: string;
  descricao: string;
  fonte_legal?: string;
  dados_validacao?: Record<string, any>;
  acao_sistema?: string;
  usuario_responsavel?: string;
  created_at: string;
}

export interface RegraANVISA {
  id: string;
  substancia: string;
  substancia_normalizada: string;
  dose_maxima_diaria_mg?: number;
  dose_maxima_por_porcao_mg?: number;
  formas_permitidas: ('CAPSULA' | 'LIQUIDO' | 'PO')[];
  alegacoes_permitidas: string[];
  alegacoes_proibidas: string[];
  avisos_rotulo: string[];
  fonte_legal: string;
  data_publicacao?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface ResultadoValidacaoCompleta {
  aprovado: boolean;
  resultado_geral: ResultadoValidacao;
  validacoes: ValidacaoItem[];
  bloqueios: ValidacaoItem[];
  alertas: ValidacaoItem[];
  alegacoes_disponiveis: string[];
  avisos_obrigatorios: string[];
}

export interface ValidacaoItem {
  substancia: string;
  regra: string;
  resultado: ResultadoValidacao;
  descricao: string;
  fonte_legal?: string;
  valor_informado?: number;
  valor_limite?: number;
  unidade?: string;
}

// ============================================================
// HELPERS: NORMALIZAÇÃO DE SUBSTÂNCIAS
// ============================================================

const NORMALIZACAO_SUBSTANCIAS: Record<string, string> = {
  'vitamina d': 'VITAMINA_D',
  'vitamina d3': 'VITAMINA_D',
  'colecalciferol': 'VITAMINA_D',
  'vitamina c': 'VITAMINA_C',
  'ácido ascórbico': 'VITAMINA_C',
  'acido ascorbico': 'VITAMINA_C',
  'vitamina e': 'VITAMINA_E',
  'tocoferol': 'VITAMINA_E',
  'alfa-tocoferol': 'VITAMINA_E',
  'vitamina a': 'VITAMINA_A',
  'retinol': 'VITAMINA_A',
  'melatonina': 'MELATONINA',
  'zinco': 'ZINCO',
  'sulfato de zinco': 'ZINCO',
  'óxido de zinco': 'ZINCO',
  'magnésio': 'MAGNESIO',
  'magnesio': 'MAGNESIO',
  'cloreto de magnésio': 'MAGNESIO',
  'omega 3': 'OMEGA_3',
  'ômega 3': 'OMEGA_3',
  'óleo de peixe': 'OMEGA_3',
  'colágeno': 'COLAGENO',
  'colageno': 'COLAGENO',
  'colágeno hidrolisado': 'COLAGENO',
  'cafeína': 'CAFEINA',
  'cafeina': 'CAFEINA',
};

export function normalizarSubstancia(nome: string): string {
  const nomeNormalizado = nome.toLowerCase().trim();
  return NORMALIZACAO_SUBSTANCIAS[nomeNormalizado] || nomeNormalizado.toUpperCase().replace(/\s+/g, '_');
}

export function buscarRegrasPorSubstancia(
  substanciaNormalizada: string,
  regras: RegraANVISA[]
): RegraANVISA | undefined {
  return regras.find(
    r => r.substancia_normalizada === substanciaNormalizada && r.ativo
  );
}

// ============================================================
// VALIDAÇÃO AUTOMÁTICA
// ============================================================

export interface ItemParaValidar {
  nome: string;
  quantidade_mg: number;
  unidade: 'MG' | 'MCG' | 'UI' | 'G' | 'ML';
}

export function validarFormula(
  itens: ItemParaValidar[],
  tipoApresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO',
  regrasANVISA: RegraANVISA[]
): ResultadoValidacaoCompleta {
  const validacoes: ValidacaoItem[] = [];
  const bloqueios: ValidacaoItem[] = [];
  const alertas: ValidacaoItem[] = [];
  const alegacoesDisponiveis: string[] = [];
  const avisosObrigatorios: string[] = [];

  for (const item of itens) {
    const substanciaNormalizada = normalizarSubstancia(item.nome);
    const regra = buscarRegrasPorSubstancia(substanciaNormalizada, regrasANVISA);

    if (!regra) {
      // Sem regra específica - OK com alerta
      validacoes.push({
        substancia: item.nome,
        regra: 'REGRA_NAO_ENCONTRADA',
        resultado: 'ALERTA',
        descricao: `Substância "${item.nome}" não possui regra ANVISA cadastrada. Verificar manualmente.`,
      });
      alertas.push(validacoes[validacoes.length - 1]);
      continue;
    }

    // Validar forma permitida
    if (!regra.formas_permitidas.includes(tipoApresentacao)) {
      const validacao: ValidacaoItem = {
        substancia: item.nome,
        regra: 'FORMA_NAO_PERMITIDA',
        resultado: 'BLOQUEIO',
        descricao: `Forma "${tipoApresentacao}" não permitida para ${item.nome}. Formas permitidas: ${regra.formas_permitidas.join(', ')}`,
        fonte_legal: regra.fonte_legal,
      };
      validacoes.push(validacao);
      bloqueios.push(validacao);
      continue;
    }

    // Validar dose máxima
    if (regra.dose_maxima_diaria_mg && item.quantidade_mg > regra.dose_maxima_diaria_mg) {
      const validacao: ValidacaoItem = {
        substancia: item.nome,
        regra: 'DOSE_MAXIMA_EXCEDIDA',
        resultado: 'BLOQUEIO',
        descricao: `Dose de ${item.quantidade_mg.toFixed(4)} mg excede limite máximo de ${regra.dose_maxima_diaria_mg} mg/dia`,
        fonte_legal: regra.fonte_legal,
        valor_informado: item.quantidade_mg,
        valor_limite: regra.dose_maxima_diaria_mg,
        unidade: 'mg',
      };
      validacoes.push(validacao);
      bloqueios.push(validacao);
    } else if (regra.dose_maxima_diaria_mg && item.quantidade_mg > regra.dose_maxima_diaria_mg * 0.9) {
      // Alerta se > 90% do limite
      const validacao: ValidacaoItem = {
        substancia: item.nome,
        regra: 'DOSE_PROXIMA_LIMITE',
        resultado: 'ALERTA',
        descricao: `Dose de ${item.quantidade_mg.toFixed(4)} mg está próxima do limite máximo (${regra.dose_maxima_diaria_mg} mg/dia)`,
        fonte_legal: regra.fonte_legal,
        valor_informado: item.quantidade_mg,
        valor_limite: regra.dose_maxima_diaria_mg,
        unidade: 'mg',
      };
      validacoes.push(validacao);
      alertas.push(validacao);
    } else {
      // OK
      validacoes.push({
        substancia: item.nome,
        regra: 'DOSE_DENTRO_LIMITE',
        resultado: 'OK',
        descricao: `Dose de ${item.quantidade_mg.toFixed(4)} mg dentro do limite permitido`,
        fonte_legal: regra.fonte_legal,
        valor_informado: item.quantidade_mg,
        valor_limite: regra.dose_maxima_diaria_mg,
        unidade: 'mg',
      });
    }

    // Coletar alegações disponíveis
    alegacoesDisponiveis.push(...regra.alegacoes_permitidas);
    
    // Coletar avisos obrigatórios
    avisosObrigatorios.push(...regra.avisos_rotulo);
  }

  const resultadoGeral: ResultadoValidacao = bloqueios.length > 0 
    ? 'BLOQUEIO' 
    : alertas.length > 0 
      ? 'ALERTA' 
      : 'OK';

  return {
    aprovado: bloqueios.length === 0,
    resultado_geral: resultadoGeral,
    validacoes,
    bloqueios,
    alertas,
    alegacoes_disponiveis: [...new Set(alegacoesDisponiveis)],
    avisos_obrigatorios: [...new Set(avisosObrigatorios)],
  };
}
