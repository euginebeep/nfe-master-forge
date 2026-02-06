import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  RankingFornecedor, 
  AvaliacaoFornecedor,
  ClassificacaoFornecedor,
  calcularScoreTotal,
  classificarFornecedor,
  PESOS_RANKING_PADRAO 
} from '@/types/inteligencia-industrial';
import { toast } from 'sonner';

// ============================================================
// HOOK: RANKING DE FORNECEDORES
// ============================================================

export function useRankingFornecedores() {
  const [rankings, setRankings] = useState<RankingFornecedor[]>([]);
  const [loading, setLoading] = useState(true);

  const stats = {
    total: rankings.length,
    preferenciais: rankings.filter(r => r.classificacao === 'PREFERENCIAL').length,
    regulares: rankings.filter(r => r.classificacao === 'REGULAR').length,
    risco: rankings.filter(r => r.classificacao === 'RISCO').length,
    bloqueados: rankings.filter(r => r.classificacao === 'BLOQUEADO').length,
  };

  const fetchRankings = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('ranking_fornecedores')
      .select(`
        *,
        entidades:fornecedor_id (razao_social, nome_fantasia)
      `)
      .order('score_total', { ascending: false });

    if (error) {
      console.error('Erro ao buscar rankings:', error);
    } else {
      const mapped = (data || []).map(r => ({
        ...r,
        fornecedor_nome: (r.entidades as any)?.nome_fantasia || (r.entidades as any)?.razao_social || 'Fornecedor',
        dados_historico: r.dados_historico as unknown[],
      })) as RankingFornecedor[];
      setRankings(mapped);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return { rankings, stats, loading, refresh: fetchRankings };
}

// ============================================================
// HOOK: AVALIADOR DE FORNECEDORES
// ============================================================

export function useAvaliadorFornecedores() {
  const [avaliando, setAvaliando] = useState(false);

  // Registrar avaliação individual
  const registrarAvaliacao = async (
    fornecedorId: string,
    tipoAvaliacao: string,
    score: number,
    observacoes?: string,
    loteId?: string,
    notaEntradaId?: string
  ) => {
    const { error } = await supabase
      .from('avaliacoes_fornecedor')
      .insert({
        fornecedor_id: fornecedorId,
        tipo_avaliacao: tipoAvaliacao,
        score,
        observacoes,
        lote_id: loteId,
        nota_entrada_id: notaEntradaId,
      });

    if (error) {
      console.error('Erro ao registrar avaliação:', error);
      return false;
    }

    // Recalcular ranking
    await recalcularRanking(fornecedorId);
    return true;
  };

  // Recalcular ranking de um fornecedor
  const recalcularRanking = async (fornecedorId: string) => {
    // Buscar todas as avaliações do fornecedor
    const { data: avaliacoes } = await supabase
      .from('avaliacoes_fornecedor')
      .select('*')
      .eq('fornecedor_id', fornecedorId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (!avaliacoes?.length) return;

    // Calcular scores por tipo
    const scoresPorTipo: Record<string, number[]> = {};
    avaliacoes.forEach(a => {
      if (!scoresPorTipo[a.tipo_avaliacao]) {
        scoresPorTipo[a.tipo_avaliacao] = [];
      }
      scoresPorTipo[a.tipo_avaliacao].push(a.score);
    });

    const calcularMedia = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 50;

    const scores = {
      score_qualidade: calcularMedia(scoresPorTipo['QUALIDADE'] || []),
      score_custo: calcularMedia(scoresPorTipo['CUSTO'] || []),
      score_pontualidade: calcularMedia(scoresPorTipo['PONTUALIDADE'] || []),
      score_conformidade: calcularMedia(scoresPorTipo['CONFORMIDADE'] || []),
      score_variacao_preco: calcularMedia(scoresPorTipo['VARIACAO_PRECO'] || []),
    };

    const scoreTotal = calcularScoreTotal(scores, PESOS_RANKING_PADRAO);
    const classificacao = classificarFornecedor(scoreTotal);

    // Contar estatísticas
    const { count: totalLotes } = await supabase
      .from('estoque_lotes')
      .select('*', { count: 'exact', head: true })
      .eq('fornecedor_id', fornecedorId);

    const { count: naoConformidades } = await supabase
      .from('avaliacoes_fornecedor')
      .select('*', { count: 'exact', head: true })
      .eq('fornecedor_id', fornecedorId)
      .eq('tipo_avaliacao', 'NAO_CONFORMIDADE');

    // Upsert ranking
    const { error } = await supabase
      .from('ranking_fornecedores')
      .upsert({
        fornecedor_id: fornecedorId,
        ...scores,
        score_total: scoreTotal,
        classificacao,
        total_lotes_recebidos: totalLotes || 0,
        total_nao_conformidades: naoConformidades || 0,
        ultima_avaliacao: new Date().toISOString(),
      }, {
        onConflict: 'fornecedor_id',
      });

    if (error) {
      console.error('Erro ao atualizar ranking:', error);
    }

    // Se classificação for RISCO, gerar alerta
    if (classificacao === 'RISCO' || classificacao === 'BLOQUEADO') {
      await supabase.from('alertas_executivos').insert({
        tipo_alerta: 'FORNECEDOR_RISCO',
        nivel: classificacao === 'BLOQUEADO' ? 'CRITICO' : 'ALTO',
        titulo: `Fornecedor em ${classificacao}`,
        descricao: `Score total: ${scoreTotal.toFixed(1)}. Requer atenção.`,
        entidade_tipo: 'FORNECEDOR',
        entidade_id: fornecedorId,
        valor_atual: scoreTotal,
        acao_sugerida: classificacao === 'BLOQUEADO' 
          ? 'Bloquear novas compras deste fornecedor'
          : 'Revisar histórico e considerar alternativas',
      });
    }
  };

  // Avaliar qualidade de lote
  const avaliarQualidadeLote = async (
    fornecedorId: string,
    loteId: string,
    aprovado: boolean,
    observacoes?: string
  ) => {
    const score = aprovado ? 100 : 0;
    await registrarAvaliacao(fornecedorId, 'QUALIDADE', score, observacoes, loteId);
    
    if (!aprovado) {
      await registrarAvaliacao(fornecedorId, 'NAO_CONFORMIDADE', 0, observacoes, loteId);
    }
  };

  // Avaliar pontualidade de entrega
  const avaliarPontualidade = async (
    fornecedorId: string,
    notaEntradaId: string,
    diasAtraso: number
  ) => {
    // Score baseado em dias de atraso
    const score = diasAtraso <= 0 ? 100 : Math.max(0, 100 - diasAtraso * 10);
    await registrarAvaliacao(
      fornecedorId, 
      'PONTUALIDADE', 
      score, 
      diasAtraso > 0 ? `${diasAtraso} dias de atraso` : 'Entrega pontual',
      undefined,
      notaEntradaId
    );
  };

  // Avaliar custo
  const avaliarCusto = async (
    fornecedorId: string,
    custoAtual: number,
    custoMercado: number,
    notaEntradaId?: string
  ) => {
    // Score: 100 se abaixo do mercado, decresce conforme fica acima
    const variacao = ((custoAtual - custoMercado) / custoMercado) * 100;
    const score = Math.max(0, Math.min(100, 100 - variacao * 2));
    
    await registrarAvaliacao(
      fornecedorId,
      'CUSTO',
      score,
      `Custo ${variacao > 0 ? '+' : ''}${variacao.toFixed(1)}% vs mercado`,
      undefined,
      notaEntradaId
    );
  };

  // Recalcular todos os rankings
  const recalcularTodosRankings = async () => {
    setAvaliando(true);

    try {
      // Buscar todos os fornecedores
      const { data: fornecedores } = await supabase
        .from('entidades')
        .select('id')
        .contains('tags', ['FORNECEDOR']);

      if (!fornecedores?.length) {
        // Buscar por papel
        const { data: papeis } = await supabase
          .from('entidade_papeis')
          .select('entidade_id')
          .eq('papel', 'FORNECEDOR');

        if (papeis?.length) {
          for (const p of papeis) {
            await recalcularRanking(p.entidade_id);
          }
        }
      } else {
        for (const f of fornecedores) {
          await recalcularRanking(f.id);
        }
      }

      toast.success('Rankings recalculados');
    } catch (error) {
      console.error('Erro ao recalcular rankings:', error);
      toast.error('Erro ao recalcular rankings');
    } finally {
      setAvaliando(false);
    }
  };

  return {
    registrarAvaliacao,
    avaliarQualidadeLote,
    avaliarPontualidade,
    avaliarCusto,
    recalcularRanking,
    recalcularTodosRankings,
    avaliando,
  };
}
