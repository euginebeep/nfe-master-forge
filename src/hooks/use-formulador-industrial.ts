// ============================================================
// FORMULADOR INDUSTRIAL - HOOKS DE DADOS
// VERSÃO DEFINITIVA
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  Formula, 
  FormulaItem, 
  ConversaoUnidade,
  TabelaNutricional,
  OrdemProducaoGerada,
  FormulaVersao,
  StatusFormula,
  gerarOPBase,
} from '@/types/formulador-industrial';
import { toast } from 'sonner';

// Tipo para inserção (compatível com Supabase)
type FormulaItemInsert = {
  formula_id: string;
  nome_insumo: string;
  produto_materia_prima_id?: string | null;
  quantidade_informada: number;
  unidade_informada: 'MG' | 'MCG' | 'UI';
  quantidade_convertida_mg: number;
  ativo_critico?: boolean;
  exige_premix?: boolean;
  ordem_mistura?: number;
  percentual_na_capsula?: number;
  classificacao_risco?: string;
  metodo_distribuicao?: string | null;
  alerta_exibido?: boolean;
};

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
    const normalizarTexto = (texto: string): string => {
      return texto
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '')
        .trim();
    };

    const extrairIdVitamina = (nome: string): string | null => {
      const s = normalizarTexto(nome);

      // Captura padrões como d3, k1, b12 etc (com ou sem prefixo vit/vitamina)
      const m = s.match(/(?:vitamina|vit)?([a-z]\d+)/);
      if (m?.[1]) return m[1];

      // Se não tiver número, tenta "Vitamina A/E/K" etc.
      const afterPrefix = s.replace(/^vitamina/, '').replace(/^vit/, '');
      if (afterPrefix.length > 0) return afterPrefix[0];

      return null;
    };

    const idAlvo = extrairIdVitamina(substancia);
    const alvoNorm = normalizarTexto(substancia);

    const found = conversoes.find((c) => {
      const candNorm = normalizarTexto(c.substancia);

      // Match por inclusão (modo antigo)
      if (candNorm.includes(alvoNorm) || alvoNorm.includes(candNorm)) return true;

      // Match por identificador de vitamina (ex: d3)
      const idCand = extrairIdVitamina(c.substancia);
      if (idAlvo && idCand && idAlvo === idCand) return true;

      return false;
    });

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
      // Código gerado no banco (MAX+1 por empresa/ano + laço anti-colisão)
      const { data: codigo, error: codigoErr } = await supabase.rpc('proximo_codigo_formula');
      if (codigoErr) throw codigoErr;
      if (!codigo || typeof codigo !== 'string') {
        throw new Error('Não foi possível gerar o código da fórmula');
      }

      const { data: { user } } = await supabase.auth.getUser();

      const { data: formula, error } = await supabase
        .from('formulas')
        .insert({
          ...data,
          codigo_formula: codigo,
          versao: 1,
          status: 'RASCUNHO',
          criado_por: user?.id ?? null,
        })
        .select()
        .single();

      if (error) throw error;
      toast.success(`Fórmula ${codigo} criada`);
      return formula as Formula;
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao criar fórmula: ' + msg);
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
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao atualizar: ' + msg);
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
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao excluir: ' + msg);
      return false;
    }
  }, []);

  return { criar, atualizar, excluir };
}

// ============================================================
// HOOK: CRUD de Itens da Fórmula
// ============================================================
export function useFormulaItensCRUD() {
  const adicionar = useCallback(async (item: FormulaItemInsert) => {
    try {
      const { data, error } = await supabase
        .from('formula_itens')
        .insert(item)
        .select()
        .single();

      if (error) throw error;
      return data as FormulaItem;
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao adicionar item: ' + msg);
      return null;
    }
  }, []);

  const atualizar = useCallback(async (id: string, updates: Partial<FormulaItemInsert>) => {
    try {
      const { data: item, error } = await supabase
        .from('formula_itens')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return item as FormulaItem;
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao atualizar item: ' + msg);
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
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao remover item: ' + msg);
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

      // Obter usuário logado
      const { data: { user } } = await supabase.auth.getUser();

      // Persistir campos calculados que já chegam no parâmetro (antes só iam ao snapshot).
      // Gravar apenas quando definidos — não sobrescrever coluna existente com undefined.
      const camposCalculados: Record<string, number> = {};
      if (formula.n_capsulas_por_dose != null) {
        camposCalculados.n_capsulas_por_dose = formula.n_capsulas_por_dose;
      }
      if (formula.peso_por_capsula_mg != null) {
        camposCalculados.peso_por_capsula_mg = formula.peso_por_capsula_mg;
      }
      if (formula.massa_ativos_dose_mg != null) {
        camposCalculados.massa_ativos_dose_mg = formula.massa_ativos_dose_mg;
      }
      if (formula.densidade_aparente_kg_l != null) {
        camposCalculados.densidade_aparente_kg_l = formula.densidade_aparente_kg_l;
      }
      
      // Atualizar status + campos calculados
      const { data: formulaAtualizada, error: updateError } = await supabase
        .from('formulas')
        .update({
          status: 'APROVADA' as any,
          aprovado_em: new Date().toISOString(),
          aprovado_por: user?.id ?? null,
          ...camposCalculados,
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
      const { error: opError } = await (supabase as unknown as { from: (t: string) => { insert: (d: Record<string, unknown>) => Promise<{ error: Error | null }> } })
        .from('ordens_producao_geradas')
        .insert({
          formula_id: formula.id,
          op_codigo: opBase.codigo,
          tipo_documento: formula.tipo_apresentacao === 'CAPSULA' ? 'OP' : 'FICHA_PRODUCAO',
          dados_op: opBase as unknown,
        });

      if (opError) throw opError;

      toast.success(`Fórmula aprovada! OP ${opBase.codigo} gerada`);
      return { formula: formulaAtualizada as Formula, op: opBase };
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao aprovar: ' + msg);
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
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao bloquear: ' + msg);
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

  const gerar = useCallback(async (formulaId: string, porcao: number, unidade: string, nutrientes: Record<string, unknown>[]) => {
    try {
      const { data, error } = await (supabase as unknown as { from: (t: string) => { insert: (d: Record<string, unknown>) => { select: () => { single: () => Promise<{ data: Record<string, unknown>; error: Error | null }> } } } })
        .from('tabelas_nutricionais')
        .insert({
          formula_id: formulaId,
          porcao,
          porcao_unidade: unidade,
          tabela_json_padrao_anvisa: nutrientes as unknown,
        })
        .select()
        .single();

      if (error) throw error;
      setTabela({
        ...data,
        tabela_json_padrao_anvisa: (data.tabela_json_padrao_anvisa || []) as unknown as TabelaNutricional['tabela_json_padrao_anvisa'],
      } as unknown as TabelaNutricional);
      toast.success('Tabela nutricional gerada');
      return data;
    } catch (err: unknown) {
      const e = err as any;
      const msg = e?.message || e?.details || e?.code || 'Erro desconhecido';
      toast.error('Erro ao gerar tabela: ' + msg);
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
