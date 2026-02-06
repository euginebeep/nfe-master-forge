import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  RegraANVISA, 
  LogValidacaoANVISA, 
  ResultadoValidacaoCompleta,
  ItemParaValidar,
  validarFormula,
  TipoEntidadeValidacao,
  ResultadoValidacao,
} from '@/types/validador-anvisa';
import { toast } from 'sonner';

// ============================================================
// HOOK: REGRAS ANVISA
// ============================================================

export function useRegrasANVISA() {
  const [regras, setRegras] = useState<RegraANVISA[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRegras = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('regras_anvisa')
      .select('*')
      .eq('ativo', true)
      .order('substancia', { ascending: true });

    if (error) {
      console.error('Erro ao buscar regras ANVISA:', error);
    }

    setRegras((data || []) as RegraANVISA[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRegras();
  }, [fetchRegras]);

  return { regras, loading, refresh: fetchRegras };
}

// ============================================================
// HOOK: LOG DE VALIDAÇÕES
// ============================================================

export function useLogValidacoesANVISA(entidadeId?: string, tipoEntidade?: TipoEntidadeValidacao) {
  const [logs, setLogs] = useState<LogValidacaoANVISA[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('log_validacoes_anvisa')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (entidadeId) {
      query = query.eq('entidade_id', entidadeId);
    }
    if (tipoEntidade) {
      query = query.eq('tipo_entidade', tipoEntidade);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar logs de validação:', error);
    }

    setLogs((data || []) as LogValidacaoANVISA[]);
    setLoading(false);
  }, [entidadeId, tipoEntidade]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return { logs, loading, refresh: fetchLogs };
}

// ============================================================
// HOOK: VALIDADOR AUTOMÁTICO
// ============================================================

export function useValidadorANVISA() {
  const { regras, loading: loadingRegras } = useRegrasANVISA();

  // Validar fórmula completa
  const validarFormulaCompleta = useCallback((
    itens: ItemParaValidar[],
    tipoApresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO'
  ): ResultadoValidacaoCompleta => {
    return validarFormula(itens, tipoApresentacao, regras);
  }, [regras]);

  // Registrar log de validação
  const registrarValidacao = async (
    tipoEntidade: TipoEntidadeValidacao,
    entidadeId: string,
    entidadeCodigo: string,
    resultado: ResultadoValidacaoCompleta,
    userId?: string
  ): Promise<void> => {
    const logsParaInserir = resultado.validacoes.map(v => ({
      tipo_entidade: tipoEntidade,
      entidade_id: entidadeId,
      entidade_codigo: entidadeCodigo,
      resultado: v.resultado as ResultadoValidacao,
      regra_aplicada: v.regra,
      descricao: v.descricao,
      fonte_legal: v.fonte_legal,
      dados_validacao: {
        valor_informado: v.valor_informado,
        valor_limite: v.valor_limite,
        unidade: v.unidade,
      },
      acao_sistema: v.resultado === 'BLOQUEIO' ? 'APROVACAO_BLOQUEADA' : undefined,
      usuario_responsavel: userId,
    }));

    const { error } = await supabase
      .from('log_validacoes_anvisa')
      .insert(logsParaInserir);

    if (error) {
      console.error('Erro ao registrar validação:', error);
    }
  };

  // Validar e aprovar fórmula (gate obrigatório)
  const validarEAprovarFormula = async (
    formulaId: string,
    formulaCodigo: string,
    itens: ItemParaValidar[],
    tipoApresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO',
    userId?: string
  ): Promise<{ aprovado: boolean; resultado: ResultadoValidacaoCompleta }> => {
    const resultado = validarFormulaCompleta(itens, tipoApresentacao);

    // Registrar todas as validações
    await registrarValidacao('FORMULA', formulaId, formulaCodigo, resultado, userId);

    if (!resultado.aprovado) {
      toast.error(`Fórmula bloqueada: ${resultado.bloqueios.length} irregularidade(s) ANVISA`);
    } else if (resultado.alertas.length > 0) {
      toast.warning(`Fórmula aprovada com ${resultado.alertas.length} alerta(s)`);
    } else {
      toast.success('Fórmula validada e aprovada pela ANVISA');
    }

    return { aprovado: resultado.aprovado, resultado };
  };

  // Validar OP antes de iniciar
  const validarOP = async (
    opId: string,
    opCodigo: string,
    itens: ItemParaValidar[],
    tipoApresentacao: 'CAPSULA' | 'LIQUIDO' | 'PO',
    userId?: string
  ): Promise<{ aprovado: boolean; resultado: ResultadoValidacaoCompleta }> => {
    const resultado = validarFormulaCompleta(itens, tipoApresentacao);

    // Registrar validação da OP
    await registrarValidacao('OP', opId, opCodigo, resultado, userId);

    return { aprovado: resultado.aprovado, resultado };
  };

  return {
    regras,
    loadingRegras,
    validarFormulaCompleta,
    validarEAprovarFormula,
    validarOP,
    registrarValidacao,
  };
}

// ============================================================
// HOOK: GESTÃO DE REGRAS ANVISA
// ============================================================

export function useGestaoRegrasANVISA() {
  const { regras, refresh } = useRegrasANVISA();

  const adicionarRegra = async (regra: Omit<RegraANVISA, 'id' | 'created_at' | 'updated_at'>): Promise<RegraANVISA | null> => {
    const { data, error } = await supabase
      .from('regras_anvisa')
      .insert(regra)
      .select()
      .single();

    if (error) {
      toast.error('Erro ao adicionar regra ANVISA');
      return null;
    }

    toast.success('Regra ANVISA adicionada');
    refresh();
    return data as RegraANVISA;
  };

  const atualizarRegra = async (id: string, updates: Partial<RegraANVISA>): Promise<boolean> => {
    const { error } = await supabase
      .from('regras_anvisa')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      toast.error('Erro ao atualizar regra ANVISA');
      return false;
    }

    toast.success('Regra ANVISA atualizada');
    refresh();
    return true;
  };

  const desativarRegra = async (id: string): Promise<boolean> => {
    return atualizarRegra(id, { ativo: false });
  };

  return {
    regras,
    adicionarRegra,
    atualizarRegra,
    desativarRegra,
    refresh,
  };
}
