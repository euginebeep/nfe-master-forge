import { useState, useEffect, useCallback } from 'react';
import { LocalDb } from '@/lib/local-db';
import { Formula, FormulaIngrediente, FormulaAlerta, CAPSULA_CAPACIDADES } from '@/types/formulas';
import { toast } from 'sonner';

// Extend LocalDb collection types
declare module '@/lib/local-db' {
  interface CollectionTypes {
    formulas: Formula;
  }
}

export function useFormulas(filters?: { status?: string }) {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    let data = LocalDb.getCollection<Formula>('formulas' as any);
    
    if (filters?.status) {
      data = data.filter(f => f.status === filters.status);
    }
    
    // Sort by updated_at desc
    data.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    
    setFormulas(data);
    setLoading(false);
  }, [filters?.status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (event: Event) => {
      const collection = (event as CustomEvent)?.detail?.collection as string | undefined;
      if (!collection || collection === '*' || collection === 'formulas') {
        refresh();
      }
    };

    window.addEventListener('localdb:change', handler as EventListener);
    return () => window.removeEventListener('localdb:change', handler as EventListener);
  }, [refresh]);

  return { data: formulas, isLoading: loading, refresh };
}

export function useFormula(id: string | undefined) {
  const [formula, setFormula] = useState<Formula | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!id) {
      setFormula(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const data = LocalDb.getById<Formula>('formulas' as any, id);
    setFormula(data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { formula, isLoading: loading, refresh };
}

// Gerar código sequencial para fórmulas
function generateFormulaCode(): string {
  const formulas = LocalDb.getCollection<Formula>('formulas' as any);
  const maxNum = formulas.reduce((max, f) => {
    const match = f.codigo.match(/^FRM-(\d+)$/);
    if (match) {
      return Math.max(max, parseInt(match[1], 10));
    }
    return max;
  }, 0);
  return `FRM-${String(maxNum + 1).padStart(4, '0')}`;
}

// Calcular alertas da fórmula
export function calcularAlertas(formula: Partial<Formula>): FormulaAlerta[] {
  const alertas: FormulaAlerta[] = [];
  
  if (!formula.ingredientes?.length) return alertas;
  
  // Verificar ingredientes higroscópicos
  const higroscopicos = formula.ingredientes.filter(i => i.higroscopico);
  if (higroscopicos.length > 0) {
    alertas.push({
      tipo: 'HIGROSCOPICO',
      mensagem: `${higroscopicos.length} ingrediente(s) higroscópico(s): ${higroscopicos.map(h => h.item_descricao).join(', ')}. Considere manipulação em ambiente controlado.`,
      severidade: 'warning',
    });
  }
  
  // Verificar se excede capacidade
  const totalAtivos = formula.ingredientes.reduce((sum, i) => sum + (i.quantidade_manipulacao || 0), 0);
  const capacidade = formula.capacidade_mg || 0;
  
  if (totalAtivos > capacidade) {
    alertas.push({
      tipo: 'EXCEDE_CAPACIDADE',
      mensagem: `Total de ativos (${totalAtivos.toFixed(1)}mg) excede a capacidade da cápsula (${capacidade}mg)`,
      severidade: 'error',
    });
  }
  
  // Verificar potências baixas
  formula.ingredientes.forEach(ing => {
    if (ing.potencia && ing.potencia < 0.1) {
      alertas.push({
        tipo: 'POTENCIA_BAIXA',
        mensagem: `${ing.item_descricao} tem potência muito baixa (${(ing.potencia * 100).toFixed(1)}%). Verificar se é intencional.`,
        severidade: 'info',
        ingrediente_id: ing.id,
      });
    }
  });
  
  return alertas;
}

// Calcular Q.S.P.
export function calcularQSP(ingredientes: FormulaIngrediente[], capacidade_mg: number): number {
  const totalAtivos = ingredientes.reduce((sum, i) => sum + (i.quantidade_manipulacao || 0), 0);
  return Math.max(0, capacidade_mg - totalAtivos);
}

// Calcular quantidade de manipulação considerando potência
export function calcularQuantidadeManipulacao(
  quantidade_rotulo: number, 
  unidade_rotulo: string, 
  potencia?: number
): number {
  // Converter para mg se necessário
  let quantidade_mg = quantidade_rotulo;
  
  if (unidade_rotulo === 'g') {
    quantidade_mg = quantidade_rotulo * 1000;
  } else if (unidade_rotulo === 'mcg') {
    quantidade_mg = quantidade_rotulo / 1000;
  } else if (unidade_rotulo === 'UI') {
    // UI precisa de conversão específica por ativo - usar fator padrão conservador
    quantidade_mg = quantidade_rotulo * 0.025; // Conversão aproximada
  }
  
  // Aplicar potência (ex: potência 10% = multiplicar por 10 para obter quantidade bruta)
  if (potencia && potencia > 0 && potencia < 1) {
    quantidade_mg = quantidade_mg / potencia;
  }
  
  return quantidade_mg;
}

export function useCreateFormula() {
  const create = useCallback((data: Omit<Formula, 'id' | 'codigo' | 'created_at' | 'updated_at' | 'alertas' | 'total_ativos_mg' | 'qsp_mg'>) => {
    const codigo = generateFormulaCode();
    
    // Calcular totais
    const total_ativos_mg = data.ingredientes.reduce((sum, i) => sum + (i.quantidade_manipulacao || 0), 0);
    const qsp_mg = calcularQSP(data.ingredientes, data.capacidade_mg);
    const alertas = calcularAlertas({ ...data, total_ativos_mg, qsp_mg });
    
    const formula = LocalDb.insert<Formula>('formulas' as any, {
      ...data,
      codigo,
      total_ativos_mg,
      qsp_mg,
      alertas,
      versao: 1,
      status: data.status || 'RASCUNHO',
    });

    toast.success('Fórmula criada com sucesso');
    return formula;
  }, []);

  return { create };
}

export function useUpdateFormula() {
  const update = useCallback((id: string, data: Partial<Formula>) => {
    const existing = LocalDb.getById<Formula>('formulas' as any, id);
    if (!existing) {
      toast.error('Fórmula não encontrada');
      return null;
    }
    
    const merged = { ...existing, ...data };
    
    // Recalcular totais se ingredientes mudaram
    if (data.ingredientes || data.capacidade_mg) {
      merged.total_ativos_mg = merged.ingredientes.reduce((sum, i) => sum + (i.quantidade_manipulacao || 0), 0);
      merged.qsp_mg = calcularQSP(merged.ingredientes, merged.capacidade_mg);
      merged.alertas = calcularAlertas(merged);
    }
    
    const updated = LocalDb.update<Formula>('formulas' as any, id, merged);
    if (updated) {
      toast.success('Fórmula atualizada');
    }
    return updated;
  }, []);

  return { update };
}

export function useDeleteFormula() {
  const deleteFormula = useCallback((id: string) => {
    LocalDb.remove('formulas' as any, id);
    toast.success('Fórmula excluída');
  }, []);

  return { deleteFormula };
}

// Criar nova versão da fórmula
export function useDuplicateFormula() {
  const duplicate = useCallback((id: string, asNewVersion: boolean = false) => {
    const original = LocalDb.getById<Formula>('formulas' as any, id);
    if (!original) {
      toast.error('Fórmula não encontrada');
      return null;
    }
    
    const codigo = asNewVersion ? original.codigo : generateFormulaCode();
    const versao = asNewVersion ? original.versao + 1 : 1;
    
    // Criar novos IDs para ingredientes
    const ingredientes = original.ingredientes.map(ing => ({
      ...ing,
      id: LocalDb.generateUUID(),
    }));
    
    const formula = LocalDb.insert<Formula>('formulas' as any, {
      ...original,
      id: undefined, // Will be generated
      codigo,
      nome: asNewVersion ? original.nome : `${original.nome} (Cópia)`,
      versao,
      versao_anterior_id: asNewVersion ? original.id : undefined,
      ingredientes,
      status: 'RASCUNHO',
    });

    if (asNewVersion && original.status !== 'ARQUIVADO') {
      LocalDb.update<Formula>('formulas' as any, original.id, { status: 'ARQUIVADO' });
    }

    toast.success(asNewVersion ? 'Nova versão criada' : 'Fórmula duplicada');
    return formula;
  }, []);

  return { duplicate };
}
