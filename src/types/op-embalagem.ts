// ============================================================
// TIPOS DE MATERIAIS DE EMBALAGEM PARA OP
// ============================================================

export type TipoMaterialEmbalagem = 
  | 'POTE'
  | 'TAMPA'
  | 'ROTULO'
  | 'LACRE'
  | 'SILICA_SACHE'
  | 'CAPSULA_VAZIA'
  | 'CAIXA'
  | 'FRASCO'
  | 'CONTA_GOTAS'
  | 'SACHE';

export interface MaterialEmbalagemOP {
  id: string;
  op_id: string;
  
  // Identificação
  tipo: TipoMaterialEmbalagem;
  descricao: string;
  insumo_id?: string;
  
  // Quantidades
  quantidade_necessaria: number;
  quantidade_separada?: number;
  quantidade_utilizada?: number;
  unidade: string;
  
  // Lote vinculado
  lote_id?: string;
  numero_lote?: string;
  fornecedor_nome?: string;
  
  // Controle
  separado: boolean;
  separado_por?: string;
  separado_em?: string;
  conferido_por?: string;
  
  observacoes?: string;
  created_at: string;
}

// Função para calcular materiais de embalagem necessários
export function calcularMateriaisEmbalagem(
  tipoApresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO',
  quantidadeFrascos: number,
  capsulaPorFrasco?: number
): Array<{ tipo: TipoMaterialEmbalagem; descricao: string; quantidade: number; unidade: string }> {
  const materiais: Array<{ tipo: TipoMaterialEmbalagem; descricao: string; quantidade: number; unidade: string }> = [];
  
  if (tipoApresentacao === 'CAPSULA') {
    // Cápsulas vazias
    const totalCapsulas = quantidadeFrascos * (capsulaPorFrasco || 60);
    const capsulasMaisAcrescimo = Math.ceil(totalCapsulas * 1.10); // 10% de reserva
    materiais.push({
      tipo: 'CAPSULA_VAZIA',
      descricao: 'Cápsula Gelatinosa Tamanho 00',
      quantidade: capsulasMaisAcrescimo,
      unidade: 'un'
    });
  }
  
  // Potes/Frascos
  const frascosMaisReserva = Math.ceil(quantidadeFrascos * 1.05); // 5% de reserva
  materiais.push({
    tipo: tipoApresentacao === 'LIQUIDO' ? 'FRASCO' : 'POTE',
    descricao: tipoApresentacao === 'LIQUIDO' ? 'Frasco Vidro Âmbar 30mL' : 'Pote Plástico PEAD Branco',
    quantidade: frascosMaisReserva,
    unidade: 'un'
  });
  
  // Tampas
  materiais.push({
    tipo: 'TAMPA',
    descricao: tipoApresentacao === 'LIQUIDO' ? 'Tampa Conta-Gotas' : 'Tampa Rosca com Lacre Indução',
    quantidade: frascosMaisReserva,
    unidade: 'un'
  });
  
  // Rótulos
  materiais.push({
    tipo: 'ROTULO',
    descricao: 'Rótulo Adesivo Personalizado',
    quantidade: frascosMaisReserva,
    unidade: 'un'
  });
  
  // Lacres
  materiais.push({
    tipo: 'LACRE',
    descricao: 'Lacre Termoencolhível',
    quantidade: frascosMaisReserva,
    unidade: 'un'
  });
  
  // Sachês de sílica (para cápsulas e pó)
  if (tipoApresentacao !== 'LIQUIDO') {
    materiais.push({
      tipo: 'SILICA_SACHE',
      descricao: 'Sachê Sílica Gel 1g',
      quantidade: frascosMaisReserva,
      unidade: 'un'
    });
  }
  
  return materiais;
}

// Categorias de materiais para separação
export const CATEGORIAS_SEPARACAO = {
  MATERIAS_PRIMAS: {
    nome: 'Matérias-Primas',
    descricao: 'Ativos e excipientes',
    ordem: 1,
  },
  EXCIPIENTES_TECNOLOGICOS: {
    nome: 'Excipientes Tecnológicos',
    descricao: 'Sílica, Talco, Estearato',
    ordem: 2,
  },
  EMBALAGEM_PRIMARIA: {
    nome: 'Embalagem Primária',
    descricao: 'Potes, frascos, cápsulas vazias',
    ordem: 3,
  },
  EMBALAGEM_SECUNDARIA: {
    nome: 'Embalagem Secundária',
    descricao: 'Tampas, rótulos, lacres',
    ordem: 4,
  },
  ACESSORIOS: {
    nome: 'Acessórios',
    descricao: 'Sachês de sílica, conta-gotas',
    ordem: 5,
  },
} as const;
