import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  AnomaliaOperacional, 
  TipoAnomalia, 
  SeveridadeAnomalia,
  StatusAnomalia,
  detectarAnomalia,
  PARAMETROS_DETECCAO_PADRAO 
} from '@/types/inteligencia-industrial';
import { toast } from 'sonner';

// ============================================================
// HOOK: ANOMALIAS OPERACIONAIS
// ============================================================

export function useAnomaliasOperacionais() {
  const [anomalias, setAnomalias] = useState<AnomaliaOperacional[]>([]);
  const [loading, setLoading] = useState(true);

  const stats = {
    total: anomalias.length,
    pendentes: anomalias.filter(a => a.status === 'PENDENTE').length,
    criticas: anomalias.filter(a => a.severidade === 'CRITICA').length,
    altas: anomalias.filter(a => a.severidade === 'ALTA').length,
  };

  const fetchAnomalias = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('anomalias_operacionais')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Erro ao buscar anomalias:', error);
    } else {
      setAnomalias((data || []) as AnomaliaOperacional[]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAnomalias();
  }, [fetchAnomalias]);

  return { anomalias, stats, loading, refresh: fetchAnomalias };
}

// ============================================================
// HOOK: DETECTOR DE ANOMALIAS
// ============================================================

export function useDetectorAnomalias() {
  const [detectando, setDetectando] = useState(false);

  // Registrar anomalia
  const registrarAnomalia = async (
    tipo: TipoAnomalia,
    descricao: string,
    valorEsperado: number,
    valorReal: number,
    severidade: SeveridadeAnomalia,
    opId?: string,
    loteId?: string,
    formulaId?: string
  ) => {
    const desvio = valorEsperado !== 0 
      ? ((valorReal - valorEsperado) / valorEsperado) * 100 
      : 0;

    const { error } = await supabase
      .from('anomalias_operacionais')
      .insert({
        op_id: opId || null,
        lote_id: loteId || null,
        formula_id: formulaId || null,
        tipo_anomalia: tipo,
        descricao,
        valor_esperado: valorEsperado,
        valor_real: valorReal,
        desvio_percentual: Math.round(desvio * 100) / 100,
        severidade,
        status: 'PENDENTE',
      });

    if (error) {
      console.error('Erro ao registrar anomalia:', error);
      return false;
    }

    // Se crítica, gerar alerta executivo
    if (severidade === 'CRITICA') {
      await supabase.from('alertas_executivos').insert({
        tipo_alerta: 'ANOMALIA_DETECTADA',
        nivel: 'CRITICO',
        titulo: `Anomalia Crítica: ${tipo}`,
        descricao,
        entidade_tipo: opId ? 'OP' : loteId ? 'LOTE' : 'FORMULA',
        entidade_id: opId || loteId || formulaId,
        valor_referencia: valorEsperado,
        valor_atual: valorReal,
        acao_sugerida: 'Revisar operação imediatamente',
      });
    }

    return true;
  };

  // Verificar peso de cápsulas
  const verificarPesoCapsulas = async (
    opId: string,
    pesoMedioReal: number,
    pesoNominal: number = 500
  ) => {
    const tolerancia = PARAMETROS_DETECCAO_PADRAO.peso_tolerancia_percent;
    const resultado = detectarAnomalia(pesoNominal, pesoMedioReal, tolerancia);

    if (resultado.isAnomalia) {
      await registrarAnomalia(
        'PESO_FORA_PADRAO',
        `Peso médio de ${pesoMedioReal}mg desvia ${resultado.desvioPercent.toFixed(1)}% do nominal (${pesoNominal}mg)`,
        pesoNominal,
        pesoMedioReal,
        resultado.severidade,
        opId
      );
      return { anomalia: true, ...resultado };
    }

    return { anomalia: false, ...resultado };
  };

  // Verificar consumo de MP
  const verificarConsumoMP = async (
    opId: string,
    insumoNome: string,
    consumoEsperado: number,
    consumoReal: number
  ) => {
    const tolerancia = PARAMETROS_DETECCAO_PADRAO.consumo_tolerancia_percent;
    const resultado = detectarAnomalia(consumoEsperado, consumoReal, tolerancia);

    if (resultado.isAnomalia) {
      await registrarAnomalia(
        'CONSUMO_EXCESSIVO',
        `Consumo de ${insumoNome}: ${consumoReal.toFixed(2)}g vs esperado ${consumoEsperado.toFixed(2)}g (${resultado.desvioPercent > 0 ? '+' : ''}${resultado.desvioPercent.toFixed(1)}%)`,
        consumoEsperado,
        consumoReal,
        resultado.severidade,
        opId
      );
      return { anomalia: true, ...resultado };
    }

    return { anomalia: false, ...resultado };
  };

  // Verificar tempo de produção
  const verificarTempoProducao = async (
    opId: string,
    tempoEstimadoMin: number,
    tempoRealMin: number
  ) => {
    const tolerancia = PARAMETROS_DETECCAO_PADRAO.tempo_tolerancia_percent;
    const resultado = detectarAnomalia(tempoEstimadoMin, tempoRealMin, tolerancia);

    if (resultado.isAnomalia) {
      await registrarAnomalia(
        'TEMPO_ANORMAL',
        `Tempo de produção: ${tempoRealMin}min vs estimado ${tempoEstimadoMin}min (${resultado.desvioPercent > 0 ? '+' : ''}${resultado.desvioPercent.toFixed(1)}%)`,
        tempoEstimadoMin,
        tempoRealMin,
        resultado.severidade,
        opId
      );
      return { anomalia: true, ...resultado };
    }

    return { anomalia: false, ...resultado };
  };

  // Verificar rendimento
  const verificarRendimento = async (
    opId: string,
    quantidadePlanejada: number,
    quantidadeProduzida: number
  ) => {
    const rendimentoReal = (quantidadeProduzida / quantidadePlanejada) * 100;
    const rendimentoMinimo = PARAMETROS_DETECCAO_PADRAO.rendimento_minimo_percent;

    if (rendimentoReal < rendimentoMinimo) {
      const severidade: SeveridadeAnomalia = 
        rendimentoReal < 70 ? 'CRITICA' :
        rendimentoReal < 80 ? 'ALTA' :
        rendimentoReal < 85 ? 'MEDIA' : 'BAIXA';

      await registrarAnomalia(
        'RENDIMENTO_BAIXO',
        `Rendimento de ${rendimentoReal.toFixed(1)}% abaixo do mínimo (${rendimentoMinimo}%)`,
        quantidadePlanejada,
        quantidadeProduzida,
        severidade,
        opId
      );
      return { anomalia: true, rendimentoReal, severidade };
    }

    return { anomalia: false, rendimentoReal, severidade: 'INFO' as SeveridadeAnomalia };
  };

  // Atualizar status da anomalia
  const atualizarStatus = async (anomaliaId: string, status: StatusAnomalia, observacoes?: string) => {
    const updates: Record<string, unknown> = { status };
    
    if (status === 'RESOLVIDA') {
      updates.resolvido_em = new Date().toISOString();
    }
    if (observacoes) {
      updates.analise_observacoes = observacoes;
    }

    const { error } = await supabase
      .from('anomalias_operacionais')
      .update(updates)
      .eq('id', anomaliaId);

    if (error) {
      toast.error('Erro ao atualizar anomalia');
      return false;
    }

    toast.success('Anomalia atualizada');
    return true;
  };

  return {
    registrarAnomalia,
    verificarPesoCapsulas,
    verificarConsumoMP,
    verificarTempoProducao,
    verificarRendimento,
    atualizarStatus,
    detectando,
  };
}
