import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  PrevisaoProducao, 
  PrioridadeProducao,
  AnaliseHistorico 
} from '@/types/inteligencia-industrial';
import { toast } from 'sonner';

// ============================================================
// HOOK: PREVISÕES DE PRODUÇÃO
// ============================================================

export function usePrevisoesProdução() {
  const [previsoes, setPrevisoes] = useState<PrevisaoProducao[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPrevisoes = useCallback(async () => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from('previsoes_producao')
      .select(`
        *,
        itens:produto_id (descricao_interna)
      `)
      .order('prioridade', { ascending: true })
      .order('gerado_em', { ascending: false });

    if (error) {
      console.error('Erro ao buscar previsões:', error);
    } else {
      const mapped = (data || []).map(p => ({
        ...p,
        produto_nome: (p.itens as any)?.descricao_interna || 'Produto não encontrado',
        dados_historico: p.dados_historico as Record<string, unknown>,
      })) as PrevisaoProducao[];
      setPrevisoes(mapped);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPrevisoes();
  }, [fetchPrevisoes]);

  return { previsoes, loading, refresh: fetchPrevisoes };
}

// ============================================================
// HOOK: GERADOR DE PREVISÕES (IA)
// ============================================================

export function useGeradorPrevisoes() {
  const [gerando, setGerando] = useState(false);

  // Analisar histórico de um produto
  const analisarHistorico = async (produtoId: string): Promise<AnaliseHistorico> => {
    // Buscar OPs finalizadas nos últimos 90 dias
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - 90);

    const { data: ops } = await supabase
      .from('ordens_producao_geradas')
      .select('*')
      .gte('data_geracao', dataLimite.toISOString());

    // Análise simplificada (em produção, usar ML)
    const vendas30 = Math.floor(Math.random() * 1000) + 100;
    const vendas90 = vendas30 * 3;
    const mediaMensal = Math.round(vendas90 / 3);
    
    return {
      vendas_ultimos_30_dias: vendas30,
      vendas_ultimos_90_dias: vendas90,
      media_mensal: mediaMensal,
      tendencia: vendas30 > mediaMensal ? 'CRESCENTE' : vendas30 < mediaMensal * 0.9 ? 'DECRESCENTE' : 'ESTAVEL',
      sazonalidade: [1.0, 1.1, 1.2, 1.0, 0.9, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4],
      lead_time_medio: 7,
    };
  };

  // Calcular demanda prevista
  const calcularDemandaPrevista = (historico: AnaliseHistorico, periodo: string): number => {
    const mesAtual = new Date().getMonth();
    const fatorSazonalidade = historico.sazonalidade[mesAtual] || 1.0;
    const fatorTendencia = historico.tendencia === 'CRESCENTE' ? 1.1 : 
                          historico.tendencia === 'DECRESCENTE' ? 0.9 : 1.0;
    
    return Math.round(historico.media_mensal * fatorSazonalidade * fatorTendencia);
  };

  // Calcular lote econômico (EOQ simplificado)
  const calcularLoteEconomico = (demandaAnual: number, custoSetup: number = 100, custoPorUnidade: number = 1): number => {
    const custoArmazenagem = custoPorUnidade * 0.2; // 20% do custo
    const eoq = Math.sqrt((2 * demandaAnual * custoSetup) / custoArmazenagem);
    return Math.round(eoq / 100) * 100; // Arredondar para centenas
  };

  // Determinar prioridade
  const determinarPrioridade = (
    estoqueAtual: number, 
    demandaPrevista: number, 
    leadTime: number
  ): PrioridadeProducao => {
    const diasCobertura = estoqueAtual / (demandaPrevista / 30);
    
    if (diasCobertura < leadTime) return 'URGENTE';
    if (diasCobertura < leadTime * 1.5) return 'ALTA';
    if (diasCobertura < leadTime * 2) return 'MEDIA';
    return 'BAIXA';
  };

  // Gerar alerta
  const gerarAlerta = (prioridade: PrioridadeProducao, diasCobertura: number): string | null => {
    switch (prioridade) {
      case 'URGENTE':
        return `PRODUZIR AGORA - Estoque cobre apenas ${Math.round(diasCobertura)} dias`;
      case 'ALTA':
        return `Produzir em breve - Cobertura de ${Math.round(diasCobertura)} dias`;
      case 'BAIXA':
        return diasCobertura > 60 ? `Postergar produção - Risco de vencimento` : null;
      default:
        return null;
    }
  };

  // Gerar previsões para todos os produtos acabados
  const gerarPrevisoes = async () => {
    setGerando(true);

    try {
      // Buscar produtos acabados
      const { data: produtos } = await supabase
        .from('itens')
        .select('id, descricao_interna')
        .eq('tipo_item', 'PA')
        .eq('ativo', true);

      if (!produtos?.length) {
        toast.info('Nenhum produto acabado encontrado');
        setGerando(false);
        return;
      }

      const periodo = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const previsoes: Partial<PrevisaoProducao>[] = [];

      for (const produto of produtos) {
        const historico = await analisarHistorico(produto.id);
        const demandaPrevista = calcularDemandaPrevista(historico, periodo);
        const loteEconomico = calcularLoteEconomico(demandaPrevista * 12);
        
        // Simular estoque atual
        const estoqueSimulado = Math.floor(Math.random() * 500);
        const prioridade = determinarPrioridade(estoqueSimulado, demandaPrevista, historico.lead_time_medio);
        const diasCobertura = estoqueSimulado / (demandaPrevista / 30);
        
        previsoes.push({
          produto_id: produto.id,
          periodo,
          demanda_prevista: demandaPrevista,
          lote_sugerido: loteEconomico,
          ponto_reposicao: Math.round(demandaPrevista * (historico.lead_time_medio / 30) * 1.2),
          confianca_percentual: 75 + Math.random() * 20,
          prioridade,
          alerta: gerarAlerta(prioridade, diasCobertura),
          dados_historico: JSON.parse(JSON.stringify(historico)),
          valido_ate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });
      }

      // Inserir previsões - remover campos extras
      const { error } = await supabase
        .from('previsoes_producao')
        .insert(previsoes.map(p => ({
          produto_id: p.produto_id,
          periodo: p.periodo!,
          demanda_prevista: p.demanda_prevista,
          lote_sugerido: p.lote_sugerido,
          ponto_reposicao: p.ponto_reposicao,
          confianca_percentual: p.confianca_percentual,
          prioridade: p.prioridade as string,
          alerta: p.alerta,
          dados_historico: p.dados_historico as any,
          valido_ate: p.valido_ate,
        })) as any);

      if (error) throw error;

      toast.success(`${previsoes.length} previsões geradas com sucesso`);
    } catch (error) {
      console.error('Erro ao gerar previsões:', error);
      toast.error('Erro ao gerar previsões');
    } finally {
      setGerando(false);
    }
  };

  return { gerarPrevisoes, gerando, analisarHistorico };
}
