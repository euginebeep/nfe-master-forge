import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ===================== QC DESVIOS =====================

export interface QCDesvio {
  id: string;
  codigo: string;
  tipo: string;
  severidade: string;
  descricao: string;
  causa_raiz?: string;
  acao_corretiva?: string;
  acao_preventiva?: string;
  responsavel_id?: string;
  status: string;
  prazo?: string;
  lote_id?: string;
  op_id?: string;
  created_at: string;
}

export function useQCDesvios() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['qc-desvios'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qc_desvios')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as QCDesvio[];
    },
  });

  const criar = useMutation({
    mutationFn: async (desvio: Omit<QCDesvio, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('qc_desvios')
        .insert(desvio)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-desvios'] });
      toast.success('Desvio registrado');
    },
    onError: () => toast.error('Erro ao registrar desvio'),
  });

  const atualizar = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<QCDesvio> & { id: string }) => {
      const { error } = await supabase
        .from('qc_desvios')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-desvios'] });
      toast.success('Desvio atualizado');
    },
    onError: () => toast.error('Erro ao atualizar desvio'),
  });

  return { ...query, criar, atualizar };
}

// ===================== QC ANÁLISES =====================

export interface QCAnalise {
  id: string;
  lote_id: string;
  tipo_analise: string;
  parametro: string;
  especificacao: string;
  resultado?: string;
  status: string;
  analista_id?: string;
  data_analise?: string;
  observacoes?: string;
  created_at: string;
}

export function useQCAnalises() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['qc-analises'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qc_analises')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as QCAnalise[];
    },
  });

  const criar = useMutation({
    mutationFn: async (analise: Omit<QCAnalise, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('qc_analises')
        .insert(analise)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-analises'] });
      toast.success('Análise registrada');
    },
    onError: () => toast.error('Erro ao registrar análise'),
  });

  return { ...query, criar };
}

// ===================== QC CALIBRAÇÕES =====================

export interface QCCalibracao {
  id: string;
  equipamento: string;
  codigo_equipamento: string;
  tipo_calibracao: string;
  data_calibracao: string;
  proxima_calibracao: string;
  certificado_url?: string;
  status: string;
  responsavel?: string;
  created_at: string;
}

export function useQCCalibracoes() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['qc-calibracoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qc_calibracoes')
        .select('*')
        .order('proxima_calibracao', { ascending: true });
      if (error) throw error;
      return data as QCCalibracao[];
    },
  });

  const criar = useMutation({
    mutationFn: async (cal: Omit<QCCalibracao, 'id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('qc_calibracoes')
        .insert(cal)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-calibracoes'] });
      toast.success('Calibração registrada');
    },
    onError: () => toast.error('Erro ao registrar calibração'),
  });

  return { ...query, criar };
}
