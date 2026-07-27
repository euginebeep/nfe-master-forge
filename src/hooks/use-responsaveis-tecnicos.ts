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
    mutationFn: async ({ opId, rtId }: { opId: string; rtId: string }) => {
      // (4) uma assinatura por OP
      const { data: jaAssinada } = await supabase
        .from('op_assinaturas_rt')
        .select('id')
        .eq('op_id', opId)
        .maybeSingle();
      if (jaAssinada) throw new Error('Esta OP já possui assinatura do RT.');

      // (1) so assina OP finalizada
      const { data: op, error: opErr } = await supabase
        .from('ordens_producao_industrial')
        .select('codigo, status, produto_nome, lote_produto_acabado, data_fabricacao, data_validade, total_capsulas_com_acrescimo')
        .eq('id', opId)
        .single();
      if (opErr) throw new Error(`Erro ao carregar a OP: ${opErr.message || opErr.code}`);
      if (op.status !== 'FINALIZADA') {
        throw new Error(`A OP precisa estar FINALIZADA para ser assinada (status atual: ${op.status}).`);
      }

      const { data: rt, error: rtError } = await supabase
        .from('responsaveis_tecnicos')
        .select('*')
        .eq('id', rtId)
        .single();
      if (rtError || !rt) throw new Error('RT não encontrado');

      const hoje = new Date().toISOString().split('T')[0];
      if (rt.status !== 'ATIVO' || rt.validade_registro < hoje) {
        throw new Error('RT não está válido para assinatura (inativo ou registro vencido).');
      }
      if (!rt.cpf) {
        throw new Error(`RT ${rt.nome_completo} está sem CPF no cadastro. Complete o cadastro antes de assinar.`);
      }

      // (3) hash sobre o conteudo real da OP no momento da assinatura
      const { data: mps } = await supabase
        .from('op_materias_primas')
        .select('insumo_nome, numero_lote, quantidade_teorica_g, quantidade_real_g')
        .eq('op_id', opId)
        .order('insumo_nome');

      const conteudo = JSON.stringify({
        op: op.codigo,
        produto: op.produto_nome,
        lote: op.lote_produto_acabado,
        fabricacao: op.data_fabricacao,
        validade: op.data_validade,
        quantidade: op.total_capsulas_com_acrescimo,
        materiais: (mps ?? []).map((m) => ({
          i: m.insumo_nome, l: m.numero_lote, t: m.quantidade_teorica_g, r: m.quantidade_real_g,
        })),
      });
      const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(conteudo));
      const hashOP = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, '0')).join('');

      const { data, error } = await supabase
        .from('op_assinaturas_rt')
        .insert({
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
        } as any)
        .select()
        .single();
      if (error) throw new Error(`Erro ao gravar a assinatura: ${error.message || error.code}`);

      // (2) checar o erro dos updates seguintes
      const { error: opUpdErr } = await supabase
        .from('ordens_producao_industrial')
        .update({
          assinatura_rt_id: data.id,
          assinatura_rt_hash: hashOP,
          rt_assinatura_timestamp: new Date().toISOString(),
          rt_nome: rt.nome_completo,
          rt_tipo_conselho: rt.tipo_conselho,
          rt_numero_registro: rt.numero_registro,
          rt_uf_conselho: rt.uf_conselho,
        } as any)
        .eq('id', opId);
      if (opUpdErr) {
        throw new Error(`Assinatura gravada, mas a OP não foi atualizada: ${opUpdErr.message || opUpdErr.code}`);
      }

      const { data: lotesLiberados, error: loteErr } = await supabase
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
        .eq('status', 'QUARENTENA')
        .select('numero_lote');
      if (loteErr) {
        throw new Error(`Assinatura gravada, mas o lote NÃO foi liberado: ${loteErr.message || loteErr.code}`);
      }

      await supabase.rpc('registrar_evento_auditoria', {
        p_tipo_evento: 'RT_ASSINATURA',
        p_descricao: `Assinatura digital do RT ${rt.nome_completo}`,
        p_entidade_tipo: 'OP',
        p_entidade_id: opId,
        p_entidade_codigo: op.codigo,
        p_dados_evento: {
          rt_id: rtId,
          rt_nome: rt.nome_completo,
          rt_conselho: `${rt.tipo_conselho} ${rt.numero_registro}/${rt.uf_conselho}`,
          hash_op: hashOP,
          lotes_liberados: (lotesLiberados ?? []).map((l) => l.numero_lote),
        },
      });

      return { assinatura: data, lotesLiberados: lotesLiberados ?? [] };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['ordens-producao'] });
      queryClient.invalidateQueries({ queryKey: ['lotes-produto-acabado'] });
      const n = r.lotesLiberados.length;
      toast.success(
        n > 0
          ? `Assinatura registrada. Lote(s) liberado(s): ${r.lotesLiberados.map((l: { numero_lote: string }) => l.numero_lote).join(', ')}`
          : 'Assinatura registrada. Nenhum lote em quarentena para liberar.',
      );
    },
    onError: (error: Error) => toast.error(error.message),
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
