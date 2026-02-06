import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AlertaExecutivo, 
  KPIsExecutivos,
  TipoAlertaExecutivo,
  NivelAlerta,
  StatusAlertaExecutivo 
} from '@/types/inteligencia-industrial';
import { toast } from 'sonner';

// ============================================================
// HOOK: ALERTAS EXECUTIVOS
// ============================================================

export function useAlertasExecutivos() {
  const [alertas, setAlertas] = useState<AlertaExecutivo[]>([]);
  const [loading, setLoading] = useState(true);

  const stats = {
    total: alertas.length,
    ativos: alertas.filter(a => a.status === 'ATIVO').length,
    criticos: alertas.filter(a => a.nivel === 'CRITICO' && a.status === 'ATIVO').length,
    altos: alertas.filter(a => a.nivel === 'ALTO' && a.status === 'ATIVO').length,
  };

  const fetchAlertas = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('alertas_executivos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Erro ao buscar alertas:', error);
    } else {
      setAlertas((data || []).map(a => ({
        ...a,
        dados_contexto: a.dados_contexto as Record<string, unknown>,
      })) as AlertaExecutivo[]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAlertas();
  }, [fetchAlertas]);

  return { alertas, stats, loading, refresh: fetchAlertas };
}

// ============================================================
// HOOK: GERADOR DE ALERTAS
// ============================================================

export function useGeradorAlertas() {
  // Criar alerta
  const criarAlerta = async (
    tipo: TipoAlertaExecutivo,
    nivel: NivelAlerta,
    titulo: string,
    descricao: string,
    acaoSugerida?: string,
    entidadeTipo?: string,
    entidadeId?: string,
    entidadeCodigo?: string,
    valorReferencia?: number,
    valorAtual?: number,
    impactoFinanceiro?: number,
    dadosContexto?: Record<string, unknown>
  ) => {
    const insertData = {
      tipo_alerta: tipo as string,
      nivel: nivel as string,
      titulo,
      descricao,
      acao_sugerida: acaoSugerida ?? null,
      entidade_tipo: entidadeTipo ?? null,
      entidade_id: entidadeId ?? null,
      entidade_codigo: entidadeCodigo ?? null,
      valor_referencia: valorReferencia ?? null,
      valor_atual: valorAtual ?? null,
      impacto_financeiro: impactoFinanceiro ?? null,
      dados_contexto: dadosContexto ? JSON.parse(JSON.stringify(dadosContexto)) : {},
    };
    
    const { error } = await supabase
      .from('alertas_executivos')
      .insert(insertData as any);
    if (error) {
      console.error('Erro ao criar alerta:', error);
      return false;
    }

    return true;
  };

  // Alertas específicos
  const alertarMargemBaixa = async (
    produtoId: string,
    produtoCodigo: string,
    margemAtual: number,
    margemMinima: number
  ) => {
    return criarAlerta(
      'MARGEM_BAIXA',
      margemAtual < 0 ? 'CRITICO' : 'ALTO',
      `Margem abaixo do esperado: ${produtoCodigo}`,
      `Margem atual de ${margemAtual.toFixed(1)}% está ${margemAtual < 0 ? 'NEGATIVA' : `abaixo do mínimo (${margemMinima}%)`}`,
      'Revisar precificação ou custos de produção',
      'PRODUTO',
      produtoId,
      produtoCodigo,
      margemMinima,
      margemAtual,
      undefined
    );
  };

  const alertarEstoqueCritico = async (
    produtoId: string,
    produtoCodigo: string,
    estoqueAtual: number,
    pontoReposicao: number,
    diasCobertura: number
  ) => {
    return criarAlerta(
      'ESTOQUE_CRITICO',
      diasCobertura < 7 ? 'CRITICO' : 'ALTO',
      `Estoque crítico: ${produtoCodigo}`,
      `Estoque de ${estoqueAtual} unidades cobre apenas ${diasCobertura.toFixed(0)} dias`,
      'Iniciar ordem de produção imediatamente',
      'PRODUTO',
      produtoId,
      produtoCodigo,
      pontoReposicao,
      estoqueAtual
    );
  };

  const alertarVencimentoProximo = async (
    loteId: string,
    loteCodigo: string,
    produtoNome: string,
    diasParaVencimento: number,
    quantidade: number,
    valorEstimado: number
  ) => {
    return criarAlerta(
      'VENCIMENTO_PROXIMO',
      diasParaVencimento < 30 ? 'CRITICO' : diasParaVencimento < 60 ? 'ALTO' : 'MEDIO',
      `Lote próximo do vencimento: ${loteCodigo}`,
      `${produtoNome} - ${quantidade} unidades vencem em ${diasParaVencimento} dias`,
      diasParaVencimento < 30 ? 'Priorizar uso ou descarte' : 'Planejar uso prioritário',
      'LOTE',
      loteId,
      loteCodigo,
      undefined,
      diasParaVencimento,
      valorEstimado
    );
  };

  const alertarRiscoRegulatorio = async (
    entidadeTipo: string,
    entidadeId: string,
    entidadeCodigo: string,
    descricaoRisco: string,
    fonteLegal: string
  ) => {
    return criarAlerta(
      'RISCO_REGULATORIO',
      'CRITICO',
      `Risco regulatório: ${entidadeCodigo}`,
      descricaoRisco,
      `Consultar regulamentação: ${fonteLegal}`,
      entidadeTipo,
      entidadeId,
      entidadeCodigo
    );
  };

  // Atualizar status do alerta
  const atualizarStatus = async (
    alertaId: string, 
    status: StatusAlertaExecutivo,
    observacoes?: string
  ) => {
    const updates: Record<string, unknown> = { status };
    
    if (status === 'VISUALIZADO') {
      updates.visualizado_em = new Date().toISOString();
    }
    if (status === 'RESOLVIDO') {
      updates.resolvido_em = new Date().toISOString();
      if (observacoes) {
        updates.resolucao_observacoes = observacoes;
      }
    }

    const { error } = await supabase
      .from('alertas_executivos')
      .update(updates)
      .eq('id', alertaId);

    if (error) {
      toast.error('Erro ao atualizar alerta');
      return false;
    }

    return true;
  };

  return {
    criarAlerta,
    alertarMargemBaixa,
    alertarEstoqueCritico,
    alertarVencimentoProximo,
    alertarRiscoRegulatorio,
    atualizarStatus,
  };
}

// ============================================================
// HOOK: KPIs EXECUTIVOS
// ============================================================

export function useKPIsExecutivos() {
  const [kpis, setKpis] = useState<KPIsExecutivos | null>(null);
  const [historico, setHistorico] = useState<KPIsExecutivos[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchKPIs = useCallback(async () => {
    setLoading(true);
    
    const hoje = new Date().toISOString().split('T')[0];
    
    // Buscar KPI de hoje
    const { data: kpiHoje } = await supabase
      .from('kpis_executivos')
      .select('*')
      .eq('data_referencia', hoje)
      .single();

    if (kpiHoje) {
      setKpis({
        ...kpiHoje,
        dados_detalhados: kpiHoje.dados_detalhados as Record<string, unknown>,
      } as KPIsExecutivos);
    }

    // Buscar histórico dos últimos 30 dias
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 30);

    const { data: historicoData } = await supabase
      .from('kpis_executivos')
      .select('*')
      .gte('data_referencia', dataLimite.toISOString().split('T')[0])
      .order('data_referencia', { ascending: false });

    if (historicoData) {
      setHistorico(historicoData.map(k => ({
        ...k,
        dados_detalhados: k.dados_detalhados as Record<string, unknown>,
      })) as KPIsExecutivos[]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKPIs();
  }, [fetchKPIs]);

  // Gerar KPIs do dia
  const gerarKPIsDiarios = async () => {
    const hoje = new Date().toISOString().split('T')[0];

    // Calcular métricas
    const { count: opsFinalizadas } = await supabase
      .from('ordens_producao_geradas')
      .select('*', { count: 'exact', head: true });

    const { data: alertas } = await supabase
      .from('alertas_executivos')
      .select('tipo_alerta, nivel')
      .eq('status', 'ATIVO');

    const { data: anomalias } = await supabase
      .from('anomalias_operacionais')
      .select('severidade')
      .eq('status', 'PENDENTE');

    const { data: rankings } = await supabase
      .from('ranking_fornecedores')
      .select('classificacao');

    const { data: validacoes } = await supabase
      .from('log_validacoes_anvisa')
      .select('resultado')
      .gte('created_at', hoje);

    const kpisData = {
      data_referencia: hoje,
      ops_finalizadas: opsFinalizadas || 0,
      ops_bloqueadas: 0,
      rendimento_medio_percent: 95,
      custo_medio_unitario: 0,
      taxa_aprovacao_qc: 98,
      total_anomalias: anomalias?.length || 0,
      anomalias_criticas: anomalias?.filter(a => a.severidade === 'CRITICA').length || 0,
      fornecedores_risco: rankings?.filter(r => r.classificacao === 'RISCO' || r.classificacao === 'BLOQUEADO').length || 0,
      nao_conformidades: 0,
      margem_media_percent: 25,
      custo_total_producao: 0,
      validacoes_bloqueio: validacoes?.filter(v => v.resultado === 'BLOQUEIO').length || 0,
      alertas_regulatorios: alertas?.filter(a => a.tipo_alerta === 'RISCO_REGULATORIO').length || 0,
    };

    const { error } = await supabase
      .from('kpis_executivos')
      .upsert(kpisData, { onConflict: 'data_referencia' });

    if (error) {
      console.error('Erro ao gerar KPIs:', error);
      return null;
    }

    fetchKPIs();
    return kpisData;
  };

  return {
    kpis,
    historico,
    loading,
    gerarKPIsDiarios,
    refresh: fetchKPIs,
  };
}
