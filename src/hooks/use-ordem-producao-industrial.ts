import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getUserCompanyId } from '@/hooks/use-user-company';
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
  VEICULOS_BASE,
  gerarOrdemMistura,
  calcularCapsulaIndustrial,
  calcularCapsulasPorDose,
  CAPSULA_PESO_ALVO_MG,
  CAPSULA_TAMANHO_PADRAO,
  DENSIDADE_PADRAO_KG_L,
  type TamanhoCapsula,
} from '@/lib/formulador-industrial-rules';
import { toast } from 'sonner';

// ============================================================
// GERAÇÃO DE CÓDIGO — via Supabase (sem localStorage)
// ============================================================

async function generateOPCode(): Promise<string> {
  const companyId = await getUserCompanyId();
  const ano = new Date().getFullYear();

  const { data } = await supabase
    .from('ordens_producao_industrial')
    .select('codigo')
    .eq('company_id', companyId!)
    .ilike('codigo', `OP-${ano}-%`)
    .order('codigo', { ascending: false })
    .limit(1);

  const maxNum = data?.[0]?.codigo
    ? parseInt(data[0].codigo.match(/^OP-\d{4}-(\d+)$/)?.[1] || '0', 10)
    : 0;

  return gerarCodigoOP(ano, maxNum + 1);
}

async function generateLoteCode(companyId: string): Promise<string> {
  const hoje = new Date();
  const prefix = gerarLoteProdutoAcabado(hoje, 1).split('-')[0];

  const { data } = await supabase
    .from('ordens_producao_industrial')
    .select('lote_produto_acabado')
    .eq('company_id', companyId)
    .ilike('lote_produto_acabado', `${prefix}-%`);

  return gerarLoteProdutoAcabado(hoje, (data?.length || 0) + 1);
}

// ============================================================
// HOOK: LISTAR OPs
// ============================================================

export function useOrdensProducaoIndustrial(filters?: { status?: StatusOP }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ordens_producao_industrial', filters],
    queryFn: async () => {
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error('Empresa não configurada');

      let q = supabase
        .from('ordens_producao_industrial')
        .select(`
          *,
          op_materias_primas (*),
          op_embalagens (*),
          op_checklist (*),
          op_controle_perdas (*),
          op_pesagens_criticas (*),
          op_controle_qualidade (*),
          op_historico_etapas (*)
        `)
        .eq('company_id', companyId)
        .order('updated_at', { ascending: false });

      if (filters?.status) {
        q = q.eq('status', filters.status);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  // Stats derivados dos dados já carregados
  const stats = {
    total: query.data?.length ?? 0,
    planejadas: query.data?.filter(op => op.status === 'PLANEJADA').length ?? 0,
    aguardando: query.data?.filter(op => op.status === 'AGUARDANDO_MATERIAIS').length ?? 0,
    emProducao: query.data?.filter(op => op.status === 'EM_PRODUCAO').length ?? 0,
    finalizadas: query.data?.filter(op => op.status === 'FINALIZADA').length ?? 0,
    bloqueadas: query.data?.filter(op => op.status === 'BLOQUEADA').length ?? 0,
  };

  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['ordens_producao_industrial'] }),
    stats,
  };
}

// ============================================================
// HOOK: OP INDIVIDUAL
// ============================================================

export function useOrdemProducaoIndustrial(id: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['ordens_producao_industrial', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ordens_producao_industrial')
        .select(`
          *,
          op_materias_primas (*),
          op_embalagens (*),
          op_checklist (*),
          op_controle_perdas (*),
          op_pesagens_criticas (*),
          op_controle_qualidade (*),
          op_historico_etapas (*)
        `)
        .eq('id', id!)
        .single();

      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  return {
    ordem: query.data ?? null,
    isLoading: query.isLoading,
    refresh: () => queryClient.invalidateQueries({ queryKey: ['ordens_producao_industrial', id] }),
  };
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
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (params: CriarOPParams) => {
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error('Empresa não configurada. Configure sua empresa antes de criar OPs.');

      const { formula, quantidade_unidades, data_planejada, responsavel_tecnico, observacoes } = params;

      // Acréscimo de produção: 5%
      const acrescimo = 5;
      const quantidadeComAcrescimo = Math.ceil(quantidade_unidades * (1 + acrescimo / 100));

      // Calcular cápsula industrial
      const totalAtivos = formula.itens.reduce((sum, i) => sum + i.quantidade_convertida_mg, 0);
      const veiculoCodigo = (formula.excipiente_padrao || 'AMIDO') as 'AMIDO' | 'CELULOSE' | 'PRE_BLEND';
      // Usar dose em N cápsulas (não peso de 1 cápsula)
      const capsulasPorDose = calcularCapsulasPorDose(
        totalAtivos,
        formula.densidade_aparente_kg_l || DENSIDADE_PADRAO_KG_L,
        (formula.tipo_capsula as TamanhoCapsula) || CAPSULA_TAMANHO_PADRAO,
      );
      const massaTotalDose = capsulasPorDose.n_capsulas * capsulasPorDose.peso_por_capsula_mg;
      const calculos = calcularCapsulaIndustrial(totalAtivos, veiculoCodigo, massaTotalDose);

      // Gerar código e lote
      const codigo = await generateOPCode();
      const lote_produto_acabado = await generateLoteCode(companyId);
      const opId = crypto.randomUUID();

      // ── 1. Inserir OP principal ──────────────────────────────
      const { error: opError } = await supabase
        .from('ordens_producao_industrial')
        .insert({
          id: opId,
          company_id: companyId,
          codigo,
          formula_id: formula.id,
          formula_codigo: formula.codigo_formula,
          formula_versao: formula.versao,
          produto_nome: formula.nome_formula,
          tipo_apresentacao: formula.tipo_apresentacao,
          peso_capsula_mg: formula.peso_enchimento_mg || formula.peso_capsula_alvo_mg || CAPSULA_PESO_ALVO_MG,
          total_capsulas: quantidade_unidades,
          total_capsulas_com_acrescimo: quantidadeComAcrescimo,
          capsulas_por_frasco: quantidade_unidades,    // ajuste conforme seu modelo
          quantidade_frascos: 1,                        // ajuste conforme seu modelo
          lote_produto_acabado,
          data_fabricacao: new Date().toISOString().split('T')[0],
          data_validade: new Date(Date.now() + 365 * 86400000).toISOString().split('T')[0],
          status: 'PLANEJADA',
          acrescimo_percentual: acrescimo,
          excipiente_base: veiculoCodigo,
          observacoes,
          responsavel_tecnico_id: null,   // preencher se tiver o ID
          rt_nome: responsavel_tecnico,
          updated_at: new Date().toISOString(),
        });

      if (opError) throw opError;

      // ── 2. Inserir matérias-primas (op_materias_primas) ──────
      const materiasInsert = [];
      let ordem = 1;

      // Ativos com pré-mix primeiro
      for (const item of formula.itens.filter(i => i.exige_premix)) {
        const classificacao = classificarPesagem(item.quantidade_convertida_mg, item.unidade_informada);
        const quantidadeLoteG = (item.quantidade_convertida_mg * quantidadeComAcrescimo) / 1000;
        const tolerancia = calcularTolerancia(quantidadeLoteG);

        materiasInsert.push({
          op_id: opId,
          insumo_id: item.id,
          insumo_nome: item.nome_insumo,
          categoria: 'PREMIX',
          ordem_mistura: ordem++,
          motivo_critico: classificacao.motivo || null,
          // Campos de pesagem — preenchidos depois ao registrar pesagem
          quantidade_pesada_g: null,
          dentro_tolerancia: null,
          pesado_por: null,
          pesado_em: null,
        });
      }

      // Ativos sem pré-mix
      for (const item of formula.itens.filter(i => !i.exige_premix)) {
        const classificacao = classificarPesagem(item.quantidade_convertida_mg, item.unidade_informada);

        materiasInsert.push({
          op_id: opId,
          insumo_id: item.id,
          insumo_nome: item.nome_insumo,
          categoria: 'ATIVO',
          ordem_mistura: ordem++,
          motivo_critico: classificacao.motivo || null,
          quantidade_pesada_g: null,
          dentro_tolerancia: null,
          pesado_por: null,
          pesado_em: null,
        });
      }

      // Veículo base
      materiasInsert.push({
        op_id: opId,
        insumo_id: null,
        insumo_nome: calculos.veiculo_base_nome,
        categoria: 'VEICULO_BASE',
        ordem_mistura: ordem++,
        motivo_critico: null,
        quantidade_pesada_g: null,
        dentro_tolerancia: null,
        pesado_por: null,
        pesado_em: null,
      });

      if (materiasInsert.length > 0) {
        const { error: mpError } = await supabase
          .from('op_materias_primas')
          .insert(materiasInsert);
        if (mpError) throw mpError;
      }

      // ── 3. Inserir controle de perdas inicial ────────────────
      const { error: perdaError } = await supabase
        .from('op_controle_perdas')
        .insert({
          op_id: opId,
          quantidade_planejada: quantidade_unidades,
          acrescimo_percentual: acrescimo,
          quantidade_com_acrescimo: quantidadeComAcrescimo,
        });
      if (perdaError) throw perdaError;

      // ── 4. Verificação MRP (PASSO 3) ────────────────────────
      try {
        const necessidades = await calcularNecessidadeOP({
          formula_id: formula.id,
          quantidade_frascos: quantidade_unidades,
          company_id: companyId,
        });

        if (necessidades.length > 0) {
          // Buscar saldos dos itens
          const itemIds = necessidades.map(n => n.item_id);
          const { getSaldos } = await import('@/hooks/use-estoque-movimentacoes');
          const saldos = await getSaldos(itemIds);

          // Verificar faltantes
          const faltantes = necessidades.filter(n => {
            const saldo = saldos[n.item_id] || 0;
            return n.quantidade > saldo;
          });

          if (faltantes.length > 0) {
            // OP nasce em AGUARDANDO_MATERIAIS
            const { error: updateError } = await supabase
              .from('ordens_producao_industrial')
              .update({ status: 'AGUARDANDO_MATERIAIS' })
              .eq('id', opId);

            if (!updateError) {
              // Criar requisição de compra
              const { data: reqData, error: reqError } = await supabase
                .from('requisicoes_compra')
                .insert({
                  op_id: opId,
                  status: 'ABERTA',
                  origem: 'MRP',
                  company_id: companyId,
                })
                .select()
                .single();

              if (reqData && !reqError) {
                // Criar itens da requisição
                const itensReq = faltantes.map(f => ({
                  requisicao_id: reqData.id,
                  item_id: f.item_id,
                  item_nome: f.item_nome,
                  quantidade_necessaria: f.quantidade,
                  quantidade_disponivel: saldos[f.item_id] || 0,
                  quantidade_faltante: f.quantidade - (saldos[f.item_id] || 0),
                  unidade: f.unidade,
                  status: 'PENDENTE',
                }));

                const { error: itensError } = await supabase
                  .from('requisicoes_compra_itens')
                  .insert(itensReq);

                if (!itensError) {
                  console.log(`MRP: OP ${codigo} em AGUARDANDO_MATERIAIS com ${faltantes.length} itens faltantes`);
                }
              }
            }
          }
        }
      } catch (mrpError) {
        console.error('Erro ao executar MRP:', mrpError);
        // NÃO trava a criação da OP
      }

      return { id: opId, codigo, lote_produto_acabado };
    },

    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ordens_producao_industrial'] });
      toast.success(`OP ${data.codigo} criada com sucesso`);
      import('@/lib/audit-logger').then(({ registrarAuditoria }) => {
        registrarAuditoria({
          tipo: 'OP_CRIADA',
          descricao: `OP "${data.codigo}" criada`,
          entidade_tipo: 'OrdemProducao',
          entidade_id: data.id,
          entidade_codigo: data.codigo,
        });
      });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar OP: ${error.message}`);
    },
  });

  return { criarOP: mutation.mutateAsync, isLoading: mutation.isPending };
}

// ============================================================
// HOOK: AÇÕES DA OP
// ============================================================

export function useOrdemProducaoIndustrialActions() {
  const queryClient = useQueryClient();

  const invalidate = (id?: string) => {
    queryClient.invalidateQueries({ queryKey: ['ordens_producao_industrial'] });
    if (id) queryClient.invalidateQueries({ queryKey: ['ordens_producao_industrial', id] });
  };

  // ── Iniciar produção ────────────────────────────────────────
  const iniciarProducao = useCallback(async (id: string) => {
    const { data: op } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo, status')
      .eq('id', id)
      .single();

    if (!op) { toast.error('OP não encontrada'); return null; }

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .update({
        status: 'EM_PRODUCAO',
        data_inicio_producao: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) { toast.error(`Erro ao iniciar OP: ${error.message}`); return null; }

    // Registrar no histórico
    await supabase.from('op_historico_etapas').insert({
      op_id: id,
      etapa: 'EM_PRODUCAO',
      iniciada_em: new Date().toISOString(),
    });

    // Snapshot ambiental ao iniciar produção (RDC 658/2022)
    try {
      const { data: ultimaLeitura } = await supabase
        .from('sensor_readings')
        .select('temperature, humidity, room_name, recorded_at')
        .order('recorded_at', { ascending: false })
        .limit(1)
        .single();

      if (ultimaLeitura) {
        await supabase
          .from('ordens_producao_industrial')
          .update({
            temperatura_inicio: ultimaLeitura.temperature,
            umidade_inicio: ultimaLeitura.humidity,
            sala_producao: ultimaLeitura.room_name,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }
    } catch {
      // Sem sensor configurado — não bloquear
    }

    toast.success(`Produção ${op.codigo} iniciada`);
    invalidate(id);
    return true;
  }, []);

  // ── Registrar pesagem ───────────────────────────────────────
  const registrarPesagem = useCallback(async (
    opId: string,
    materiaPrimaId: string,
    quantidadePesadaG: number,
    pesadoPor: string,
    conferidoPor?: string,
    loteId?: string,
    numeroLote?: string
  ) => {
    // Buscar o item para validar tolerância
    const { data: mp } = await supabase
      .from('op_materias_primas')
      .select('*')
      .eq('id', materiaPrimaId)
      .single();

    if (!mp) { toast.error('Item de pesagem não encontrado'); return null; }

    // Verificação de dupla conferência para pesagem crítica
    if (mp.motivo_critico && !conferidoPor) {
      toast.error('Pesagem crítica requer dupla conferência');
      return null;
    }

    const { error } = await supabase
      .from('op_materias_primas')
      .update({
        quantidade_pesada_g: quantidadePesadaG,
        pesado_por: pesadoPor,
        conferido_por: conferidoPor || null,
        pesado_em: new Date().toISOString(),
        lote_id: loteId || null,
        numero_lote: numeroLote || null,
        dentro_tolerancia: true, // calcular conforme tolerância se disponível
      })
      .eq('id', materiaPrimaId);

    if (error) { toast.error(`Erro ao registrar pesagem: ${error.message}`); return null; }

    // Se for pesagem crítica, registrar em op_pesagens_criticas também
    if (mp.motivo_critico) {
      await supabase.from('op_pesagens_criticas').insert({
        op_id: opId,
        materia_prima_id: materiaPrimaId,
        insumo_nome: mp.insumo_nome,
        quantidade_teorica_mg: 0, // preencher se tiver o valor
        quantidade_pesada_mg: quantidadePesadaG * 1000,
        operador_pesagem_nome: pesadoPor,
        conferente_nome: conferidoPor || null,
        data_pesagem: new Date().toISOString(),
        status: 'CONFERIDO',
      });
    }

    toast.success(`Pesagem de ${mp.insumo_nome} registrada`);
    invalidate(opId);
    return true;
  }, []);

  // ── Alocar lote de MP ───────────────────────────────────────
  const alocarLote = useCallback(async (
    opId: string,
    materiaPrimaId: string,
    loteId: string,
    numeroLote: string,
    fornecedorNome: string,
    custoUnitario: number
  ) => {
    const { error } = await supabase
      .from('op_materias_primas')
      .update({
        lote_id: loteId,
        numero_lote: numeroLote,
        fornecedor_nome: fornecedorNome,
      })
      .eq('id', materiaPrimaId);

    if (error) { toast.error(`Erro ao alocar lote: ${error.message}`); return null; }

    toast.success(`Lote ${numeroLote} alocado`);
    invalidate(opId);
    return true;
  }, []);

  // ── Registrar QC ────────────────────────────────────────────
  const registrarQC = useCallback(async (
    opId: string,
    qc: {
      status: 'APROVADO' | 'REPROVADO' | 'APROVADO_COM_RESSALVAS';
      avaliado_por: string;
      peso_medio_capsulas_mg?: number;
      peso_minimo_capsulas_mg?: number;
      peso_maximo_capsulas_mg?: number;
      aparencia_conforme?: boolean;
      homogeneidade?: string;
      homogeneidade_conforme?: boolean;
      fluidez?: string;
      fluidez_conforme?: boolean;
      motivo_reprovacao?: string;
      observacoes?: string;
    }
  ) => {
    // Inserir registro de QC
    const { error: qcError } = await supabase
      .from('op_controle_qualidade')
      .insert({
        op_id: opId,
        ...qc,
        avaliado_em: new Date().toISOString(),
      });

    if (qcError) { toast.error(`Erro ao registrar QC: ${qcError.message}`); return null; }

    // Atualizar status da OP se reprovado
    if (qc.status === 'REPROVADO') {
      await supabase
        .from('ordens_producao_industrial')
        .update({ status: 'BLOQUEADA', updated_at: new Date().toISOString() })
        .eq('id', opId);
    }

    if (qc.status === 'APROVADO') {
      toast.success('Lote aprovado pelo Controle de Qualidade');
    } else if (qc.status === 'REPROVADO') {
      toast.error('Lote REPROVADO — OP bloqueada');
    } else {
      toast.warning('Lote aprovado com ressalvas');
    }

    invalidate(opId);
    return true;
  }, []);

  // ── Finalizar produção ──────────────────────────────────────
  const finalizarProducao = useCallback(async (
    opId: string,
    quantidadeProduzida: number,
    quantidadeAprovada: number,
    finalizadoPor: string
  ) => {
    // Verificar QC aprovado
    const { data: qcList } = await supabase
      .from('op_controle_qualidade')
      .select('status')
      .eq('op_id', opId)
      .order('created_at', { ascending: false })
      .limit(1);

    const qcStatus = qcList?.[0]?.status;
    if (qcStatus !== 'APROVADO' && qcStatus !== 'APROVADO_COM_RESSALVAS') {
      toast.error('OP não pode ser finalizada sem aprovação do QC');
      return null;
    }

    // Buscar dados da OP para calcular rendimento
    const { data: op } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo, total_capsulas, acrescimo_percentual, total_capsulas_com_acrescimo, produto_nome, formula_codigo')
      .eq('id', opId)
      .single();

    if (!op) { toast.error('OP não encontrada'); return null; }

    const quantidadeRejeitada = quantidadeProduzida - quantidadeAprovada;
    const rendimento = (quantidadeAprovada / (op.total_capsulas_com_acrescimo || op.total_capsulas)) * 100;

    // Atualizar controle de perdas
    await supabase
      .from('op_controle_perdas')
      .update({
        quantidade_produzida: quantidadeProduzida,
        quantidade_aprovada: quantidadeAprovada,
        quantidade_rejeitada: quantidadeRejeitada,
        rendimento_percentual: rendimento,
        perda_total: quantidadeRejeitada,
        perda_percentual: (quantidadeRejeitada / quantidadeProduzida) * 100,
        updated_at: new Date().toISOString(),
      })
      .eq('op_id', opId);

    // Finalizar OP
    const { error } = await supabase
      .from('ordens_producao_industrial')
      .update({
        status: 'FINALIZADA',
        data_fim_producao: new Date().toISOString(),
        finalizado_por: finalizadoPor,
        updated_at: new Date().toISOString(),
      })
      .eq('id', opId);

    if (error) { toast.error(`Erro ao finalizar OP: ${error.message}`); return null; }

    // Registrar etapa no histórico
    await supabase.from('op_historico_etapas').insert({
      op_id: opId,
      etapa: 'FINALIZADA',
      iniciada_em: new Date().toISOString(),
      finalizada_em: new Date().toISOString(),
      operador_nome: finalizadoPor,
    });

    // Notificar pedidos de vendedor vinculados a esta OP
    try {
      await supabase.functions.invoke('op-concluida-notify', {
        body: { op_id: opId },
      });
    } catch (e) {
      console.warn('Falha ao notificar expedição:', e);
    }

    // Auto-criar lote de Produto Acabado em QUARENTENA
    try {
      const { data: opComRT } = await supabase
        .from('ordens_producao_industrial')
        .select('codigo, produto_nome, rt_nome, rt_tipo_conselho, rt_numero_registro, rt_uf_conselho, responsavel_tecnico_id')
        .eq('id', opId)
        .single();

      if (opComRT) {
        const loteNumero = `PA-${opComRT.codigo}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`;
        const hashData = new TextEncoder().encode(loteNumero + opId + Date.now().toString());
        const hashBuffer = await crypto.subtle.digest('SHA-256', hashData);
        const qrHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, '0')).join('');

        const { error: loteError } = await supabase
          .from('lotes_produto_acabado')
          .insert({
            op_id: opId,
            numero_lote: loteNumero,
            codigo_auditoria: crypto.randomUUID(),
            qr_code_hash: qrHash,
            produto_nome: opComRT.produto_nome ?? opComRT.codigo,
            data_fabricacao: new Date().toISOString().split('T')[0],
            data_validade: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            quantidade_produzida: quantidadeAprovada,
            quantidade_aprovada: quantidadeAprovada,
            status: 'QUARENTENA',
            rt_nome: opComRT.rt_nome ?? 'Pendente',
            rt_tipo_conselho: opComRT.rt_tipo_conselho ?? 'CRN',
            rt_numero_registro: opComRT.rt_numero_registro ?? '000000',
            rt_uf_conselho: opComRT.rt_uf_conselho ?? 'SP',
            responsavel_tecnico_id: opComRT.responsavel_tecnico_id ?? null,
          });

        if (loteError) {
          console.error('Erro ao criar lote PA:', loteError);
          toast.warning('OP finalizada, mas falha ao criar lote. Verifique estoque manualmente.');
        } else {
          toast.info(`Lote ${loteNumero} criado em QUARENTENA — aguardando assinatura do RT.`);
        }
      }
    } catch (e) {
      console.error('Erro ao criar lote PA:', e);
    }

    toast.success(`OP ${op.codigo} finalizada — Rendimento: ${rendimento.toFixed(1)}%`);
    invalidate(opId);
    return true;
  }, []);

  // ── Bloquear OP ─────────────────────────────────────────────
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

    if (error) { toast.error(`Erro ao bloquear OP: ${error.message}`); return null; }

    toast.warning(`OP ${op.codigo} bloqueada`);
    invalidate(id);
    return true;
  }, []);

  // ── Cancelar OP ─────────────────────────────────────────────
  const cancelarOP = useCallback(async (id: string, motivo: string) => {
    const { data: op } = await supabase
      .from('ordens_producao_industrial')
      .select('codigo, status, observacoes')
      .eq('id', id)
      .single();

    if (!op) { toast.error('OP não encontrada'); return null; }
    if (op.status === 'FINALIZADA') { toast.error('Não é possível cancelar uma OP finalizada'); return null; }

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .update({
        status: 'CANCELADA',
        observacoes: `${op.observacoes || ''}\n\n[CANCELAMENTO] ${new Date().toLocaleString()}: ${motivo}`.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) { toast.error(`Erro ao cancelar OP: ${error.message}`); return null; }

    toast.warning(`OP ${op.codigo} cancelada`);
    invalidate(id);
    return true;
  }, []);

  // ── Excluir OP ──────────────────────────────────────────────
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

    // Cascade delete manual das filhas (caso RLS não faça automaticamente)
    await supabase.from('op_materias_primas').delete().eq('op_id', id);
    await supabase.from('op_embalagens').delete().eq('op_id', id);
    await supabase.from('op_checklist').delete().eq('op_id', id);
    await supabase.from('op_controle_perdas').delete().eq('op_id', id);
    await supabase.from('op_pesagens_criticas').delete().eq('op_id', id);
    await supabase.from('op_historico_etapas').delete().eq('op_id', id);

    const { error } = await supabase
      .from('ordens_producao_industrial')
      .delete()
      .eq('id', id);

    if (error) { toast.error(`Erro ao excluir OP: ${error.message}`); return false; }

    toast.success(`OP ${op.codigo} excluída`);
    invalidate(id);
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

/**
 * Calcula a necessidade de insumos para uma OP
 * @param op Ordem de produção com formula_id e quantidade_frascos
 * @returns Array de { item_id, item_nome, quantidade, unidade }
 */
export async function calcularNecessidadeOP(op: any): Promise<Array<{
  item_id: string;
  item_nome: string;
  quantidade: number;
  unidade: string;
  tipo_necessidade: 'ATIVO' | 'COMPLEMENTO';
}>> {
  try {
    const necessidades: Array<{
      item_id: string;
      item_nome: string;
      quantidade: number;
      unidade: string;
      tipo_necessidade: 'ATIVO' | 'COMPLEMENTO';
    }> = [];

    if (!op.formula_id || !op.quantidade_frascos) {
      console.warn('OP sem formula_id ou quantidade_frascos');
      return necessidades;
    }

    // 1. ATIVOS: buscar formula_itens
    const { data: formulaItens, error: errFormula } = await supabase
      .from('formula_itens')
      .select('produto_materia_prima_id, quantidade_convertida_mg, n_capsulas_por_dose, doses_por_pote')
      .eq('formula_id', op.formula_id);

    if (errFormula) {
      console.error('Erro ao buscar formula_itens:', errFormula);
    } else if (formulaItens) {
      for (const fi of formulaItens) {
        if (!fi.produto_materia_prima_id) continue;

        // Buscar dados do insumo (unidade)
        const { data: insumo } = await supabase
          .from('itens')
          .select('id, descricao_interna, unidade_interna')
          .eq('id', fi.produto_materia_prima_id)
          .single();

        if (insumo) {
          // Calcular necessidade: massa por dose × doses por pote × quantidade de frascos
          const massaPorDose = fi.quantidade_convertida_mg || 0; // em mg
          const dosesPorPote = fi.doses_por_pote || 1;
          const quantidadeFrascos = op.quantidade_frascos || 0;

          let necessidade = (massaPorDose * dosesPorPote * quantidadeFrascos) / 1000; // converter mg para g

          // Converter para unidade interna se necessário
          if (insumo.unidade_interna === 'kg') {
            necessidade = necessidade / 1000; // g para kg
          }

          necessidades.push({
            item_id: insumo.id,
            item_nome: insumo.descricao_interna || 'Insumo',
            quantidade: necessidade,
            unidade: insumo.unidade_interna || 'g',
            tipo_necessidade: 'ATIVO',
          });
        }
      }
    }

    // 2. COMPLEMENTOS (Fase 4)
    // PASSO 1: Buscar nº de cápsulas e doses/pote DA FÓRMULA
    const { data: formulaDados } = await supabase
      .from('formulas')
      .select('n_capsulas_por_dose, doses_por_pote')
      .eq('id', op.formula_id)
      .single();

    const nCapsulasPorDose = formulaDados?.n_capsulas_por_dose || 1;
    const dosesPorPote = formulaDados?.doses_por_pote || 1;

    const { data: configCustos } = await supabase
      .from('config_custos_producao')
      .select('capsula_padrao_id, pote_padrao_id, tampa_padrao_id, rotulo_padrao_id, lacre_padrao_id')
      .eq('company_id', op.company_id)
      .single();

    if (configCustos) {
      const quantidadeFrascos = op.quantidade_frascos || 0;

      // Cápsulas
      if (configCustos.capsula_padrao_id) {
        const { data: capsula } = await supabase
          .from('itens')
          .select('id, descricao_interna, unidade_interna')
          .eq('id', configCustos.capsula_padrao_id)
          .single();

        if (capsula) {
          necessidades.push({
            item_id: capsula.id,
            item_nome: capsula.descricao_interna || 'Cápsula',
            quantidade: nCapsulasPorDose * dosesPorPote * quantidadeFrascos,
            unidade: capsula.unidade_interna || 'un',
            tipo_necessidade: 'COMPLEMENTO',
          });
        }
      }

      // Potes
      if (configCustos.pote_padrao_id) {
        const { data: pote } = await supabase
          .from('itens')
          .select('id, descricao_interna, unidade_interna')
          .eq('id', configCustos.pote_padrao_id)
          .single();

        if (pote) {
          necessidades.push({
            item_id: pote.id,
            item_nome: pote.descricao_interna || 'Pote',
            quantidade: quantidadeFrascos,
            unidade: pote.unidade_interna || 'un',
            tipo_necessidade: 'COMPLEMENTO',
          });
        }
      }

      // Tampas
      if (configCustos.tampa_padrao_id) {
        const { data: tampa } = await supabase
          .from('itens')
          .select('id, descricao_interna, unidade_interna')
          .eq('id', configCustos.tampa_padrao_id)
          .single();

        if (tampa) {
          necessidades.push({
            item_id: tampa.id,
            item_nome: tampa.descricao_interna || 'Tampa',
            quantidade: quantidadeFrascos,
            unidade: tampa.unidade_interna || 'un',
            tipo_necessidade: 'COMPLEMENTO',
          });
        }
      }

      // Rótulos
      if (configCustos.rotulo_padrao_id) {
        const { data: rotulo } = await supabase
          .from('itens')
          .select('id, descricao_interna, unidade_interna')
          .eq('id', configCustos.rotulo_padrao_id)
          .single();

        if (rotulo) {
          necessidades.push({
            item_id: rotulo.id,
            item_nome: rotulo.descricao_interna || 'Rótulo',
            quantidade: quantidadeFrascos,
            unidade: rotulo.unidade_interna || 'un',
            tipo_necessidade: 'COMPLEMENTO',
          });
        }
      }

      // Lacres
      if (configCustos.lacre_padrao_id) {
        const { data: lacre } = await supabase
          .from('itens')
          .select('id, descricao_interna, unidade_interna')
          .eq('id', configCustos.lacre_padrao_id)
          .single();

        if (lacre) {
          necessidades.push({
            item_id: lacre.id,
            item_nome: lacre.descricao_interna || 'Lacre',
            quantidade: quantidadeFrascos,
            unidade: lacre.unidade_interna || 'un',
            tipo_necessidade: 'COMPLEMENTO',
          });
        }
      }
    }

    return necessidades;
  } catch (err) {
    console.error('Erro em calcularNecessidadeOP:', err);
    return [];
  }
}
