import { useState, useEffect, useCallback, useMemo } from 'react';
import { LocalDb } from '@/lib/local-db';
import { 
  OrdemProducao, 
  StatusOrdemProducao,
  gerarCodigoOP,
  calcularConsumoInsumos,
} from '@/types/ordens-producao';
import { toast } from 'sonner';

// Gerar código único de OP
function generateOPCode(): string {
  const ops = LocalDb.getCollection<OrdemProducao>('ordens_producao' as any);
  const ano = new Date().getFullYear();
  const opsDoAno = ops.filter(op => op.codigo.startsWith(`OP-${ano}-`));
  const maxNum = opsDoAno.reduce((max, op) => {
    const match = op.codigo.match(/^OP-\d{4}-(\d+)$/);
    if (match) return Math.max(max, parseInt(match[1], 10));
    return max;
  }, 0);
  return gerarCodigoOP(ano, maxNum + 1);
}

export function useOrdensProducao(filters?: { status?: StatusOrdemProducao }) {
  const [ordens, setOrdens] = useState<OrdemProducao[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    let data = LocalDb.getCollection<OrdemProducao>('ordens_producao' as any);
    
    if (filters?.status) {
      data = data.filter(op => op.status === filters.status);
    }
    
    data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    setOrdens(data);
    setLoading(false);
  }, [filters?.status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection;
      if (!collection || collection === '*' || collection === 'ordens_producao') {
        refresh();
      }
    };
    window.addEventListener('localdb:change', handler);
    return () => window.removeEventListener('localdb:change', handler);
  }, [refresh]);

  // Estatísticas
  const stats = useMemo(() => {
    const todas = LocalDb.getCollection<OrdemProducao>('ordens_producao' as any);
    return {
      total: todas.length,
      aguardando: todas.filter(op => op.status === 'AGUARDANDO_INICIO' || op.status === 'AGUARDANDO_MATERIAIS').length,
      emProducao: todas.filter(op => op.status === 'EM_PRODUCAO').length,
      pausadas: todas.filter(op => op.status === 'PAUSADA').length,
      finalizadas: todas.filter(op => op.status === 'FINALIZADA').length,
    };
  }, [ordens]);

  return { data: ordens, isLoading: loading, refresh, stats };
}

export function useOrdemProducao(id: string | undefined) {
  const [ordem, setOrdem] = useState<OrdemProducao | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setOrdem(null);
      setLoading(false);
      return;
    }
    const data = LocalDb.getById<OrdemProducao>('ordens_producao' as any, id);
    setOrdem(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ordem, isLoading: loading, refresh };
}

export interface CriarOPParams {
  formula_id: string;
  quantidade_doses: number;
  data_prevista_inicio?: string;
  observacoes?: string;
  responsavel?: string;
}

// Interface simplificada para fórmula (compatível com novo sistema)
interface FormulaBasica {
  id: string;
  codigo: string;
  nome: string;
  produto_nome?: string;
  capsulas_por_dose: number;
  tipo_capsula: string;
  peso_total_capsula_mg: number;
  ingredientes: Array<{
    insumo_id: string;
    item_id?: string;
    nome_interno: string;
    categoria: string;
    peso_a_pesar_mg: number;
    custo_por_kg?: number;
  }>;
  excipientes: Array<{
    nome: string;
    peso_mg: number;
    custo_por_kg?: number;
  }>;
}

export function useCreateOrdemProducao() {
  const criarOP = useCallback((formula: FormulaBasica, params: CriarOPParams): OrdemProducao | null => {
    const totalCapsulas = params.quantidade_doses * formula.capsulas_por_dose;
    
    // Calcular consumo de insumos
    const insumos = calcularConsumoInsumos(
      formula.ingredientes,
      formula.excipientes,
      totalCapsulas
    );
    
    // Calcular totais
    const pesoTotalG = (formula.peso_total_capsula_mg * totalCapsulas) / 1000;
    const custoTotal = insumos.reduce((sum, i) => sum + (i.custo_total || 0), 0);
    
    const novaOP: Omit<OrdemProducao, 'id' | 'created_at'> = {
      codigo: generateOPCode(),
      formula_id: formula.id,
      formula_codigo: formula.codigo,
      produto_nome: formula.produto_nome || formula.nome,
      quantidade_doses: params.quantidade_doses,
      capsulas_por_dose: formula.capsulas_por_dose,
      total_capsulas: totalCapsulas,
      tipo_capsula: formula.tipo_capsula,
      peso_por_capsula_mg: formula.peso_total_capsula_mg,
      peso_total_lote_g: Math.round(pesoTotalG * 1000) / 1000,
      peso_total_lote_kg: Math.round(pesoTotalG / 1000 * 1000000) / 1000000,
      insumos,
      custo_total_insumos: Math.round(custoTotal * 100) / 100,
      custo_por_capsula: Math.round((custoTotal / totalCapsulas) * 10000) / 10000,
      data_prevista_inicio: params.data_prevista_inicio,
      progresso: 0,
      capsulas_produzidas: 0,
      status: 'AGUARDANDO_INICIO',
      status_baixa_estoque: 'PENDENTE',
      observacoes: params.observacoes,
      responsavel: params.responsavel,
      updated_at: new Date().toISOString(),
    };
    
    const op = LocalDb.insert<OrdemProducao>('ordens_producao' as any, novaOP);
    toast.success(`Ordem de Produção ${op.codigo} criada`);
    return op;
  }, []);

  return { criarOP };
}

export function useOrdemProducaoActions() {
  const iniciarProducao = useCallback((id: string) => {
    const op = LocalDb.getById<OrdemProducao>('ordens_producao' as any, id);
    if (!op) return null;
    
    const updated = LocalDb.update<OrdemProducao>('ordens_producao' as any, id, {
      status: 'EM_PRODUCAO',
      data_inicio: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.success(`Produção ${op.codigo} iniciada`);
    }
    return updated;
  }, []);

  const pausarProducao = useCallback((id: string) => {
    const op = LocalDb.getById<OrdemProducao>('ordens_producao' as any, id);
    if (!op) return null;
    
    const updated = LocalDb.update<OrdemProducao>('ordens_producao' as any, id, {
      status: 'PAUSADA',
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.info(`Produção ${op.codigo} pausada`);
    }
    return updated;
  }, []);

  const retomarProducao = useCallback((id: string) => {
    const op = LocalDb.getById<OrdemProducao>('ordens_producao' as any, id);
    if (!op) return null;
    
    const updated = LocalDb.update<OrdemProducao>('ordens_producao' as any, id, {
      status: 'EM_PRODUCAO',
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.success(`Produção ${op.codigo} retomada`);
    }
    return updated;
  }, []);

  const finalizarProducao = useCallback((id: string, capsulasProduzidasFinal: number) => {
    const op = LocalDb.getById<OrdemProducao>('ordens_producao' as any, id);
    if (!op) return null;
    
    const progresso = Math.round((capsulasProduzidasFinal / op.total_capsulas) * 100);
    
    const updated = LocalDb.update<OrdemProducao>('ordens_producao' as any, id, {
      status: 'FINALIZADA',
      data_conclusao: new Date().toISOString(),
      capsulas_produzidas: capsulasProduzidasFinal,
      progresso: Math.min(progresso, 100),
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.success(`Produção ${op.codigo} finalizada - ${capsulasProduzidasFinal} cápsulas`);
    }
    return updated;
  }, []);

  const atualizarProgresso = useCallback((id: string, capsulasProduzidasAtual: number) => {
    const op = LocalDb.getById<OrdemProducao>('ordens_producao' as any, id);
    if (!op) return null;
    
    const progresso = Math.round((capsulasProduzidasAtual / op.total_capsulas) * 100);
    
    const updated = LocalDb.update<OrdemProducao>('ordens_producao' as any, id, {
      capsulas_produzidas: capsulasProduzidasAtual,
      progresso: Math.min(progresso, 100),
      updated_at: new Date().toISOString(),
    });
    
    return updated;
  }, []);

  const cancelarProducao = useCallback((id: string, motivo?: string) => {
    const op = LocalDb.getById<OrdemProducao>('ordens_producao' as any, id);
    if (!op) return null;
    
    const updated = LocalDb.update<OrdemProducao>('ordens_producao' as any, id, {
      status: 'CANCELADA',
      observacoes: motivo ? `${op.observacoes || ''}\n\nMotivo cancelamento: ${motivo}`.trim() : op.observacoes,
      updated_at: new Date().toISOString(),
    });
    
    if (updated) {
      toast.warning(`Produção ${op.codigo} cancelada`);
    }
    return updated;
  }, []);

  const excluirOP = useCallback((id: string) => {
    const op = LocalDb.getById<OrdemProducao>('ordens_producao' as any, id);
    if (!op) return false;
    
    if (op.status !== 'RASCUNHO' && op.status !== 'CANCELADA') {
      toast.error('Só é possível excluir OPs em rascunho ou canceladas');
      return false;
    }
    
    LocalDb.remove('ordens_producao' as any, id);
    toast.success(`OP ${op.codigo} excluída`);
    return true;
  }, []);

  return {
    iniciarProducao,
    pausarProducao,
    retomarProducao,
    finalizarProducao,
    atualizarProgresso,
    cancelarProducao,
    excluirOP,
  };
}
