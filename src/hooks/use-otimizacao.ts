import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  SugestaoOtimizacao, 
  TipoSugestaoOtimizacao,
  StatusSugestao 
} from '@/types/inteligencia-industrial';
import { toast } from 'sonner';

// ============================================================
// HOOK: SUGESTÕES DE OTIMIZAÇÃO
// ============================================================

export function useSugestoesOtimizacao() {
  const [sugestoes, setSugestoes] = useState<SugestaoOtimizacao[]>([]);
  const [loading, setLoading] = useState(true);

  const stats = {
    total: sugestoes.length,
    pendentes: sugestoes.filter(s => s.status === 'PENDENTE').length,
    aprovadas: sugestoes.filter(s => s.status === 'APROVADA').length,
    implementadas: sugestoes.filter(s => s.status === 'IMPLEMENTADA').length,
  };

  const fetchSugestoes = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('sugestoes_otimizacao')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erro ao buscar sugestões:', error);
    } else {
      setSugestoes((data || []).map(s => ({
        ...s,
        dados_analise: s.dados_analise as Record<string, unknown>,
      })) as SugestaoOtimizacao[]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSugestoes();
  }, [fetchSugestoes]);

  return { sugestoes, stats, loading, refresh: fetchSugestoes };
}

// ============================================================
// HOOK: GERADOR DE SUGESTÕES
// ============================================================

export function useGeradorSugestoes() {
  const [gerando, setGerando] = useState(false);

  // Criar sugestão
  const criarSugestao = async (
    entidadeTipo: 'FORMULA' | 'OP' | 'PROCESSO',
    entidadeId: string,
    entidadeCodigo: string,
    tipoSugestao: TipoSugestaoOtimizacao,
    titulo: string,
    descricao: string,
    justificativa: string,
    impactoEstimado?: number,
    impactoUnidade?: string,
    dadosAnalise?: Record<string, unknown>
  ) => {
    const insertData = {
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      entidade_codigo: entidadeCodigo,
      tipo_sugestao: tipoSugestao as string,
      titulo,
      descricao,
      justificativa_tecnica: justificativa,
      impacto_estimado: impactoEstimado ?? null,
      impacto_unidade: impactoUnidade ?? null,
      dados_analise: dadosAnalise ? JSON.parse(JSON.stringify(dadosAnalise)) : {},
    };
    
    const { error } = await supabase
      .from('sugestoes_otimizacao')
      .insert(insertData as any);
    if (error) {
      console.error('Erro ao criar sugestão:', error);
      return false;
    }

    return true;
  };

  // Analisar fórmula e sugerir otimizações
  const analisarFormula = async (formulaId: string, formulaCodigo: string) => {
    setGerando(true);

    try {
      // Buscar fórmula e itens
      const { data: formula } = await supabase
        .from('formulas')
        .select('*, formula_itens(*)')
        .eq('id', formulaId)
        .single();

      if (!formula) {
        toast.error('Fórmula não encontrada');
        return;
      }

      const itens = formula.formula_itens || [];
      const sugestoesCriadas: string[] = [];

      // Análise 1: Verificar distribuição de excipientes
      const pesoTotal = itens.reduce((sum: number, i: any) => sum + (i.quantidade_convertida_mg || 0), 0);
      const pesoAtivos = itens
        .filter((i: any) => !i.nome_insumo?.toLowerCase().includes('amido') && 
                          !i.nome_insumo?.toLowerCase().includes('celulose'))
        .reduce((sum: number, i: any) => sum + (i.quantidade_convertida_mg || 0), 0);
      
      const percentExcipiente = ((pesoTotal - pesoAtivos) / pesoTotal) * 100;
      
      if (percentExcipiente > 60) {
        await criarSugestao(
          'FORMULA',
          formulaId,
          formulaCodigo,
          'AJUSTE_EXCIPIENTE',
          'Reduzir proporção de excipiente',
          `Excipiente representa ${percentExcipiente.toFixed(1)}% da fórmula. Considerar redução para melhor aproveitamento.`,
          'Alta proporção de excipiente pode indicar dosagem sub-ótima de ativos ou oportunidade de usar cápsula menor.',
          percentExcipiente - 50,
          '% redução'
        );
        sugestoesCriadas.push('Ajuste de excipiente');
      }

      // Análise 2: Verificar se há ativos higroscópicos juntos
      const itensHigroscopicos = itens.filter((i: any) => 
        i.nome_insumo?.toLowerCase().includes('vitamina c') ||
        i.nome_insumo?.toLowerCase().includes('cloreto')
      );

      if (itensHigroscopicos.length > 1) {
        await criarSugestao(
          'FORMULA',
          formulaId,
          formulaCodigo,
          'ALTERACAO_PROCESSO',
          'Separar ativos higroscópicos',
          'Múltiplos ativos higroscópicos identificados. Considerar pré-mistura individual.',
          'Ativos higroscópicos podem absorver umidade e afetar estabilidade quando misturados.',
          5,
          '% melhoria estabilidade'
        );
        sugestoesCriadas.push('Processo higroscópicos');
      }

      // Análise 3: Verificar ordem de mistura otimizada
      const temTalco = itens.some((i: any) => i.nome_insumo?.toLowerCase().includes('talco'));
      const temSilicio = itens.some((i: any) => i.nome_insumo?.toLowerCase().includes('silício'));
      const temEstearato = itens.some((i: any) => i.nome_insumo?.toLowerCase().includes('estearato'));

      if (temTalco && temSilicio && temEstearato) {
        // Fórmula completa com deslizantes
      } else if (!temSilicio && pesoTotal > 400) {
        await criarSugestao(
          'FORMULA',
          formulaId,
          formulaCodigo,
          'MELHORIA_RENDIMENTO',
          'Adicionar dióxido de silício',
          'Fórmula sem dióxido de silício pode ter problemas de fluidez.',
          'Dióxido de silício (1-2%) melhora fluidez do pó e facilita encapsulamento, aumentando rendimento.',
          3,
          '% aumento rendimento'
        );
        sugestoesCriadas.push('Adicionar silício');
      }

      if (sugestoesCriadas.length > 0) {
        toast.success(`${sugestoesCriadas.length} sugestão(ões) gerada(s)`);
      } else {
        toast.info('Nenhuma sugestão de otimização identificada');
      }

    } catch (error) {
      console.error('Erro ao analisar fórmula:', error);
      toast.error('Erro na análise');
    } finally {
      setGerando(false);
    }
  };

  // Analisar OP finalizada e sugerir melhorias
  const analisarOPFinalizada = async (
    opId: string,
    opCodigo: string,
    rendimentoReal: number,
    custoReal: number,
    custoEstimado: number
  ) => {
    const sugestoesCriadas: string[] = [];

    // Sugestão se rendimento baixo
    if (rendimentoReal < 95) {
      await criarSugestao(
        'OP',
        opId,
        opCodigo,
        'REDUCAO_PERDA',
        'Investigar perdas na produção',
        `Rendimento de ${rendimentoReal.toFixed(1)}% está abaixo do esperado (95%).`,
        'Perdas acima de 5% impactam custo e devem ser investigadas: pesagem, mistura ou encapsulamento.',
        95 - rendimentoReal,
        '% perda'
      );
      sugestoesCriadas.push('Redução de perda');
    }

    // Sugestão se custo muito acima do estimado
    const desvioCusto = ((custoReal - custoEstimado) / custoEstimado) * 100;
    if (desvioCusto > 10) {
      await criarSugestao(
        'OP',
        opId,
        opCodigo,
        'ECONOMIA_CUSTO',
        'Custo acima do previsto',
        `Custo real ${desvioCusto.toFixed(1)}% acima do estimado.`,
        'Revisar lotes utilizados (custos de MP), tempo de produção e overhead aplicado.',
        desvioCusto,
        '% acima'
      );
      sugestoesCriadas.push('Economia de custo');
    }

    return sugestoesCriadas;
  };

  // Atualizar status da sugestão
  const atualizarStatus = async (
    sugestaoId: string, 
    status: StatusSugestao, 
    observacoes?: string
  ) => {
    const updates: Record<string, unknown> = { status };
    
    if (status === 'APROVADA') {
      updates.aprovado_em = new Date().toISOString();
    }
    if (status === 'IMPLEMENTADA') {
      updates.implementado_em = new Date().toISOString();
      if (observacoes) {
        updates.observacoes_implementacao = observacoes;
      }
    }

    const { error } = await supabase
      .from('sugestoes_otimizacao')
      .update(updates)
      .eq('id', sugestaoId);

    if (error) {
      toast.error('Erro ao atualizar sugestão');
      return false;
    }

    toast.success('Sugestão atualizada');
    return true;
  };

  return {
    criarSugestao,
    analisarFormula,
    analisarOPFinalizada,
    atualizarStatus,
    gerando,
  };
}
