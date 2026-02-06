import { useState, useEffect, useCallback, useMemo } from 'react';
import { LocalDb } from '@/lib/local-db';
import { useLotes } from '@/hooks/use-lotes';
import { 
  OrdemProducaoIndustrial, 
  StatusOP,
  gerarCodigoOP,
  gerarLoteProdutoAcabado,
  classificarPesagem,
  gerarDistribuicaoGeometrica,
  calcularTolerancia,
  calcularRendimento,
  ItemPesagem,
  AlocacaoLoteOP,
  ControleQualidadeOP,
  ProcedimentoDistribuicaoGeometrica,
} from '@/types/ordem-producao-industrial';
import { 
  EXCIPIENTES_INDUSTRIAIS, 
  VEICULOS_BASE,
  gerarOrdemMistura,
  calcularCapsulaIndustrial,
} from '@/lib/formulador-industrial-rules';
import { toast } from 'sonner';

const COLLECTION = 'ordens_producao_industrial' as any;

// ============================================================
// GERAÇÃO DE CÓDIGO
// ============================================================

function generateOPCode(): string {
  const ops = LocalDb.getCollection<OrdemProducaoIndustrial>(COLLECTION);
  const ano = new Date().getFullYear();
  const opsDoAno = ops.filter(op => op.codigo.startsWith(`OP-${ano}-`));
  const maxNum = opsDoAno.reduce((max, op) => {
    const match = op.codigo.match(/^OP-\d{4}-(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return gerarCodigoOP(ano, maxNum + 1);
}

function generateLoteCode(): string {
  const ops = LocalDb.getCollection<OrdemProducaoIndustrial>(COLLECTION);
  const hoje = new Date();
  const prefix = gerarLoteProdutoAcabado(hoje, 1).split('-')[0];
  const lotesHoje = ops.filter(op => op.lote_produto_acabado?.startsWith(prefix));
  return gerarLoteProdutoAcabado(hoje, lotesHoje.length + 1);
}

// ============================================================
// HOOK: LISTAR OPs
// ============================================================

export function useOrdensProducaoIndustrial(filters?: { status?: StatusOP }) {
  const [ordens, setOrdens] = useState<OrdemProducaoIndustrial[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    let data = LocalDb.getCollection<OrdemProducaoIndustrial>(COLLECTION);
    
    if (filters?.status) {
      data = data.filter(op => op.status === filters.status);
    }
    
    data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setOrdens(data);
    setLoading(false);
  }, [filters?.status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection;
      if (!collection || collection === '*' || collection === COLLECTION) {
        refresh();
      }
    };
    window.addEventListener('localdb:change', handler);
    return () => window.removeEventListener('localdb:change', handler);
  }, [refresh]);

  const stats = useMemo(() => {
    const todas = LocalDb.getCollection<OrdemProducaoIndustrial>(COLLECTION);
    return {
      total: todas.length,
      planejadas: todas.filter(op => op.status === 'PLANEJADA').length,
      aguardando: todas.filter(op => op.status === 'AGUARDANDO_MATERIAIS').length,
      emProducao: todas.filter(op => op.status === 'EM_PRODUCAO').length,
      finalizadas: todas.filter(op => op.status === 'FINALIZADA').length,
      bloqueadas: todas.filter(op => op.status === 'BLOQUEADA').length,
    };
  }, [ordens]);

  return { data: ordens, isLoading: loading, refresh, stats };
}

// ============================================================
// HOOK: OP INDIVIDUAL
// ============================================================

export function useOrdemProducaoIndustrial(id: string | undefined) {
  const [ordem, setOrdem] = useState<OrdemProducaoIndustrial | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setOrdem(null);
      setLoading(false);
      return;
    }
    const data = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, id);
    setOrdem(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ordem, isLoading: loading, refresh };
}

// ============================================================
// INTERFACE: CRIAR OP A PARTIR DE FÓRMULA
// ============================================================

export interface CriarOPParams {
  formula: {
    id: string;
    codigo_formula: string;
    nome_formula: string;
    versao: number;
    tipo_apresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO';
    peso_capsula_alvo_mg?: number;
    excipiente_padrao?: string;
    itens: Array<{
      id: string;
      nome_insumo: string;
      quantidade_convertida_mg: number;
      unidade_informada: string;
      ativo_critico: boolean;
      exige_premix: boolean;
    }>;
  };
  quantidade_unidades: number;
  data_planejada?: string;
  responsavel_tecnico?: string;
  observacoes?: string;
}

// ============================================================
// HOOK: CRIAR OP
// ============================================================

export function useCreateOrdemProducaoIndustrial() {
  const criarOP = useCallback((params: CriarOPParams): OrdemProducaoIndustrial | null => {
    const { formula, quantidade_unidades, data_planejada, responsavel_tecnico, observacoes } = params;
    
    // Acréscimo de produção: 5%
    const acrescimo = 5;
    const quantidadeComAcrescimo = Math.ceil(quantidade_unidades * (1 + acrescimo / 100));
    
    // Calcular cápsula industrial
    const totalAtivos = formula.itens.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
    const veiculoCodigo = (formula.excipiente_padrao || 'AMIDO') as 'AMIDO' | 'CELULOSE' | 'PRE_BLEND';
    const calculos = calcularCapsulaIndustrial(totalAtivos, veiculoCodigo, formula.peso_capsula_alvo_mg || 490);
    
    // Gerar itens de pesagem
    const itensPesagem: ItemPesagem[] = [];
    let ordem = 1;
    
    // Identificar ativos críticos para diluição geométrica
    const ativosCriticos = formula.itens.filter(i => i.ativo_critico);
    const procedimentosDiluicao: ProcedimentoDistribuicaoGeometrica[] = [];
    
    // Ativos com pré-mix primeiro
    formula.itens.filter(i => i.exige_premix).forEach(item => {
      const classificacao = classificarPesagem(item.quantidade_convertida_mg, item.unidade_informada);
      const quantidadeLoteG = (item.quantidade_convertida_mg * quantidadeComAcrescimo) / 1000;
      const tolerancia = calcularTolerancia(quantidadeLoteG);
      
      itensPesagem.push({
        id: crypto.randomUUID(),
        op_id: '',
        ordem: ordem++,
        insumo_id: item.id,
        insumo_nome: item.nome_insumo,
        categoria: 'PREMIX',
        tipo_pesagem: classificacao.tipo,
        motivo_critico: classificacao.motivo,
        quantidade_formula_mg: item.quantidade_convertida_mg,
        quantidade_lote_g: quantidadeLoteG,
        tolerancia_percentual: 10,
        quantidade_minima_g: tolerancia.minimo,
        quantidade_maxima_g: tolerancia.maximo,
      });
      
      // Gerar procedimento de diluição geométrica
      if (item.ativo_critico) {
        procedimentosDiluicao.push(
          gerarDistribuicaoGeometrica(
            item.nome_insumo,
            item.quantidade_convertida_mg * quantidadeComAcrescimo,
            VEICULOS_BASE[veiculoCodigo].nome,
            calculos.veiculo_base_mg * quantidadeComAcrescimo / 1000
          )
        );
      }
    });
    
    // Ativos sem pré-mix
    formula.itens.filter(i => !i.exige_premix).forEach(item => {
      const classificacao = classificarPesagem(item.quantidade_convertida_mg, item.unidade_informada);
      const quantidadeLoteG = (item.quantidade_convertida_mg * quantidadeComAcrescimo) / 1000;
      const tolerancia = calcularTolerancia(quantidadeLoteG);
      
      itensPesagem.push({
        id: crypto.randomUUID(),
        op_id: '',
        ordem: ordem++,
        insumo_id: item.id,
        insumo_nome: item.nome_insumo,
        categoria: 'ATIVO',
        tipo_pesagem: classificacao.tipo,
        motivo_critico: classificacao.motivo,
        quantidade_formula_mg: item.quantidade_convertida_mg,
        quantidade_lote_g: quantidadeLoteG,
        tolerancia_percentual: 10,
        quantidade_minima_g: tolerancia.minimo,
        quantidade_maxima_g: tolerancia.maximo,
      });
      
      // Gerar procedimento de diluição geométrica para ativos críticos sem pré-mix
      if (item.ativo_critico && !item.exige_premix) {
        procedimentosDiluicao.push(
          gerarDistribuicaoGeometrica(
            item.nome_insumo,
            item.quantidade_convertida_mg * quantidadeComAcrescimo,
            VEICULOS_BASE[veiculoCodigo].nome,
            calculos.veiculo_base_mg * quantidadeComAcrescimo / 1000
          )
        );
      }
    });
    
    // Veículo base
    const qspLoteG = (calculos.veiculo_base_mg * quantidadeComAcrescimo) / 1000;
    const tolQsp = calcularTolerancia(qspLoteG);
    itensPesagem.push({
      id: crypto.randomUUID(),
      op_id: '',
      ordem: ordem++,
      insumo_nome: calculos.veiculo_base_nome,
      categoria: 'VEICULO_BASE',
      tipo_pesagem: 'PADRAO',
      quantidade_formula_mg: calculos.veiculo_base_mg,
      quantidade_lote_g: qspLoteG,
      tolerancia_percentual: 10,
      quantidade_minima_g: tolQsp.minimo,
      quantidade_maxima_g: tolQsp.maximo,
    });
    
    // Excipientes tecnológicos (ordem fixa: Talco, Sílica, Estearato)
    const excOrdenados = [...calculos.excipientes_tecnologicos].sort((a, b) => a.ordem_mistura - b.ordem_mistura);
    excOrdenados.forEach(exc => {
      const qtdLoteG = (exc.quantidade_mg * quantidadeComAcrescimo) / 1000;
      const tol = calcularTolerancia(qtdLoteG);
      itensPesagem.push({
        id: crypto.randomUUID(),
        op_id: '',
        ordem: ordem++,
        insumo_nome: exc.nome,
        categoria: 'TECNOLOGICO',
        tipo_pesagem: 'PADRAO',
        quantidade_formula_mg: exc.quantidade_mg,
        quantidade_lote_g: qtdLoteG,
        tolerancia_percentual: 10,
        quantidade_minima_g: tol.minimo,
        quantidade_maxima_g: tol.maximo,
      });
    });
    
    // Calcular custo (placeholder)
    const custoTotal = 0; // Será calculado após alocação de lotes
    
    const novaOP: Omit<OrdemProducaoIndustrial, 'id' | 'created_at'> = {
      codigo: generateOPCode(),
      formula_id: formula.id,
      formula_codigo: formula.codigo_formula,
      formula_versao: formula.versao,
      produto_nome: formula.nome_formula,
      tipo_apresentacao: formula.tipo_apresentacao,
      peso_unidade_mg: formula.peso_capsula_alvo_mg,
      quantidade_planejada: quantidade_unidades,
      acrescimo_producao_percentual: acrescimo,
      quantidade_com_acrescimo: quantidadeComAcrescimo,
      lote_produto_acabado: generateLoteCode(),
      data_fabricacao: new Date().toISOString().split('T')[0],
      responsavel_tecnico,
      data_planejada,
      status: 'PLANEJADA',
      alocacoes_lote: [],
      itens_pesagem: itensPesagem,
      procedimentos_diluicao: procedimentosDiluicao,
      custo_total_insumos: custoTotal,
      custo_por_unidade: 0,
      lotes_mp_origem: [],
      observacoes,
      updated_at: new Date().toISOString(),
    };
    
    // Atualizar IDs dos itens de pesagem
    const opId = crypto.randomUUID();
    novaOP.itens_pesagem = novaOP.itens_pesagem.map(item => ({ ...item, op_id: opId }));
    
    const op = LocalDb.insert<OrdemProducaoIndustrial>(COLLECTION, { ...novaOP, id: opId } as any);
    toast.success(`OP ${op.codigo} criada com sucesso`);
    return op;
  }, []);

  return { criarOP };
}

// ============================================================
// HOOK: AÇÕES DA OP
// ============================================================

export function useOrdemProducaoIndustrialActions() {
  
  // Iniciar produção
  const iniciarProducao = useCallback((id: string) => {
    const op = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, id);
    if (!op) return null;
    
    // Verificar se todos os lotes estão alocados
    const todosAlocados = op.itens_pesagem.every(item => 
      item.categoria === 'TECNOLOGICO' || 
      item.categoria === 'VEICULO_BASE' || 
      op.alocacoes_lote.some(a => a.insumo_id === item.insumo_id && a.status !== 'PENDENTE')
    );
    
    const updated = LocalDb.update<OrdemProducaoIndustrial>(COLLECTION, id, {
      status: 'EM_PRODUCAO',
      data_inicio: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.success(`Produção ${op.codigo} iniciada`);
    }
    return updated;
  }, []);

  // Registrar pesagem
  const registrarPesagem = useCallback((
    opId: string,
    itemPesagemId: string,
    quantidadePesada: number,
    pesadoPor: string,
    conferidoPor?: string,
    loteId?: string,
    numeroLote?: string
  ) => {
    const op = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, opId);
    if (!op) return null;
    
    const itemIndex = op.itens_pesagem.findIndex(i => i.id === itemPesagemId);
    if (itemIndex === -1) return null;
    
    const item = op.itens_pesagem[itemIndex];
    const dentroTolerancia = quantidadePesada >= item.quantidade_minima_g && 
                              quantidadePesada <= item.quantidade_maxima_g;
    
    // Para pesagem crítica, conferido_por é obrigatório
    if (item.tipo_pesagem === 'CRITICA' && !conferidoPor) {
      toast.error('Pesagem crítica requer dupla conferência');
      return null;
    }
    
    const itensPesagemAtualizados = [...op.itens_pesagem];
    itensPesagemAtualizados[itemIndex] = {
      ...item,
      quantidade_pesada_g: quantidadePesada,
      dentro_tolerancia: dentroTolerancia,
      tolerancia_utilizada: !dentroTolerancia && Math.abs(quantidadePesada - item.quantidade_lote_g) / item.quantidade_lote_g <= 0.1,
      pesado_por: pesadoPor,
      conferido_por: conferidoPor,
      pesado_em: new Date().toISOString(),
      lote_id: loteId,
      numero_lote: numeroLote,
    };
    
    const updated = LocalDb.update<OrdemProducaoIndustrial>(COLLECTION, opId, {
      itens_pesagem: itensPesagemAtualizados,
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.success(`Pesagem de ${item.insumo_nome} registrada`);
    }
    return updated;
  }, []);

  // Alocar lote
  const alocarLote = useCallback((
    opId: string,
    insumoId: string,
    insumoNome: string,
    loteId: string,
    numeroLote: string,
    fornecedorNome: string,
    quantidadeNecessaria: number,
    custoUnitario: number
  ) => {
    const op = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, opId);
    if (!op) return null;
    
    const novaAlocacao: AlocacaoLoteOP = {
      id: crypto.randomUUID(),
      op_id: opId,
      insumo_id: insumoId,
      insumo_nome: insumoNome,
      lote_id: loteId,
      numero_lote: numeroLote,
      fornecedor_nome: fornecedorNome,
      quantidade_necessaria_g: quantidadeNecessaria,
      quantidade_alocada_g: quantidadeNecessaria,
      quantidade_consumida_g: 0,
      custo_unitario: custoUnitario,
      custo_total: quantidadeNecessaria * custoUnitario,
      status: 'ALOCADO',
      created_at: new Date().toISOString(),
    };
    
    const alocacoesAtualizadas = [...op.alocacoes_lote, novaAlocacao];
    const custoTotal = alocacoesAtualizadas.reduce((sum, a) => sum + a.custo_total, 0);
    
    const updated = LocalDb.update<OrdemProducaoIndustrial>(COLLECTION, opId, {
      alocacoes_lote: alocacoesAtualizadas,
      custo_total_insumos: custoTotal,
      custo_por_unidade: custoTotal / op.quantidade_planejada,
      lotes_mp_origem: [...new Set([...op.lotes_mp_origem, loteId])],
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.success(`Lote ${numeroLote} alocado para ${insumoNome}`);
    }
    return updated;
  }, []);

  // Registrar QC
  const registrarQC = useCallback((
    opId: string,
    qc: Omit<ControleQualidadeOP, 'id' | 'op_id'>
  ) => {
    const op = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, opId);
    if (!op) return null;
    
    const controleQC: ControleQualidadeOP = {
      ...qc,
      id: crypto.randomUUID(),
      op_id: opId,
    };
    
    // Se reprovado, bloquear OP
    const novoStatus = qc.status === 'REPROVADO' ? 'BLOQUEADA' : op.status;
    
    const updated = LocalDb.update<OrdemProducaoIndustrial>(COLLECTION, opId, {
      controle_qualidade: controleQC,
      status: novoStatus,
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      if (qc.status === 'APROVADO') {
        toast.success('Lote aprovado pelo Controle de Qualidade');
      } else if (qc.status === 'REPROVADO') {
        toast.error('Lote REPROVADO - OP bloqueada');
      }
    }
    return updated;
  }, []);

  // Finalizar produção
  const finalizarProducao = useCallback((
    opId: string,
    quantidadeProduzida: number,
    quantidadeAprovada: number,
    finalizadoPor: string
  ) => {
    const op = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, opId);
    if (!op) return null;
    
    // Verificar se QC foi aprovado
    if (!op.controle_qualidade || op.controle_qualidade.status !== 'APROVADO') {
      toast.error('OP não pode ser finalizada sem aprovação do QC');
      return null;
    }
    
    const controlePerdas = calcularRendimento(
      op.quantidade_planejada,
      quantidadeProduzida,
      quantidadeAprovada
    );
    
    // Atualizar status das alocações para CONSUMIDO
    const alocacoesConsumidas = op.alocacoes_lote.map(a => ({
      ...a,
      status: 'CONSUMIDO' as const,
      quantidade_consumida_g: a.quantidade_alocada_g,
      consumido_em: new Date().toISOString(),
    }));
    
    const updated = LocalDb.update<OrdemProducaoIndustrial>(COLLECTION, opId, {
      status: 'FINALIZADA',
      data_conclusao: new Date().toISOString(),
      controle_perdas: controlePerdas,
      alocacoes_lote: alocacoesConsumidas,
      finalizado_por: finalizadoPor,
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.success(`OP ${op.codigo} finalizada - Rendimento: ${controlePerdas.rendimento_percentual}%`);
    }
    return updated;
  }, []);

  // Bloquear OP
  const bloquearOP = useCallback((id: string, motivo: string) => {
    const op = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, id);
    if (!op) return null;
    
    const updated = LocalDb.update<OrdemProducaoIndustrial>(COLLECTION, id, {
      status: 'BLOQUEADA',
      observacoes: `${op.observacoes || ''}\n\n[BLOQUEIO] ${new Date().toLocaleString()}: ${motivo}`.trim(),
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.warning(`OP ${op.codigo} bloqueada`);
    }
    return updated;
  }, []);

  // Cancelar OP
  const cancelarOP = useCallback((id: string, motivo: string) => {
    const op = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, id);
    if (!op) return null;
    
    if (op.status === 'FINALIZADA') {
      toast.error('Não é possível cancelar uma OP finalizada');
      return null;
    }
    
    const updated = LocalDb.update<OrdemProducaoIndustrial>(COLLECTION, id, {
      status: 'CANCELADA',
      observacoes: `${op.observacoes || ''}\n\n[CANCELAMENTO] ${new Date().toLocaleString()}: ${motivo}`.trim(),
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.warning(`OP ${op.codigo} cancelada`);
    }
    return updated;
  }, []);

  // Excluir OP (apenas planejadas ou canceladas)
  const excluirOP = useCallback((id: string) => {
    const op = LocalDb.getById<OrdemProducaoIndustrial>(COLLECTION, id);
    if (!op) return false;
    
    if (op.status !== 'PLANEJADA' && op.status !== 'CANCELADA') {
      toast.error('Só é possível excluir OPs planejadas ou canceladas');
      return false;
    }
    
    LocalDb.remove(COLLECTION, id);
    toast.success(`OP ${op.codigo} excluída`);
    return true;
  }, []);

  return {
    iniciarProducao,
    registrarPesagem,
    alocarLote,
    registrarQC,
    finalizarProducao,
    bloquearOP,
    cancelarOP,
    excluirOP,
  };
}
