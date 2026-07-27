import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getUserCompanyId } from '@/hooks/use-user-company';
import { StatusOP } from '@/types/ordem-producao-industrial';

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
      .select('produto_materia_prima_id, quantidade_convertida_mg')
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
          const dosesPorPote = formulaDados?.doses_por_pote || 1; // vem da fórmula, não do item
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

    // Guardar contra fórmula sem cápsulas/dose (fórmulas antigas)
    if (!formulaDados?.n_capsulas_por_dose || !formulaDados?.doses_por_pote) {
      console.warn(
        `Fórmula ${op.formula_id} sem n_capsulas_por_dose ou doses_por_pote preenchidos. ` +
        `Necessidade de cápsulas pode ficar imprecisa. Usando fallback: 1 cápsula/dose, 1 dose/pote.`
      );
    }

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
