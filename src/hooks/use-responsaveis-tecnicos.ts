import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  ResponsavelTecnico, 
  TipoConselho, 
  AssinaturaRT,
} from '@/types/responsavel-tecnico';

// ============================================================
// HOOK: Lista de Responsáveis Técnicos
// ============================================================
export function useResponsaveisTecnicos() {
  return useQuery({
    queryKey: ['responsaveis-tecnicos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('responsaveis_tecnicos')
        .select('*')
        .order('nome_completo');

      if (error) throw error;
      return data as ResponsavelTecnico[];
    },
  });
}

// ============================================================
// HOOK: Responsáveis Técnicos Válidos (para seleção em OP)
// ============================================================
export function useResponsaveisTecnicosValidos() {
  return useQuery({
    queryKey: ['responsaveis-tecnicos-validos'],
    queryFn: async () => {
      const hoje = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('responsaveis_tecnicos')
        .select('*')
        .eq('status', 'ATIVO')
        .gte('validade_registro', hoje)
        .order('nome_completo');

      if (error) throw error;
      return data as ResponsavelTecnico[];
    },
  });
}

// ============================================================
// HOOK: CRUD de Responsável Técnico
// ============================================================
export function useResponsavelTecnicoCRUD() {
  const queryClient = useQueryClient();

  const createRT = useMutation({
    mutationFn: async (dados: Omit<ResponsavelTecnico, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('responsaveis_tecnicos')
        .insert(dados as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsaveis-tecnicos'] });
      // Mensagem personalizada conforme solicitado
      toast.success('Responsável técnico cadastrado com sucesso!', {
        description: 'O profissional já está habilitado no sistema.',
        duration: 4000
      });
    },
    onError: (error: Error) => {
      toast.error('Erro ao cadastrar RT: ' + error.message);
    },
  });

  const updateRT = useMutation({
    mutationFn: async ({ id, ...dados }: Partial<ResponsavelTecnico> & { id: string }) => {
      const { data, error } = await supabase
        .from('responsaveis_tecnicos')
        .update(dados as any)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsaveis-tecnicos'] });
      toast.success('Responsável técnico atualizado');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar RT: ' + error.message);
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: 'ATIVO' | 'INATIVO' }) => {
      const { error } = await supabase
        .from('responsaveis_tecnicos')
        .update({ status } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['responsaveis-tecnicos'] });
      toast.success('Status atualizado');
    },
  });

  return { createRT, updateRT, toggleStatus };
}

// ============================================================
// HOOK: Assinatura Digital de RT
// ============================================================
export function useAssinaturaRT() {
  const queryClient = useQueryClient();

  const assinarOP = useMutation({
    mutationFn: async ({
      opId,
      rtId,
      hashOP,
    }: {
      opId: string;
      rtId: string;
      hashOP: string;
    }) => {
      // Buscar dados do RT
      const { data: rt, error: rtError } = await supabase
        .from('responsaveis_tecnicos')
        .select('*')
        .eq('id', rtId)
        .single();

      if (rtError || !rt) throw new Error('RT não encontrado');

      // Verificar validade
      const hoje = new Date().toISOString().split('T')[0];
      if (rt.status !== 'ATIVO' || rt.validade_registro < hoje) {
        throw new Error('RT não está válido para assinatura');
      }

      // Criar assinatura
      const assinatura = {
        op_id: opId,
        responsavel_tecnico_id: rtId,
        rt_nome: rt.nome_completo,
        rt_cpf: rt.cpf,
        rt_tipo_conselho: rt.tipo_conselho,
        rt_numero_registro: rt.numero_registro,
        rt_uf_conselho: rt.uf_conselho,
        hash_op: hashOP,
        declaracao_aceita: true,
        ip_address: await obterIP(),
        user_agent: navigator.userAgent,
      };

      const { data, error } = await supabase
        .from('op_assinaturas_rt')
        .insert(assinatura as any)
        .select()
        .single();

      if (error) throw error;

      // Atualizar OP com assinatura
      await supabase
        .from('ordens_producao_industrial')
        .update({
          assinatura_rt_id: data.id,
          rt_nome: rt.nome_completo,
          rt_tipo_conselho: rt.tipo_conselho,
          rt_numero_registro: rt.numero_registro,
          rt_uf_conselho: rt.uf_conselho,
        } as any)
        .eq('id', opId);

      // Liberar lote(s) de Produto Acabado em QUARENTENA vinculados à OP
      await supabase
        .from('lotes_produto_acabado')
        .update({
          status: 'LIBERADO',
          liberado_em: new Date().toISOString(),
          assinatura_liberacao_id: data.id,
          responsavel_tecnico_id: rtId,
          rt_nome: rt.nome_completo,
          rt_tipo_conselho: rt.tipo_conselho,
          rt_numero_registro: rt.numero_registro,
          rt_uf_conselho: rt.uf_conselho,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('op_id', opId)
        .eq('status', 'QUARENTENA');

      // Registrar na trilha de auditoria
      await supabase.rpc('registrar_evento_auditoria', {
        p_tipo_evento: 'RT_ASSINATURA',
        p_descricao: `Assinatura digital do RT ${rt.nome_completo}`,
        p_entidade_tipo: 'OP',
        p_entidade_id: opId,
        p_dados_evento: {
          rt_id: rtId,
          rt_nome: rt.nome_completo,
          rt_conselho: `${rt.tipo_conselho} ${rt.numero_registro}/${rt.uf_conselho}`,
          hash_op: hashOP,
        },
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ordens-producao'] });
      toast.success('Declaração de responsabilidade técnica registrada');
    },
    onError: (error: Error) => {
      toast.error('Erro na assinatura: ' + error.message);
    },
  });

  return { assinarOP };
}

// ============================================================
// HOOK: Trilha de Auditoria
// ============================================================
export function useAuditTrail(entidadeTipo?: string, entidadeId?: string) {
  return useQuery({
    queryKey: ['audit-trail', entidadeTipo, entidadeId],
    queryFn: async () => {
      let query = supabase
        .from('audit_trail_imutavel')
        .select('*')
        .order('sequencia', { ascending: false })
        .limit(100);

      if (entidadeTipo) {
        query = query.eq('entidade_tipo', entidadeTipo);
      }
      if (entidadeId) {
        query = query.eq('entidade_id', entidadeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// Utilidade para obter IP
async function obterIP(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return data.ip;
  } catch {
    return 'IP não disponível';
  }
}
