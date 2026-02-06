import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  CustoOP, 
  CustoOPLote, 
  ConfigCustosProducao,
  calcularCustoMaoObra,
  calcularCustoOverhead,
  calcularCustoEmbalagem,
  calcularCustoPerdas,
  calcularRateioImpostos,
} from '@/types/custo-industrial';
import { toast } from 'sonner';

// ============================================================
// HOOK: CONFIGURAÇÃO DE CUSTOS
// ============================================================

export function useConfigCustosProducao() {
  const [config, setConfig] = useState<ConfigCustosProducao | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('config_custos_producao')
      .select('*')
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Erro ao buscar config custos:', error);
    }
    
    setConfig(data as ConfigCustosProducao | null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const updateConfig = async (updates: Partial<ConfigCustosProducao>) => {
    if (!config) return null;

    const { data, error } = await supabase
      .from('config_custos_producao')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', config.id)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao atualizar configuração de custos');
      return null;
    }

    setConfig(data as ConfigCustosProducao);
    toast.success('Configuração de custos atualizada');
    return data;
  };

  return { config, loading, updateConfig, refresh: fetchConfig };
}

// ============================================================
// HOOK: CUSTO POR OP
// ============================================================

export function useCustoOP(opId: string | undefined) {
  const [custo, setCusto] = useState<CustoOP | null>(null);
  const [lotesConsumidos, setLotesConsumidos] = useState<CustoOPLote[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCusto = useCallback(async () => {
    if (!opId) {
      setCusto(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Buscar custo da OP
    const { data: custoData, error: custoError } = await supabase
      .from('custos_op')
      .select('*')
      .eq('op_id', opId)
      .maybeSingle();

    if (custoError && custoError.code !== 'PGRST116') {
      console.error('Erro ao buscar custo OP:', custoError);
    }

    setCusto(custoData as CustoOP | null);

    // Buscar lotes consumidos se existir custo
    if (custoData) {
      const { data: lotesData } = await supabase
        .from('custos_op_lotes')
        .select('*')
        .eq('custo_op_id', custoData.id)
        .order('created_at', { ascending: true });

      setLotesConsumidos((lotesData || []) as CustoOPLote[]);
    }

    setLoading(false);
  }, [opId]);

  useEffect(() => {
    fetchCusto();
  }, [fetchCusto]);

  return { custo, lotesConsumidos, loading, refresh: fetchCusto };
}

// ============================================================
// HOOK: AÇÕES DE CUSTO
// ============================================================

export function useCustoOPActions() {
  const { config } = useConfigCustosProducao();

  // Criar registro de custo para uma OP
  const criarCustoOP = async (
    opId: string,
    opCodigo: string,
    tipoApresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO',
    quantidadePlanejada: number
  ): Promise<CustoOP | null> => {
    const custoEmbalagem = config 
      ? calcularCustoEmbalagem(quantidadePlanejada, tipoApresentacao, config)
      : 0;

    const { data, error } = await supabase
      .from('custos_op')
      .insert({
        op_id: opId,
        op_codigo: opCodigo,
        custo_embalagem: custoEmbalagem,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao criar custo OP:', error);
      return null;
    }

    return data as CustoOP;
  };

  // Registrar lote consumido
  const registrarLoteConsumido = async (
    custoOpId: string,
    loteId: string,
    numeroLote: string,
    insumoNome: string,
    quantidadeConsumidaG: number,
    custoUnitarioLote: number,
    impostos?: { icms: number; ipi: number; pis: number; cofins: number }
  ): Promise<CustoOPLote | null> => {
    const { data, error } = await supabase
      .from('custos_op_lotes')
      .insert({
        custo_op_id: custoOpId,
        lote_id: loteId,
        numero_lote: numeroLote,
        insumo_nome: insumoNome,
        quantidade_consumida_g: quantidadeConsumidaG,
        custo_unitario_lote: custoUnitarioLote,
        custo_total_lote: quantidadeConsumidaG * custoUnitarioLote,
        icms_valor: impostos?.icms || 0,
        ipi_valor: impostos?.ipi || 0,
        pis_valor: impostos?.pis || 0,
        cofins_valor: impostos?.cofins || 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao registrar lote consumido:', error);
      return null;
    }

    return data as CustoOPLote;
  };

  // Calcular e atualizar custo total
  const calcularCustoTotal = async (
    custoOpId: string,
    tempoTotalMinutos: number,
    quantidadePlanejada: number,
    quantidadeProduzida: number
  ): Promise<CustoOP | null> => {
    if (!config) {
      toast.error('Configuração de custos não disponível');
      return null;
    }

    // Buscar lotes consumidos
    const { data: lotes } = await supabase
      .from('custos_op_lotes')
      .select('*')
      .eq('custo_op_id', custoOpId);

    const lotesConsumidos = (lotes || []) as CustoOPLote[];

    // Calcular custo MP
    const custoMP = lotesConsumidos.reduce((sum, l) => sum + l.custo_total_lote, 0);

    // Calcular mão de obra
    const custoMaoObra = calcularCustoMaoObra(tempoTotalMinutos, config);

    // Calcular overhead
    const custoBase = custoMP + custoMaoObra;
    const custoOverhead = calcularCustoOverhead(custoBase, config);

    // Calcular perdas
    const custoTotal = custoMP + custoMaoObra + custoOverhead;
    const custoPerdas = calcularCustoPerdas(custoTotal, quantidadePlanejada, quantidadeProduzida);

    // Calcular rateio de impostos
    const impostos = calcularRateioImpostos(lotesConsumidos, custoMP);

    // Custo final
    const custoTotalReal = custoTotal + custoPerdas;
    const custoUnitarioReal = custoTotalReal / quantidadeProduzida;

    const { data, error } = await supabase
      .from('custos_op')
      .update({
        custo_materia_prima_real: custoMP,
        custo_mao_obra: custoMaoObra,
        custo_overhead: custoOverhead,
        custo_perdas: custoPerdas,
        impostos_icms_rateado: impostos.icms,
        impostos_ipi_rateado: impostos.ipi,
        impostos_pis_rateado: impostos.pis,
        impostos_cofins_rateado: impostos.cofins,
        impostos_total_rateado: impostos.total,
        custo_total_real: custoTotalReal,
        custo_unitario_real: custoUnitarioReal,
        quantidade_produzida: quantidadeProduzida,
        quantidade_perdas: quantidadePlanejada - quantidadeProduzida,
        updated_at: new Date().toISOString(),
      })
      .eq('id', custoOpId)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao calcular custo total');
      return null;
    }

    return data as CustoOP;
  };

  // Fechar custo (imutável)
  const fecharCusto = async (custoOpId: string, userId?: string): Promise<boolean> => {
    const { error } = await supabase
      .from('custos_op')
      .update({
        status: 'FECHADO',
        fechado_em: new Date().toISOString(),
        fechado_por: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', custoOpId)
      .eq('status', 'ABERTO');

    if (error) {
      toast.error('Erro ao fechar custo');
      return false;
    }

    toast.success('Custo da OP fechado e travado');
    return true;
  };

  return {
    criarCustoOP,
    registrarLoteConsumido,
    calcularCustoTotal,
    fecharCusto,
  };
}
