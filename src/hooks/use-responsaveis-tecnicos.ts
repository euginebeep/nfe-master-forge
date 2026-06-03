import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { 
  ResponsavelTecnico, 
  TipoConselho, 
  AssinaturaRT,
  LoteProdutoAcabado 
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
      toast.success('Responsável técnico cadastrado com sucesso');
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
// HOOK: Lotes de Produto Acabado com QR Code
// ============================================================
export function useLotesProdutoAcabado(opId?: string) {
  return useQuery({
    queryKey: ['lotes-produto-acabado', opId],
    queryFn: async () => {
      let query = supabase
        .from('lotes_produto_acabado')
        .select('*')
        .order('created_at', { ascending: false });

      if (opId) {
        query = query.eq('op_id', opId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as LoteProdutoAcabado[];
    },
    enabled: opId ? true : true,
  });
}

// ============================================================
// HOOK: Criar Lote com QR Code
// ============================================================
export function useCriarLoteProdutoAcabado() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      opId,
      numeroLote,
      produtoId,
      produtoNome,
      produtoCodigo,
      dataFabricacao,
      dataValidade,
      quantidadeProduzida,
      rtId,
    }: {
      opId: string;
      numeroLote: string;
      produtoId?: string;
      produtoNome: string;
      produtoCodigo?: string;
      dataFabricacao: string;
      dataValidade: string;
      quantidadeProduzida: number;
      rtId: string;
    }) => {
      // Buscar RT
      const { data: rt, error: rtError } = await supabase
        .from('responsaveis_tecnicos')
        .select('*')
        .eq('id', rtId)
        .single();

      if (rtError || !rt) throw new Error('RT não encontrado');

      // Gerar códigos únicos
      const codigoAuditoria = `${crypto.randomUUID()}-${Date.now()}`;
      const hashData = JSON.stringify({
        opId,
        numeroLote,
        produtoNome,
        dataFabricacao,
        dataValidade,
        rtId,
        timestamp: Date.now(),
      });
      
      const encoder = new TextEncoder();
      const data = encoder.encode(hashData);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const qrCodeHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const lote = {
        op_id: opId,
        numero_lote: numeroLote,
        codigo_auditoria: codigoAuditoria,
        qr_code_hash: qrCodeHash,
        produto_id: produtoId,
        produto_nome: produtoNome,
        produto_codigo: produtoCodigo,
        data_fabricacao: dataFabricacao,
        data_validade: dataValidade,
        quantidade_produzida: quantidadeProduzida,
        responsavel_tecnico_id: rtId,
        rt_nome: rt.nome_completo,
        rt_tipo_conselho: rt.tipo_conselho,
        rt_numero_registro: rt.numero_registro,
        rt_uf_conselho: rt.uf_conselho,
      };

      const { data: novoLote, error } = await supabase
        .from('lotes_produto_acabado')
        .insert(lote as any)
        .select()
        .single();

      if (error) throw error;

      // Registrar auditoria
      await supabase.rpc('registrar_evento_auditoria', {
        p_tipo_evento: 'OP_FINALIZADA',
        p_descricao: `Lote ${numeroLote} criado`,
        p_entidade_tipo: 'LOTE',
        p_entidade_id: novoLote.id,
        p_entidade_codigo: numeroLote,
        p_dados_evento: {
          produto: produtoNome,
          quantidade: quantidadeProduzida,
          rt: `${rt.nome_completo} - ${rt.tipo_conselho} ${rt.numero_registro}/${rt.uf_conselho}`,
          qr_code_hash: qrCodeHash,
        },
      });

      return novoLote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lotes-produto-acabado'] });
      toast.success('Lote de produto acabado criado com QR Code');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar lote: ' + error.message);
    },
  });
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
