// ============================================================
// FORMULADOR INDUSTRIAL - HOOKS DE DADOS
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Formula, 
  FormulaItem, 
  ConversaoUnidade,
  TabelaNutricional,
  AlegacaoANVISA,
  OrdemProducaoGerada,
  FormulaVersao,
  StatusFormula,
  gerarCodigoFormula,
  gerarOPBase,
} from '@/types/formulador-industrial';
import { toast } from 'sonner';

// ============================================================
// HOOK: Conversões de Unidades
// ============================================================
export function useConversoesUnidades() {
  const [conversoes, setConversoes] = useState<ConversaoUnidade[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('conversoes_unidades')
        .select('*')
        .eq('ativo', true)
        .order('substancia');
      
      if (error) throw error;
      setConversoes((data || []) as ConversaoUnidade[]);
    } catch (err) {
      console.error('Erro ao carregar conversões:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const buscarFator = useCallback((substancia: string): number | null => {
    const found = conversoes.find(c => 
      c.substancia.toLowerCase().includes(substancia.toLowerCase()) ||
      substancia.toLowerCase().includes(c.substancia.toLowerCase())
    );
    return found?.fator_ui_para_mg || null;
  }, [conversoes]);

  return { conversoes, loading, refresh, buscarFator };
}

// ============================================================
// HOOK: Lista de Fórmulas
// ============================================================
export function useFormulas(filters?: { status?: StatusFormula }) {
  const [formulas, setFormulas] = useState<Formula[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('formulas')
        .select('*')
        .order('criado_em', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setFormulas((data || []) as Formula[]);
    } catch (err) {
      console.error('Erro ao carregar fórmulas:', err);
    } finally {
      setLoading(false);
    }
  }, [filters?.status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Estatísticas
  const stats = {
    total: formulas.length,
    rascunhos: formulas.filter(f => f.status === 'RASCUNHO').length,
    aprovadas: formulas.filter(f => f.status === 'APROVADA').length,
    bloqueadas: formulas.filter(f => f.status === 'BLOQUEADA').length,
  };

  return { formulas, loading, refresh, stats };
}

// ============================================================
// HOOK: Fórmula Individual
// ============================================================
export function useFormula(id: string | undefined) {
  const [formula, setFormula] = useState<Formula | null>(null);
  const [itens, setItens] = useState<FormulaItem[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!id) {
      setFormula(null);
      setItens([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Buscar fórmula
      const { data: formulaData, error: formulaError } = await supabase
        .from('formulas')
        .select('*')
        .eq('id', id)
        .single();

      if (formulaError) throw formulaError;
      setFormula(formulaData as Formula);

      // Buscar itens
      const { data: itensData, error: itensError } = await supabase
        .from('formula_itens')
        .select('*')
        .eq('formula_id', id)
        .order('ordem_mistura');

      if (itensError) throw itensError;
      setItens((itensData || []) as FormulaItem[]);
    } catch (err) {
      console.error('Erro ao carregar fórmula:', err);
      setFormula(null);
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { formula, itens, loading, refresh };
}

// ============================================================
// HOOK: CRUD de Fórmulas
// ============================================================
export function useFormulaCRUD() {
  // Criar fórmula
  const criar = useCallback(async (data: Omit<Formula, 'id' | 'codigo_formula' | 'versao' | 'criado_em' | 'updated_at'>) => {
    try {
      // Gerar código único
      const { count } = await supabase
        .from('formulas')
        .select('*', { count: 'exact', head: true });
      
      const codigo = gerarCodigoFormula((count || 0) + 1);
      
      const { data: formula, error } = await supabase
        .from('formulas')
        .insert({
          ...data,
          codigo_formula: codigo,
          versao: 1,
          status: 'RASCUNHO',
        })
        .select()
        .single();

      if (error) throw error;
      toast.success(`Fórmula ${codigo} criada`);
      return formula as Formula;
    } catch (err: any) {
      toast.error('Erro ao criar fórmula: ' + err.message);
      return null;
    }
  }, []);

  // Atualizar fórmula
  const atualizar = useCallback(async (id: string, data: Partial<Formula>) => {
    try {
      const { data: formula, error } = await supabase
        .from('formulas')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.success('Fórmula atualizada');
      return formula as Formula;
    } catch (err: any) {
      toast.error('Erro ao atualizar: ' + err.message);
      return null;
    }
  }, []);

  // Excluir fórmula
  const excluir = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('formulas')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Fórmula excluída');
      return true;
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
      return false;
    }
  }, []);

  return { criar, atualizar, excluir };
}

// ============================================================
// HOOK: CRUD de Itens da Fórmula
// ============================================================
export function useFormulaItensCRUD() {
  const adicionar = useCallback(async (item: Omit<FormulaItem, 'id' | 'created_at'>) => {
    try {
      const { data, error } = await supabase
        .from('formula_itens')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data as FormulaItem;
    } catch (err: any) {
      toast.error('Erro ao adicionar item: ' + err.message);
      return null;
    }
  }, []);

  const atualizar = useCallback(async (id: string, data: Partial<FormulaItem>) => {
    try {
      const { data: item, error } = await supabase
        .from('formula_itens')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return item as FormulaItem;
    } catch (err: any) {
      toast.error('Erro ao atualizar item: ' + err.message);
      return null;
    }
  }, []);

  const remover = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('formula_itens')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return true;
    } catch (err: any) {
      toast.error('Erro ao remover item: ' + err.message);
      return false;
    }
  }, []);

  return { adicionar, atualizar, remover };
}

// ============================================================
// HOOK: Aprovar Fórmula e Gerar OP
// ============================================================
export function useAprovarFormula() {
  const aprovar = useCallback(async (formula: Formula, itens: FormulaItem[]) => {
    try {
      // Verificar se pode aprovar
      if (formula.status === 'APROVADA') {
        toast.error('Fórmula já está aprovada');
        return null;
      }

      // Gerar snapshot para histórico
      const snapshot = {
        formula,
        itens,
        aprovado_em: new Date().toISOString(),
      };

      // Salvar versão no histórico
      const { error: versaoError } = await supabase
        .from('formula_versoes')
        .insert({
          formula_id: formula.id,
          versao: formula.versao,
          snapshot_json: snapshot as any,
          motivo_alteracao: 'Aprovação da fórmula',
        });

      if (versaoError) throw versaoError;

      // Atualizar status
      const { data: formulaAtualizada, error: updateError } = await supabase
        .from('formulas')
        .update({
          status: 'APROVADA' as any,
          aprovado_em: new Date().toISOString(),
        })
        .eq('id', formula.id)
        .select()
        .single();

      if (updateError) throw updateError;

      // Gerar OP base
      const { count } = await supabase
        .from('ordens_producao_geradas')
        .select('*', { count: 'exact', head: true });

      const opBase = gerarOPBase(formula, itens, (count || 0) + 1);

      // Salvar OP gerada
      const { error: opError } = await supabase
        .from('ordens_producao_geradas')
        .insert({
          formula_id: formula.id,
          op_codigo: opBase.codigo,
          tipo_documento: formula.tipo_apresentacao === 'CAPSULA' ? 'OP' : 'FICHA_PRODUCAO',
          dados_op: opBase as any,
        });

      if (opError) throw opError;

      toast.success(`Fórmula aprovada! OP ${opBase.codigo} gerada`);
      return { formula: formulaAtualizada as Formula, op: opBase };
    } catch (err: any) {
      toast.error('Erro ao aprovar: ' + err.message);
      return null;
    }
  }, []);

  const bloquear = useCallback(async (id: string, motivo: string) => {
    try {
      const { data, error } = await supabase
        .from('formulas')
        .update({
          status: 'BLOQUEADA',
          observacoes_tecnicas: motivo,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      toast.warning('Fórmula bloqueada');
      return data as Formula;
    } catch (err: any) {
      toast.error('Erro ao bloquear: ' + err.message);
      return null;
    }
  }, []);

  return { aprovar, bloquear };
}

// ============================================================
// HOOK: Histórico de Versões
// ============================================================
export function useFormulaHistorico(formulaId: string | undefined) {
  const [versoes, setVersoes] = useState<FormulaVersao[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!formulaId) {
      setVersoes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('formula_versoes')
        .select('*')
        .eq('formula_id', formulaId)
        .order('versao', { ascending: false });

      if (error) throw error;
      setVersoes((data || []) as FormulaVersao[]);
    } catch (err) {
      console.error('Erro ao carregar histórico:', err);
    } finally {
      setLoading(false);
    }
  }, [formulaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { versoes, loading, refresh };
}

// ============================================================
// HOOK: Tabela Nutricional
// ============================================================
export function useTabelaNutricional(formulaId: string | undefined) {
  const [tabela, setTabela] = useState<TabelaNutricional | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!formulaId) {
      setTabela(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tabelas_nutricionais')
        .select('*')
        .eq('formula_id', formulaId)
        .order('data_geracao', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setTabela({
          ...data,
          tabela_json_padrao_anvisa: (data.tabela_json_padrao_anvisa || []) as any,
        } as TabelaNutricional);
      } else {
        setTabela(null);
      }
    } catch (err) {
      console.error('Erro ao carregar tabela nutricional:', err);
    } finally {
      setLoading(false);
    }
  }, [formulaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const gerar = useCallback(async (formulaId: string, porcao: number, unidade: string, nutrientes: any[]) => {
    try {
      const { data, error } = await supabase
        .from('tabelas_nutricionais')
        .insert({
          formula_id: formulaId,
          porcao,
          porcao_unidade: unidade,
          tabela_json_padrao_anvisa: nutrientes as any,
        })
        .select()
        .single();

      if (error) throw error;
      setTabela({
        ...data,
        tabela_json_padrao_anvisa: (data.tabela_json_padrao_anvisa || []) as any,
      } as TabelaNutricional);
      toast.success('Tabela nutricional gerada');
      return data;
    } catch (err: any) {
      toast.error('Erro ao gerar tabela: ' + err.message);
      return null;
    }
  }, []);

  return { tabela, loading, refresh, gerar };
}

// ============================================================
// HOOK: OPs Geradas
// ============================================================
export function useOPsGeradas(formulaId?: string) {
  const [ops, setOps] = useState<OrdemProducaoGerada[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ordens_producao_geradas')
        .select('*')
        .order('data_geracao', { ascending: false });

      if (formulaId) {
        query = query.eq('formula_id', formulaId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setOps((data || []) as OrdemProducaoGerada[]);
    } catch (err) {
      console.error('Erro ao carregar OPs:', err);
    } finally {
      setLoading(false);
    }
  }, [formulaId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ops, loading, refresh };
}
