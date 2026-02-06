import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  ConfigCapacidadeProducao, 
  SimulacaoProducao,
  DadosFormulaSimulacao,
  simularProducao,
  calcularDesvio,
  Gargalo,
  Sugestao,
} from '@/types/simulador-producao';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';

// ============================================================
// HOOK: CONFIGURAÇÃO DE CAPACIDADE
// ============================================================

export function useConfigCapacidadeProducao() {
  const [config, setConfig] = useState<ConfigCapacidadeProducao | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('config_capacidade_producao')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar config capacidade:', error);
    }
    
    setConfig(data as ConfigCapacidadeProducao | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = async (updates: Partial<ConfigCapacidadeProducao>) => {
    if (!config) return null;

    const { data, error } = await supabase
      .from('config_capacidade_producao')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', config.id)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao atualizar configuração de capacidade');
      return null;
    }

    setConfig(data as ConfigCapacidadeProducao);
    toast.success('Configuração de capacidade atualizada');
    return data;
  };

  return { config, loading, updateConfig, refresh: fetchConfig };
}

// ============================================================
// HOOK: SIMULAÇÕES
// ============================================================

export function useSimulacoesProducao(formulaId?: string) {
  const [simulacoes, setSimulacoes] = useState<SimulacaoProducao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSimulacoes = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('simulacoes_producao')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (formulaId) {
      query = query.eq('formula_id', formulaId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar simulações:', error);
    }

    // Parse JSONB fields
    const parsed = (data || []).map(s => ({
      ...s,
      gargalos: (Array.isArray(s.gargalos) ? s.gargalos : []) as unknown as Gargalo[],
      sugestoes: (Array.isArray(s.sugestoes) ? s.sugestoes : []) as unknown as Sugestao[],
    })) as SimulacaoProducao[];

    setSimulacoes(parsed);
    setLoading(false);
  }, [formulaId]);

  useEffect(() => {
    fetchSimulacoes();
  }, [fetchSimulacoes]);

  return { simulacoes, loading, refresh: fetchSimulacoes };
}

// ============================================================
// HOOK: SIMULADOR
// ============================================================

export function useSimuladorProducao() {
  const { config, loading: loadingConfig } = useConfigCapacidadeProducao();

  // Executar simulação
  const executarSimulacao = useCallback(async (
    formula: DadosFormulaSimulacao,
    quantidade: number,
    custoMPEstimado: number
  ): Promise<SimulacaoProducao | null> => {
    if (!config) {
      toast.error('Configuração de capacidade não disponível');
      return null;
    }

    const resultado = simularProducao(formula, quantidade, config, custoMPEstimado);

    // Salvar simulação
    const { data, error } = await supabase
      .from('simulacoes_producao')
      .insert({
        formula_id: resultado.formula_id,
        formula_codigo: resultado.formula_codigo,
        quantidade_unidades: resultado.quantidade_unidades,
        tempo_pesagem_estimado: resultado.tempo_pesagem_estimado,
        tempo_mistura_estimado: resultado.tempo_mistura_estimado,
        tempo_encapsulamento_estimado: resultado.tempo_encapsulamento_estimado,
        tempo_qc_estimado: resultado.tempo_qc_estimado,
        tempo_total_estimado: resultado.tempo_total_estimado,
        custo_mp_estimado: resultado.custo_mp_estimado,
        custo_mao_obra_estimado: resultado.custo_mao_obra_estimado,
        custo_overhead_estimado: resultado.custo_overhead_estimado,
        custo_total_estimado: resultado.custo_total_estimado,
        custo_unitario_estimado: resultado.custo_unitario_estimado,
        rendimento_esperado_percent: resultado.rendimento_esperado_percent,
        perdas_estimadas_unidades: resultado.perdas_estimadas_unidades,
        gargalos: resultado.gargalos as unknown as Json,
        sugestoes: resultado.sugestoes as unknown as Json,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar simulação:', error);
      toast.error('Erro ao salvar simulação');
      return null;
    }

    toast.success('Simulação concluída');
    return {
      ...data,
      gargalos: (Array.isArray(data.gargalos) ? data.gargalos : []) as unknown as Gargalo[],
      sugestoes: (Array.isArray(data.sugestoes) ? data.sugestoes : []) as unknown as Sugestao[],
    } as SimulacaoProducao;
  }, [config]);

  // Simular sem salvar (preview)
  const simularPreview = useCallback((
    formula: DadosFormulaSimulacao,
    quantidade: number,
    custoMPEstimado: number
  ): Omit<SimulacaoProducao, 'id' | 'created_at'> | null => {
    if (!config) return null;
    return simularProducao(formula, quantidade, config, custoMPEstimado);
  }, [config]);

  // Comparar com real após OP finalizada
  const compararComReal = async (
    simulacaoId: string,
    opId: string,
    custoReal: number,
    tempoRealMin: number
  ): Promise<boolean> => {
    // Buscar simulação original
    const { data: simulacao } = await supabase
      .from('simulacoes_producao')
      .select('custo_total_estimado, tempo_total_estimado')
      .eq('id', simulacaoId)
      .single();

    if (!simulacao) return false;

    const desvioCusto = calcularDesvio(simulacao.custo_total_estimado, custoReal);
    const desvioTempo = calcularDesvio(simulacao.tempo_total_estimado, tempoRealMin);

    const { error } = await supabase
      .from('simulacoes_producao')
      .update({
        op_id: opId,
        custo_real: custoReal,
        tempo_real_min: tempoRealMin,
        desvio_custo_percent: desvioCusto,
        desvio_tempo_percent: desvioTempo,
      })
      .eq('id', simulacaoId);

    if (error) {
      console.error('Erro ao comparar com real:', error);
      return false;
    }

    return true;
  };

  return {
    config,
    loadingConfig,
    executarSimulacao,
    simularPreview,
    compararComReal,
  };
}
