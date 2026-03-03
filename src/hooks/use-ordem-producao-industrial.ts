import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
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

// ============================================================
// HELPER: Mapear row do Supabase → OrdemProducaoIndustrial
// ============================================================
function mapRowToOP(row: any): OrdemProducaoIndustrial {
  return {
    id: row.id,
    codigo: row.codigo,
    formula_id: row.formula_id,
    formula_codigo: row.formula_codigo,
    formula_versao: row.formula_versao ?? 1,
    produto_nome: row.produto_nome,
    tipo_apresentacao: row.tipo_apresentacao || 'CAPSULA',
    peso_unidade_mg: row.peso_capsula_mg,
    quantidade_planejada: row.total_capsulas,
    acrescimo_producao_percentual: Number(row.acrescimo_percentual || 5),
    quantidade_com_acrescimo: row.total_capsulas_com_acrescimo,
    lote_produto_acabado: row.lote_produto_acabado,
    data_fabricacao: row.data_fabricacao,
    responsavel_tecnico: row.responsavel_producao_nome || row.rt_nome,
    data_planejada: row.data_fabricacao,
    status: row.status as StatusOP,
    alocacoes_lote: [],
    itens_pesagem: [],
    procedimentos_diluicao: [],
    custo_total_insumos: 0,
    custo_por_unidade: 0,
    lotes_mp_origem: [],
    observacoes: row.observacoes,
    data_inicio: row.data_inicio_producao,
    data_conclusao: row.data_fim_producao,
    finalizado_por: row.finalizado_por,
    updated_at: row.updated_at,
    created_at: row.created_at,
    data_validade: row.data_validade,
  };
}

// ============================================================
// GERAÇÃO DE CÓDIGO (via Supabase)
// ============================================================
async function generateOPCode(): Promise<string> {
  const ano = new Date().getFullYear();
  const prefix = `OP-${ano}-`;
  const { data } = await supabase
    .from('ordens_producao_industrial')
    .select('codigo')
    .like('codigo', `${prefix}%`)
    .order('codigo', { ascending: false })
    .limit(1);

  let maxNum = 0;
  if (data && data.length > 0) {
    const match = data[0].codigo.match(/^OP-\d{4}-(\d+)$/);
    if (match) maxNum = parseInt(match[1], 10);
  }
  return gerarCodigoOP(ano, maxNum + 1);
}

function generateLoteCode(): string {
  const hoje = new Date();
  return gerarLoteProdutoAcabado(hoje, Math.floor(Math.random() * 999) + 1);
}

// ============================================================
// HOOK: LISTAR OPs
// ============================================================
export function useOrdensProducaoIndustrial(filters?: { status?: StatusOP }) {
  const [ordens, setOrdens] = useState<OrdemProducaoIndustrial[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ordens_producao_industrial')
        .select('*')
        .order('updated_at', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[OPs] Erro ao buscar:', error.message);
        setOrdens([]);
      } else {
        setOrdens((data || []).map(mapRowToOP));
      }
    } catch (err) {
      console.error('[OPs] Erro inesperado:', err);
      setOrdens([]);
    } finally {
      setLoading(false);
    }
  }, [filters?.status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => ({
    total: ordens.length,
    planejadas: ordens.filter(op => op.status === 'PLANEJADA').length,
    aguardando: ordens.filter(op => op.status === 'AGUARDANDO_MATERIAIS').length,
    emProducao: ordens.filter(op => op.status === 'EM_PRODUCAO').length,
    finalizadas: ordens.filter(op => op.status === 'FINALIZADA').length,
    bloqueadas: ordens.filter(op => op.status === 'BLOQUEADA').length,
  }), [ordens]);

  return { data: ordens, isLoading: loading, refresh, stats };
}

// ============================================================
// HOOK: OP INDIVIDUAL
// ============================================================
export function useOrdemProducaoIndustrial(id: string | undefined) {
  const [ordem, setOrdem] = useState<OrdemProducaoIndustrial | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) {
      setOrdem(null);
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('ordens_producao_industrial')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error || !data) {
        setOrdem(null);
      } else {
        const op = mapRowToOP(data);

        // Carregar matérias-primas (itens de pesagem)
        const { data: mps } = await supabase
          .from('op_materias_primas')
          .select('*')
          .eq('op_id', id)
          .order('ordem_mistura', { ascending: true });

        if (mps) {
          op.itens_pesagem = mps.map((mp: any) => ({
            id: mp.id,
            op_id: mp.op_id,
            ordem: mp.ordem_mistura || 0,
            insumo_id: mp.insumo_id,
            insumo_nome: mp.insumo_nome,
            categoria: mp.categoria || 'ATIVO',
            tipo_pesagem: mp.pesagem_critica ? 'CRITICA' : 'PADRAO',
            motivo_critico: mp.motivo_critico,
            quantidade_formula_mg: Number(mp.quantidade_teorica_mg || 0),
            quantidade_lote_g: Number(mp.quantidade_teorica_g || 0),
            tolerancia_percentual: Number(mp.tolerancia_percentual || 10),
            quantidade_minima_g: Number(mp.quantidade_minima_g || 0),
            quantidade_maxima_g: Number(mp.quantidade_maxima_g || 0),
            quantidade_pesada_g: mp.quantidade_real_g ? Number(mp.quantidade_real_g) : undefined,
            dentro_tolerancia: mp.dentro_tolerancia ?? undefined,
            pesado_por: mp.pesado_por,
            conferido_por: mp.conferido_por,
            pesado_em: mp.pesado_em,
            lote_id: mp.lote_id,
            numero_lote: mp.numero_lote,
          }));

          // Construir alocações a partir das MPs com lote
          op.alocacoes_lote = mps
            .filter((mp: any) => mp.lote_id)
            .map((mp: any) => ({
              id: mp.id,
              op_id: mp.op_id,
              insumo_id: mp.insumo_id,
              insumo_nome: mp.insumo_nome,
              lote_id: mp.lote_id,
              numero_lote: mp.numero_lote || '',
              fornecedor_nome: mp.fornecedor_nome || '',
              quantidade_necessaria_g: Number(mp.quantidade_teorica_g || 0),
              quantidade_alocada_g: Number(mp.quantidade_teorica_g || 0),
              quantidade_consumida_g: Number(mp.quantidade_real_g || 0),
              custo_unitario: 0,
              custo_total: 0,
              status: mp.quantidade_real_g ? 'CONSUMIDO' : 'ALOCADO',
              created_at: mp.created_at,
            }));

          op.lotes_mp_origem = mps
            .filter((mp: any) => mp.lote_id)
            .map((mp: any) => mp.lote_id);
        }

        setOrdem(op);
      }
    } catch (err) {
      console.error('[OP] Erro ao buscar:', err);
      setOrdem(null);
    } finally {
      setLoading(false);
    }
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
  quantidade_frascos?: number;
  capsulas_por_frasco?: number;
  data_planejada?: string;
  responsavel_tecnico?: string;
  observacoes?: string;
}

// ============================================================
// HOOK: CRIAR OP
// ============================================================
export function useCreateOrdemProducaoIndustrial() {
  const [isCreating, setIsCreating] = useState(false);

  const criarOP = useCallback(async (params: CriarOPParams): Promise<OrdemProducaoIndustrial | null> => {
    setIsCreating(true);
    try {
      const { formula, quantidade_unidades, data_planejada, responsavel_tecnico, observacoes } = params;

      const acrescimo = 5;
      const quantidadeComAcrescimo = Math.ceil(quantidade_unidades * (1 + acrescimo / 100));

      // Calcular cápsula industrial
      const totalAtivos = formula.itens.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
      const veiculoCodigo = (formula.excipiente_padrao || 'AMIDO') as 'AMIDO' | 'CELULOSE' | 'PRE_BLEND';
      const calculos = calcularCapsulaIndustrial(totalAtivos, veiculoCodigo, formula.peso_capsula_alvo_mg || 490);

      const codigoOP = await generateOPCode();
      const loteProdutoAcabado = generateLoteCode();
      const hoje = new Date().toISOString().split('T')[0];

      const capsPorFrasco = params.capsulas_por_frasco || 60;
      const qtdFrascos = params.quantidade_frascos || Math.ceil(quantidade_unidades / capsPorFrasco);

      // 1. Inserir a OP no banco
      const { data: opRow, error: opError } = await supabase
        .from('ordens_producao_industrial')
        .insert({
          codigo: codigoOP,
          produto_nome: formula.nome_formula,
          formula_id: formula.id,
          formula_codigo: formula.codigo_formula,
          formula_versao: formula.versao,
          quantidade_frascos: qtdFrascos,
          capsulas_por_frasco: capsPorFrasco,
          total_capsulas: quantidade_unidades,
          total_capsulas_com_acrescimo: quantidadeComAcrescimo,
          acrescimo_percentual: acrescimo,
          lote_produto_acabado: loteProdutoAcabado,
          data_fabricacao: hoje,
          data_validade: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          tipo_apresentacao: formula.tipo_apresentacao,
          peso_capsula_mg: formula.peso_capsula_alvo_mg || 490,
          excipiente_base: formula.excipiente_padrao || 'AMIDO',
          status: 'PLANEJADA',
          responsavel_producao_nome: responsavel_tecnico,
          observacoes,
        })
        .select('id, codigo')
        .single();

      if (opError || !opRow) {
        throw new Error(`Erro ao criar OP: ${opError?.message}`);
      }

      // 2. Criar itens de pesagem como op_materias_primas
      const materiasToInsert: any[] = [];
      let ordem = 1;

      // Ativos com pré-mix
      for (const item of formula.itens.filter(i => i.exige_premix)) {
        const classificacao = classificarPesagem(item.quantidade_convertida_mg, item.unidade_informada);
        const quantidadeLoteG = (item.quantidade_convertida_mg * quantidadeComAcrescimo) / 1000;
        const tolerancia = calcularTolerancia(quantidadeLoteG);

        materiasToInsert.push({
          op_id: opRow.id,
          ordem_mistura: ordem++,
          insumo_id: item.id,
          insumo_nome: item.nome_insumo,
          categoria: 'PREMIX',
          pesagem_critica: classificacao.tipo === 'CRITICA',
          motivo_critico: classificacao.motivo,
          quantidade_teorica_mg: item.quantidade_convertida_mg,
          quantidade_teorica_g: quantidadeLoteG,
          tolerancia_percentual: 10,
          quantidade_minima_g: tolerancia.minimo,
          quantidade_maxima_g: tolerancia.maximo,
          unidade: 'g',
        });
      }

      // Ativos sem pré-mix
      for (const item of formula.itens.filter(i => !i.exige_premix)) {
        const classificacao = classificarPesagem(item.quantidade_convertida_mg, item.unidade_informada);
        const quantidadeLoteG = (item.quantidade_convertida_mg * quantidadeComAcrescimo) / 1000;
        const tolerancia = calcularTolerancia(quantidadeLoteG);

        materiasToInsert.push({
          op_id: opRow.id,
          ordem_mistura: ordem++,
          insumo_id: item.id,
          insumo_nome: item.nome_insumo,
          categoria: 'ATIVO',
          pesagem_critica: classificacao.tipo === 'CRITICA',
          motivo_critico: classificacao.motivo,
          quantidade_teorica_mg: item.quantidade_convertida_mg,
          quantidade_teorica_g: quantidadeLoteG,
          tolerancia_percentual: 10,
          quantidade_minima_g: tolerancia.minimo,
          quantidade_maxima_g: tolerancia.maximo,
          unidade: 'g',
        });
      }

      // Veículo base
      const qspLoteG = (calculos.veiculo_base_mg * quantidadeComAcrescimo) / 1000;
      const tolQsp = calcularTolerancia(qspLoteG);
      materiasToInsert.push({
        op_id: opRow.id,
        ordem_mistura: ordem++,
        insumo_nome: calculos.veiculo_base_nome,
        categoria: 'VEICULO_BASE',
        pesagem_critica: false,
        quantidade_teorica_mg: calculos.veiculo_base_mg,
        quantidade_teorica_g: qspLoteG,
        tolerancia_percentual: 10,
        quantidade_minima_g: tolQsp.minimo,
        quantidade_maxima_g: tolQsp.maximo,
        unidade: 'g',
      });

      // Excipientes tecnológicos
      const excOrdenados = [...calculos.excipientes_tecnologicos].sort((a, b) => a.ordem_mistura - b.ordem_mistura);
      for (const exc of excOrdenados) {
        const qtdLoteG = (exc.quantidade_mg * quantidadeComAcrescimo) / 1000;
        const tol = calcularTolerancia(qtdLoteG);
        materiasToInsert.push({
          op_id: opRow.id,
          ordem_mistura: ordem++,
          insumo_nome: exc.nome,
          categoria: 'TECNOLOGICO',
          pesagem_critica: false,
          quantidade_teorica_mg: exc.quantidade_mg,
          quantidade_teorica_g: qtdLoteG,
          tolerancia_percentual: 10,
          quantidade_minima_g: tol.minimo,
          quantidade_maxima_g: tol.maximo,
          unidade: 'g',
        });
      }

      if (materiasToInsert.length > 0) {
        const { error: mpError } = await supabase
          .from('op_materias_primas')
          .insert(materiasToInsert);

        if (mpError) {
          console.error('[OP] Erro ao inserir matérias-primas:', mpError.message);
        }
      }

      toast.success(`OP ${codigoOP} criada com sucesso`);

      // Retornar OP mapeada
      const opResult = mapRowToOP({
        ...opRow,
        produto_nome: formula.nome_formula,
        status: 'PLANEJADA',
        total_capsulas: quantidade_unidades,
        total_capsulas_com_acrescimo: quantidadeComAcrescimo,
        lote_produto_acabado: loteProdutoAcabado,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });
      return opResult;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Falha ao criar OP: ${msg}`);
      console.error('[OP] Erro ao criar:', err);
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  return { criarOP, isCreating };
}

// ============================================================
// HOOK: AÇÕES DA OP
// ============================================================
export function useOrdemProducaoIndustrialActions() {

  // Iniciar produção
  const iniciarProducao = useCallback(async (id: string) => {
    const { data: op, error: fetchErr } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo, status')
      .eq('id', id)
      .single();

    if (fetchErr || !op) { toast.error('OP não encontrada'); return null; }

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .update({
        status: 'EM_PRODUCAO',
        data_inicio_producao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) { toast.error(`Erro ao iniciar: ${error.message}`); return null; }

    toast.success(`Produção ${op.codigo} iniciada`);
    return true;
  }, []);

  // Registrar pesagem
  const registrarPesagem = useCallback(async (
    opId: string,
    itemPesagemId: string,
    quantidadePesada: number,
    pesadoPor: string,
    conferidoPor?: string,
    loteId?: string,
    numeroLote?: string
  ) => {
    // Buscar item de pesagem
    const { data: mp, error: mpErr } = await supabase
      .from('op_materias_primas')
      .select('*')
      .eq('id', itemPesagemId)
      .single();

    if (mpErr || !mp) { toast.error('Item de pesagem não encontrado'); return null; }

    const dentroTolerancia = quantidadePesada >= Number(mp.quantidade_minima_g) &&
                              quantidadePesada <= Number(mp.quantidade_maxima_g);

    if (mp.pesagem_critica && !conferidoPor) {
      toast.error('Pesagem crítica requer dupla conferência');
      return null;
    }

    const { error } = await supabase
      .from('op_materias_primas')
      .update({
        quantidade_real_g: quantidadePesada,
        dentro_tolerancia: dentroTolerancia,
        pesado_por: pesadoPor,
        conferido_por: conferidoPor || null,
        pesado_em: new Date().toISOString(),
        lote_id: loteId || null,
        numero_lote: numeroLote || null,
      })
      .eq('id', itemPesagemId);

    if (error) { toast.error(`Erro ao registrar pesagem: ${error.message}`); return null; }

    toast.success(`Pesagem de ${mp.insumo_nome} registrada`);
    return true;
  }, []);

  // Alocar lote a uma matéria-prima
  const alocarLote = useCallback(async (
    opId: string,
    insumoId: string,
    insumoNome: string,
    loteId: string,
    numeroLote: string,
    fornecedorNome: string,
    quantidadeNecessaria: number,
    custoUnitario: number
  ) => {
    // Atualizar a MP correspondente com o lote
    const { error } = await supabase
      .from('op_materias_primas')
      .update({
        lote_id: loteId,
        numero_lote: numeroLote,
        fornecedor_nome: fornecedorNome,
      })
      .eq('op_id', opId)
      .eq('insumo_id', insumoId);

    if (error) { toast.error(`Erro ao alocar lote: ${error.message}`); return null; }

    // Atualizar timestamp da OP
    await supabase
      .from('ordens_producao_industrial')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', opId);

    toast.success(`Lote ${numeroLote} alocado para ${insumoNome}`);
    return true;
  }, []);

  // Registrar QC (via status da OP + observações)
  const registrarQC = useCallback(async (
    opId: string,
    qc: Omit<ControleQualidadeOP, 'id' | 'op_id'>
  ) => {
    const novoStatus = qc.status === 'REPROVADO' ? 'BLOQUEADA' : undefined;
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    if (novoStatus) updateData.status = novoStatus;

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .update(updateData)
      .eq('id', opId);

    if (error) { toast.error(`Erro ao registrar QC: ${error.message}`); return null; }

    if (qc.status === 'APROVADO') {
      toast.success('Lote aprovado pelo Controle de Qualidade');
    } else if (qc.status === 'REPROVADO') {
      toast.error('Lote REPROVADO - OP bloqueada');
    }
    return true;
  }, []);

  // Finalizar produção
  const finalizarProducao = useCallback(async (
    opId: string,
    quantidadeProduzida: number,
    quantidadeAprovada: number,
    finalizadoPor: string
  ) => {
    const { data: opRow, error: fetchErr } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo, total_capsulas, status')
      .eq('id', opId)
      .single();

    if (fetchErr || !opRow) { toast.error('OP não encontrada'); return null; }

    const controlePerdas = calcularRendimento(
      opRow.total_capsulas,
      quantidadeProduzida,
      quantidadeAprovada
    );

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .update({
        status: 'FINALIZADA',
        data_fim_producao: new Date().toISOString(),
        finalizado_por: finalizadoPor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opId);

    if (error) { toast.error(`Erro ao finalizar: ${error.message}`); return null; }

    toast.success(`OP ${opRow.codigo} finalizada - Rendimento: ${controlePerdas.rendimento_percentual}%`);
    return controlePerdas;
  }, []);

  // Bloquear OP
  const bloquearOP = useCallback(async (id: string, motivo: string) => {
    const { data: op } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo, observacoes')
      .eq('id', id)
      .single();

    if (!op) { toast.error('OP não encontrada'); return null; }

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .update({
        status: 'BLOQUEADA',
        motivo_bloqueio: motivo,
        observacoes: `${op.observacoes || ''}\n\n[BLOQUEIO] ${new Date().toLocaleString()}: ${motivo}`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) { toast.error(`Erro ao bloquear: ${error.message}`); return null; }
    toast.warning(`OP ${op.codigo} bloqueada`);
    return true;
  }, []);

  // Cancelar OP
  const cancelarOP = useCallback(async (id: string, motivo: string) => {
    const { data: op } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo, status, observacoes')
      .eq('id', id)
      .single();

    if (!op) { toast.error('OP não encontrada'); return null; }

    if (op.status === 'FINALIZADA') {
      toast.error('Não é possível cancelar uma OP finalizada');
      return null;
    }

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .update({
        status: 'CANCELADA',
        observacoes: `${op.observacoes || ''}\n\n[CANCELAMENTO] ${new Date().toLocaleString()}: ${motivo}`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) { toast.error(`Erro ao cancelar: ${error.message}`); return null; }
    toast.warning(`OP ${op.codigo} cancelada`);
    return true;
  }, []);

  // Excluir OP (apenas planejadas ou canceladas)
  const excluirOP = useCallback(async (id: string) => {
    const { data: op } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo, status')
      .eq('id', id)
      .single();

    if (!op) { toast.error('OP não encontrada'); return false; }

    if (op.status !== 'PLANEJADA' && op.status !== 'CANCELADA') {
      toast.error('Só é possível excluir OPs planejadas ou canceladas');
      return false;
    }

    // Deletar matérias-primas primeiro
    await supabase.from('op_materias_primas').delete().eq('op_id', id);
    await supabase.from('op_embalagens').delete().eq('op_id', id);

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .delete()
      .eq('id', id);

    if (error) { toast.error(`Erro ao excluir: ${error.message}`); return false; }

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
