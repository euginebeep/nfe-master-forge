// ============================================================
// HOOK: ORDENS DE PRODUÇÃO INDUSTRIAL
// CRUD completo com Supabase
// ============================================================

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  OrdemProducaoIndustrial, 
  OPMateriaPrima,
  OPPesagemCritica,
  OPChecklist,
  OPControleQualidade,
  OPControlePerdas,
  CriarOPForm,
  CHECKLIST_PADRAO,
  EXCIPIENTES_TECNOLOGICOS_FIXOS,
  calcularExcipientesTecnologicos,
  calcularExcipienteBase,
  isAtivoCritico,
  calcularTolerancia,
} from '@/types/op-industrial';
import { CAPSULA_PESO_ALVO_MG } from '@/lib/formulador-industrial-rules';

export function useOPIndustrial() {
  const [ordens, setOrdens] = useState<OrdemProducaoIndustrial[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentOP, setCurrentOP] = useState<OrdemProducaoIndustrial | null>(null);
  const [materiasPrimas, setMateriasPrimas] = useState<OPMateriaPrima[]>([]);
  const [checklist, setChecklist] = useState<OPChecklist[]>([]);

  // ============================================================
  // LISTAR TODAS AS OPs
  // ============================================================
  const listarOrdens = useCallback(async (filtros?: { status?: string }) => {
    setIsLoading(true);
    try {
      let query = supabase
        .from('ordens_producao_industrial')
        .select('*')
        .order('created_at', { ascending: false });

      if (filtros?.status && filtros.status !== 'all') {
        query = query.eq('status', filtros.status);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOrdens((data || []) as unknown as OrdemProducaoIndustrial[]);
      return data;
    } catch (error) {
      console.error('Erro ao listar OPs:', error);
      toast.error('Erro ao carregar ordens de produção');
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // BUSCAR OP POR ID
  // ============================================================
  const buscarOP = useCallback(async (id: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('ordens_producao_industrial')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setCurrentOP(data as unknown as OrdemProducaoIndustrial);
      return data;
    } catch (error) {
      console.error('Erro ao buscar OP:', error);
      toast.error('Erro ao carregar ordem de produção');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ============================================================
  // BUSCAR MATÉRIAS-PRIMAS DA OP
  // ============================================================
  const buscarMateriasPrimas = useCallback(async (opId: string) => {
    try {
      const { data, error } = await supabase
        .from('op_materias_primas')
        .select('*')
        .eq('op_id', opId)
        .order('ordem_mistura', { ascending: true });

      if (error) throw error;
      setMateriasPrimas((data || []) as unknown as OPMateriaPrima[]);
      return data;
    } catch (error) {
      console.error('Erro ao buscar matérias-primas:', error);
      return [];
    }
  }, []);

  // ============================================================
  // BUSCAR CHECKLIST DA OP
  // ============================================================
  const buscarChecklist = useCallback(async (opId: string) => {
    try {
      const { data, error } = await supabase
        .from('op_checklist')
        .select('*')
        .eq('op_id', opId)
        .order('categoria', { ascending: true })
        .order('ordem', { ascending: true });

      if (error) throw error;
      setChecklist((data || []) as unknown as OPChecklist[]);
      return data;
    } catch (error) {
      console.error('Erro ao buscar checklist:', error);
      return [];
    }
  }, []);

  // ============================================================
  // GERAR PRÓXIMO CÓDIGO DE OP
  // ============================================================
  const gerarProximoCodigo = useCallback(async () => {
    const ano = new Date().getFullYear();
    const { data, error } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo')
      .ilike('codigo', `OP-${ano}-%`)
      .order('codigo', { ascending: false })
      .limit(1);

    if (error) {
      console.error('Erro ao buscar último código:', error);
      return `OP-${ano}-00001`;
    }

    if (!data || data.length === 0) {
      return `OP-${ano}-00001`;
    }

    const ultimoCodigo = data[0].codigo;
    const partes = ultimoCodigo.split('-');
    const sequencia = parseInt(partes[2] || '0', 10) + 1;
    return `OP-${ano}-${String(sequencia).padStart(5, '0')}`;
  }, []);

  // ============================================================
  // CRIAR OP MANUAL (SEM FÓRMULA)
  // ============================================================
  const criarOPManual = useCallback(async (form: CriarOPForm) => {
    setIsLoading(true);
    try {
      const codigo = await gerarProximoCodigo();
      const totalCapsulas = form.quantidade_frascos * form.capsulas_por_frasco;
      const acrescimoPercentual = 5;
      const totalComAcrescimo = Math.ceil(totalCapsulas * (1 + acrescimoPercentual / 100));

      const opData = {
        codigo,
        produto_id: form.produto_id,
        produto_nome: form.produto_nome,
        formula_id: form.formula_id || null,
        quantidade_frascos: form.quantidade_frascos,
        capsulas_por_frasco: form.capsulas_por_frasco,
        total_capsulas: totalCapsulas,
        acrescimo_percentual: acrescimoPercentual,
        total_capsulas_com_acrescimo: totalComAcrescimo,
        lote_produto_acabado: form.lote_produto_acabado,
        data_fabricacao: form.data_fabricacao,
        data_validade: form.data_validade,
        tipo_apresentacao: 'CAPSULA',
        peso_capsula_mg: 500,
        tipo_capsula: form.tipo_capsula,
        excipiente_base: form.excipiente_base,
        status: 'PLANEJADA',
        responsavel_producao_nome: form.responsavel_producao_nome,
        observacoes: form.observacoes,
      };

      const { data, error } = await supabase
        .from('ordens_producao_industrial')
        .insert(opData)
        .select()
        .single();

      if (error) throw error;

      // Criar checklist padrão
      await criarChecklistPadrao(data.id);

      toast.success('Ordem de Produção criada com sucesso!', {
        description: `Código: ${codigo}`,
      });

      return data;
    } catch (error) {
      console.error('Erro ao criar OP:', error);
      toast.error('Erro ao criar ordem de produção');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [gerarProximoCodigo]);

  // ============================================================
  // CRIAR OP A PARTIR DE FÓRMULA
  // ============================================================
  const criarOPDeFormula = useCallback(async (
    formulaId: string,
    form: Omit<CriarOPForm, 'formula_id'>
  ) => {
    setIsLoading(true);
    try {
      // Buscar fórmula e itens
      const { data: formula, error: formulaError } = await supabase
        .from('formulas')
        .select('*')
        .eq('id', formulaId)
        .single();

      if (formulaError) throw formulaError;

      const { data: itens, error: itensError } = await supabase
        .from('formula_itens')
        .select('*')
        .eq('formula_id', formulaId)
        .order('ordem_mistura', { ascending: true });

      if (itensError) throw itensError;

      // Criar OP
      const codigo = await gerarProximoCodigo();
      const totalCapsulas = form.quantidade_frascos * form.capsulas_por_frasco;
      const acrescimoPercentual = 5;
      const totalComAcrescimo = Math.ceil(totalCapsulas * (1 + acrescimoPercentual / 100));

      const opData = {
        codigo,
        produto_id: formula.produto_acabado_id,
        produto_nome: form.produto_nome || formula.nome_formula,
        formula_id: formulaId,
        formula_codigo: formula.codigo_formula,
        formula_versao: formula.versao || 1,
        quantidade_frascos: form.quantidade_frascos,
        capsulas_por_frasco: form.capsulas_por_frasco,
        total_capsulas: totalCapsulas,
        acrescimo_percentual: acrescimoPercentual,
        total_capsulas_com_acrescimo: totalComAcrescimo,
        lote_produto_acabado: form.lote_produto_acabado,
        data_fabricacao: form.data_fabricacao,
        data_validade: form.data_validade,
        tipo_apresentacao: formula.tipo_apresentacao || 'CAPSULA',
        // Fonte única de verdade: peso de enchimento real medido em
        // laboratório. peso_capsula_nominal_mg é mantido só por
        // compatibilidade com fórmulas antigas que não foram remedidas.
        peso_capsula_mg: formula.peso_enchimento_mg || formula.peso_capsula_nominal_mg || CAPSULA_PESO_ALVO_MG,
        tipo_capsula: formula.tipo_capsula || '00',
        excipiente_base: formula.excipiente_padrao || 'AMIDO',
        status: 'PLANEJADA',
        responsavel_producao_nome: form.responsavel_producao_nome,
        observacoes: form.observacoes,
      };

      const { data: op, error: opError } = await supabase
        .from('ordens_producao_industrial')
        .insert(opData)
        .select()
        .single();

      if (opError) throw opError;

      // Criar matérias-primas a partir dos itens da fórmula
      await criarMateriasPrimasDeFormula(op.id, itens || [], totalComAcrescimo, opData.peso_capsula_mg);

      // Criar checklist padrão
      await criarChecklistPadrao(op.id);

      // Criar controle de perdas
      await criarControlePerdas(op.id, totalCapsulas, acrescimoPercentual);

      toast.success('Ordem de Produção criada a partir da fórmula!', {
        description: `Código: ${codigo}`,
      });

      return op;
    } catch (error) {
      console.error('Erro ao criar OP de fórmula:', error);
      toast.error('Erro ao criar ordem de produção');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [gerarProximoCodigo]);

  // ============================================================
  // CRIAR MATÉRIAS-PRIMAS A PARTIR DA FÓRMULA
  // ============================================================
  const criarMateriasPrimasDeFormula = async (
    opId: string,
    itensFormula: Array<{
      nome_insumo: string;
      quantidade_convertida_mg: number;
      produto_materia_prima_id?: string;
      ativo_critico?: boolean;
      unidade_informada?: string;
    }>,
    totalCapsulas: number,
    pesoCapsula: number
  ) => {
    const materiasPrimasData: Array<{
      op_id: string;
      insumo_id?: string;
      insumo_nome: string;
      categoria: string;
      quantidade_teorica_mg: number;
      quantidade_teorica_g: number;
      unidade: string;
      pesagem_critica: boolean;
      motivo_critico?: string;
      tolerancia_percentual: number;
      quantidade_minima_g: number;
      quantidade_maxima_g: number;
      ordem_mistura: number;
    }> = [];
    let ordemMistura = 1;

    // Adicionar ativos da fórmula
    for (const item of itensFormula) {
      const quantidadeTotalMg = item.quantidade_convertida_mg * totalCapsulas;
      const quantidadeTotalG = quantidadeTotalMg / 1000;
      const { critico, motivo } = isAtivoCritico(item.quantidade_convertida_mg, item.unidade_informada);
      const tolerancia = calcularTolerancia(quantidadeTotalG);

      materiasPrimasData.push({
        op_id: opId,
        insumo_id: item.produto_materia_prima_id || undefined,
        insumo_nome: item.nome_insumo,
        categoria: 'ATIVO',
        quantidade_teorica_mg: quantidadeTotalMg,
        quantidade_teorica_g: quantidadeTotalG,
        unidade: 'g',
        pesagem_critica: critico,
        motivo_critico: motivo,
        tolerancia_percentual: 10,
        quantidade_minima_g: tolerancia.minimo,
        quantidade_maxima_g: tolerancia.maximo,
        ordem_mistura: ordemMistura++,
      });
    }

    // Calcular excipientes tecnológicos
    const tecnologicos = calcularExcipientesTecnologicos(pesoCapsula);
    const totalAtivosMg = itensFormula.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
    const excipienteBaseMg = calcularExcipienteBase(pesoCapsula, totalAtivosMg, tecnologicos.total_tecnologicos_mg);

    // Excipiente base (ordem 3)
    const excBaseTotal = (excipienteBaseMg * totalCapsulas) / 1000;
    const toleranciaBase = calcularTolerancia(excBaseTotal);
    materiasPrimasData.push({
      op_id: opId,
      insumo_nome: 'Excipiente Base (Q.S.P.)',
      categoria: 'EXCIPIENTE_BASE',
      quantidade_teorica_mg: excipienteBaseMg * totalCapsulas,
      quantidade_teorica_g: excBaseTotal,
      unidade: 'g',
      pesagem_critica: false,
      tolerancia_percentual: 10,
      quantidade_minima_g: toleranciaBase.minimo,
      quantidade_maxima_g: toleranciaBase.maximo,
      ordem_mistura: ordemMistura++,
    });

    // Dióxido de Silício (ordem 4)
    const dioxidoTotal = (tecnologicos.dioxido_silicio_mg * totalCapsulas) / 1000;
    const toleranciaDioxido = calcularTolerancia(dioxidoTotal);
    materiasPrimasData.push({
      op_id: opId,
      insumo_nome: EXCIPIENTES_TECNOLOGICOS_FIXOS.DIOXIDO_SILICIO.nome,
      categoria: 'EXCIPIENTE_TECNOLOGICO',
      quantidade_teorica_mg: tecnologicos.dioxido_silicio_mg * totalCapsulas,
      quantidade_teorica_g: dioxidoTotal,
      unidade: 'g',
      pesagem_critica: false,
      tolerancia_percentual: 10,
      quantidade_minima_g: toleranciaDioxido.minimo,
      quantidade_maxima_g: toleranciaDioxido.maximo,
      ordem_mistura: ordemMistura++,
    });

    // Talco (ordem 5)
    const talcoTotal = (tecnologicos.talco_mg * totalCapsulas) / 1000;
    const toleranciaTalco = calcularTolerancia(talcoTotal);
    materiasPrimasData.push({
      op_id: opId,
      insumo_nome: EXCIPIENTES_TECNOLOGICOS_FIXOS.TALCO.nome,
      categoria: 'EXCIPIENTE_TECNOLOGICO',
      quantidade_teorica_mg: tecnologicos.talco_mg * totalCapsulas,
      quantidade_teorica_g: talcoTotal,
      unidade: 'g',
      pesagem_critica: false,
      tolerancia_percentual: 10,
      quantidade_minima_g: toleranciaTalco.minimo,
      quantidade_maxima_g: toleranciaTalco.maximo,
      ordem_mistura: ordemMistura++,
    });

    // Estearato de Magnésio (SEMPRE ÚLTIMO - ordem 6)
    const estearatoTotal = (tecnologicos.estearato_mg * totalCapsulas) / 1000;
    const toleranciaEstearato = calcularTolerancia(estearatoTotal);
    materiasPrimasData.push({
      op_id: opId,
      insumo_nome: EXCIPIENTES_TECNOLOGICOS_FIXOS.ESTEARATO_MAGNESIO.nome,
      categoria: 'EXCIPIENTE_TECNOLOGICO',
      quantidade_teorica_mg: tecnologicos.estearato_mg * totalCapsulas,
      quantidade_teorica_g: estearatoTotal,
      unidade: 'g',
      pesagem_critica: false,
      tolerancia_percentual: 10,
      quantidade_minima_g: toleranciaEstearato.minimo,
      quantidade_maxima_g: toleranciaEstearato.maximo,
      ordem_mistura: ordemMistura++,
    });

    // Inserir no banco
    const { error } = await supabase
      .from('op_materias_primas')
      .insert(materiasPrimasData);

    if (error) {
      console.error('Erro ao criar matérias-primas:', error);
    }

    // Criar registros de pesagem crítica para ativos críticos
    const ativosCriticos = materiasPrimasData.filter(mp => mp.pesagem_critica);
    if (ativosCriticos.length > 0) {
      // Buscar IDs das matérias-primas inseridas
      const { data: mps } = await supabase
        .from('op_materias_primas')
        .select('id, insumo_nome, quantidade_teorica_mg')
        .eq('op_id', opId)
        .eq('pesagem_critica', true);

      if (mps && mps.length > 0) {
        const pesagensCriticas = mps.map(mp => ({
          op_id: opId,
          materia_prima_id: mp.id,
          insumo_nome: mp.insumo_nome,
          quantidade_teorica_mg: mp.quantidade_teorica_mg,
          status: 'PENDENTE',
        }));

        await supabase.from('op_pesagens_criticas').insert(pesagensCriticas);
      }
    }
  };

  // ============================================================
  // CRIAR CHECKLIST PADRÃO
  // ============================================================
  const criarChecklistPadrao = async (opId: string) => {
    const checklistData = CHECKLIST_PADRAO.map(item => ({
      op_id: opId,
      ...item,
      verificado: false,
    }));

    const { error } = await supabase.from('op_checklist').insert(checklistData);
    if (error) {
      console.error('Erro ao criar checklist:', error);
    }
  };

  // ============================================================
  // CRIAR CONTROLE DE PERDAS
  // ============================================================
  const criarControlePerdas = async (opId: string, quantidadePlanejada: number, acrescimoPercentual: number) => {
    const quantidadeComAcrescimo = Math.ceil(quantidadePlanejada * (1 + acrescimoPercentual / 100));

    const { error } = await supabase.from('op_controle_perdas').insert({
      op_id: opId,
      quantidade_planejada: quantidadePlanejada,
      acrescimo_percentual: acrescimoPercentual,
      quantidade_com_acrescimo: quantidadeComAcrescimo,
    });

    if (error) {
      console.error('Erro ao criar controle de perdas:', error);
    }
  };

  // ============================================================
  // ATUALIZAR STATUS DA OP
  // ============================================================
  const atualizarStatus = useCallback(async (opId: string, novoStatus: string, motivo?: string) => {
    try {
      const updateData: Record<string, unknown> = { status: novoStatus };
      
      if (novoStatus === 'EM_PRODUCAO') {
        updateData.data_inicio_producao = new Date().toISOString();
      } else if (novoStatus === 'FINALIZADA') {
        updateData.data_fim_producao = new Date().toISOString();
      } else if (novoStatus === 'BLOQUEADA') {
        updateData.motivo_bloqueio = motivo;
      }

      const { error } = await supabase
        .from('ordens_producao_industrial')
        .update(updateData)
        .eq('id', opId);

      if (error) throw error;

      toast.success(`Status atualizado para: ${novoStatus}`);
      return true;
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
      return false;
    }
  }, []);

  // ============================================================
  // REGISTRAR PESAGEM
  // ============================================================
  const registrarPesagem = useCallback(async (
    materiaPrimaId: string,
    quantidadeRealG: number,
    pesadoPor?: string
  ) => {
    try {
      const { data: mp, error: fetchError } = await supabase
        .from('op_materias_primas')
        .select('quantidade_minima_g, quantidade_maxima_g')
        .eq('id', materiaPrimaId)
        .single();

      if (fetchError) throw fetchError;

      const dentroTolerancia = quantidadeRealG >= mp.quantidade_minima_g && quantidadeRealG <= mp.quantidade_maxima_g;

      const { error } = await supabase
        .from('op_materias_primas')
        .update({
          quantidade_real_g: quantidadeRealG,
          dentro_tolerancia: dentroTolerancia,
          pesado_por: pesadoPor,
          pesado_em: new Date().toISOString(),
        })
        .eq('id', materiaPrimaId);

      if (error) throw error;

      if (!dentroTolerancia) {
        toast.warning('Peso fora da tolerância! Conferência obrigatória.');
      } else {
        toast.success('Pesagem registrada com sucesso');
      }

      return dentroTolerancia;
    } catch (error) {
      console.error('Erro ao registrar pesagem:', error);
      toast.error('Erro ao registrar pesagem');
      return false;
    }
  }, []);

  // ============================================================
  // VERIFICAR ITEM DO CHECKLIST
  // ============================================================
  const verificarChecklist = useCallback(async (checklistId: string, verificadoPorId?: string | null) => {
    try {
      const isUuid = (v: string) =>
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

      let resolvedUserId: string | null = null;

      if (verificadoPorId && isUuid(verificadoPorId)) {
        resolvedUserId = verificadoPorId;
      } else {
        const { data } = await supabase.auth.getUser();
        resolvedUserId = data.user?.id ?? null;
      }

      const { error } = await supabase
        .from('op_checklist')
        .update({
          verificado: true,
          verificado_por: resolvedUserId,
          verificado_em: new Date().toISOString(),
        })
        .eq('id', checklistId);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Erro ao verificar checklist:', error);
      return false;
    }
  }, []);

  return {
    // Estado
    ordens,
    currentOP,
    materiasPrimas,
    checklist,
    isLoading,
    
    // Listagem
    listarOrdens,
    buscarOP,
    buscarMateriasPrimas,
    buscarChecklist,
    
    // Criação
    criarOPManual,
    criarOPDeFormula,
    
    // Ações
    atualizarStatus,
    registrarPesagem,
    verificarChecklist,
    
    // Utils
    gerarProximoCodigo,
  };
}
