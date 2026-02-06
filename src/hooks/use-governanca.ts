import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  TrilhaAuditoriaTecnica, 
  VersaoParametroIndustrial,
  gerarHashIntegridade 
} from '@/types/inteligencia-industrial';

// ============================================================
// HOOK: TRILHA DE AUDITORIA TÉCNICA
// ============================================================

export function useTrilhaAuditoria(entidadeTipo?: string, entidadeId?: string) {
  const [registros, setRegistros] = useState<TrilhaAuditoriaTecnica[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRegistros = useCallback(async () => {
    setLoading(true);
    
    let query = supabase
      .from('trilha_auditoria_tecnica')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (entidadeTipo) {
      query = query.eq('entidade_tipo', entidadeTipo);
    }
    if (entidadeId) {
      query = query.eq('entidade_id', entidadeId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar trilha:', error);
    } else {
      setRegistros((data || []).map(r => ({
        ...r,
        dados_anteriores: r.dados_anteriores as Record<string, unknown> | null,
        dados_novos: r.dados_novos as Record<string, unknown> | null,
      })) as TrilhaAuditoriaTecnica[]);
    }
    
    setLoading(false);
  }, [entidadeTipo, entidadeId]);

  useEffect(() => {
    fetchRegistros();
  }, [fetchRegistros]);

  return { registros, loading, refresh: fetchRegistros };
}

// ============================================================
// HOOK: REGISTRO DE AUDITORIA
// ============================================================

export function useRegistroAuditoria() {
  // Registrar ação na trilha
  const registrarAcao = async (
    entidadeTipo: string,
    entidadeId: string,
    entidadeCodigo: string | null,
    acao: string,
    dadosAnteriores?: Record<string, unknown>,
    dadosNovos?: Record<string, unknown>,
    motivo?: string
  ) => {
    // Gerar diff resumido
    let diffResumo: string | null = null;
    if (dadosAnteriores && dadosNovos) {
      const campos: string[] = [];
      const todasChaves = new Set([
        ...Object.keys(dadosAnteriores),
        ...Object.keys(dadosNovos),
      ]);

      todasChaves.forEach(chave => {
        if (JSON.stringify(dadosAnteriores[chave]) !== JSON.stringify(dadosNovos[chave])) {
          campos.push(chave);
        }
      });

      if (campos.length > 0) {
        diffResumo = `Campos alterados: ${campos.join(', ')}`;
      }
    }

    // Gerar hash de integridade
    const hashDados = gerarHashIntegridade({
      entidadeTipo,
      entidadeId,
      acao,
      dadosNovos,
      timestamp: new Date().toISOString(),
    });

    const insertData = {
      entidade_tipo: entidadeTipo,
      entidade_id: entidadeId,
      entidade_codigo: entidadeCodigo ?? null,
      acao,
      dados_anteriores: dadosAnteriores ? JSON.parse(JSON.stringify(dadosAnteriores)) : null,
      dados_novos: dadosNovos ? JSON.parse(JSON.stringify(dadosNovos)) : null,
      diff_resumo: diffResumo,
      motivo: motivo ?? null,
      hash_integridade: hashDados,
    };

    const { error } = await supabase
      .from('trilha_auditoria_tecnica')
      .insert(insertData as any);

    if (error) {
      console.error('Erro ao registrar auditoria:', error);
      return false;
    }

    return true;
  };

  // Registrar criação
  const registrarCriacao = async (
    entidadeTipo: string,
    entidadeId: string,
    entidadeCodigo: string,
    dados: Record<string, unknown>
  ) => {
    return registrarAcao(
      entidadeTipo,
      entidadeId,
      entidadeCodigo,
      'CRIACAO',
      undefined,
      dados
    );
  };

  // Registrar edição
  const registrarEdicao = async (
    entidadeTipo: string,
    entidadeId: string,
    entidadeCodigo: string,
    dadosAnteriores: Record<string, unknown>,
    dadosNovos: Record<string, unknown>,
    motivo?: string
  ) => {
    return registrarAcao(
      entidadeTipo,
      entidadeId,
      entidadeCodigo,
      'EDICAO',
      dadosAnteriores,
      dadosNovos,
      motivo
    );
  };

  // Registrar aprovação
  const registrarAprovacao = async (
    entidadeTipo: string,
    entidadeId: string,
    entidadeCodigo: string,
    dados: Record<string, unknown>
  ) => {
    return registrarAcao(
      entidadeTipo,
      entidadeId,
      entidadeCodigo,
      'APROVACAO',
      undefined,
      dados
    );
  };

  // Registrar fechamento (imutabilidade)
  const registrarFechamento = async (
    entidadeTipo: string,
    entidadeId: string,
    entidadeCodigo: string,
    dadosFinais: Record<string, unknown>
  ) => {
    return registrarAcao(
      entidadeTipo,
      entidadeId,
      entidadeCodigo,
      'FECHAMENTO',
      undefined,
      dadosFinais,
      'Registro fechado e imutável'
    );
  };

  // Registrar bloqueio
  const registrarBloqueio = async (
    entidadeTipo: string,
    entidadeId: string,
    entidadeCodigo: string,
    motivo: string
  ) => {
    return registrarAcao(
      entidadeTipo,
      entidadeId,
      entidadeCodigo,
      'BLOQUEIO',
      undefined,
      { motivo },
      motivo
    );
  };

  return {
    registrarAcao,
    registrarCriacao,
    registrarEdicao,
    registrarAprovacao,
    registrarFechamento,
    registrarBloqueio,
  };
}

// ============================================================
// HOOK: VERSIONAMENTO DE PARÂMETROS
// ============================================================

export function useVersaoParametros() {
  const [versoes, setVersoes] = useState<VersaoParametroIndustrial[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVersoes = useCallback(async (tipoParametro?: string) => {
    setLoading(true);
    
    let query = supabase
      .from('versoes_parametros_industriais')
      .select('*')
      .order('alterado_em', { ascending: false });

    if (tipoParametro) {
      query = query.eq('tipo_parametro', tipoParametro);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar versões:', error);
    } else {
      setVersoes((data || []).map(v => ({
        ...v,
        dados: v.dados as Record<string, unknown>,
      })) as VersaoParametroIndustrial[]);
    }
    
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchVersoes();
  }, [fetchVersoes]);

  // Criar nova versão
  const criarVersao = async (
    tipoParametro: string,
    dados: Record<string, unknown>,
    motivoAlteracao?: string
  ) => {
    // Buscar versão atual
    const { data: versaoAtual } = await supabase
      .from('versoes_parametros_industriais')
      .select('versao')
      .eq('tipo_parametro', tipoParametro)
      .eq('ativo', true)
      .single();

    const novaVersao = (versaoAtual?.versao || 0) + 1;

    // Desativar versão anterior
    await supabase
      .from('versoes_parametros_industriais')
      .update({ ativo: false })
      .eq('tipo_parametro', tipoParametro)
      .eq('ativo', true);

    // Inserir nova versão
    const insertData = {
      tipo_parametro: tipoParametro,
      versao: novaVersao,
      dados: JSON.parse(JSON.stringify(dados)),
      motivo_alteracao: motivoAlteracao ?? null,
      ativo: true,
    };

    const { error } = await supabase
      .from('versoes_parametros_industriais')
      .insert(insertData as any);

    if (error) {
      console.error('Erro ao criar versão:', error);
      return null;
    }

    // Registrar na trilha
    const trilhaData = {
      entidade_tipo: 'PARAMETRO',
      entidade_id: tipoParametro,
      entidade_codigo: `v${novaVersao}`,
      acao: 'NOVA_VERSAO',
      dados_novos: JSON.parse(JSON.stringify(dados)),
      motivo: motivoAlteracao ?? null,
    };
    
    await supabase.from('trilha_auditoria_tecnica').insert(trilhaData as any);

    fetchVersoes();
    return novaVersao;
  };

  // Obter versão ativa
  const getVersaoAtiva = async (tipoParametro: string) => {
    const { data } = await supabase
      .from('versoes_parametros_industriais')
      .select('*')
      .eq('tipo_parametro', tipoParametro)
      .eq('ativo', true)
      .single();

    return data ? {
      ...data,
      dados: data.dados as Record<string, unknown>,
    } as VersaoParametroIndustrial : null;
  };

  return {
    versoes,
    loading,
    criarVersao,
    getVersaoAtiva,
    refresh: fetchVersoes,
  };
}
