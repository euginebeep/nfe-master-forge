import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DesvioCompleto {
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
  fase_atual: string;
  created_at: string;
  updated_at?: string;
  // Rastreabilidade
  fonte_desvio?: string;
  produto_id?: string;
  insumo_id?: string;
  lote_fornecedor?: string;
  fornecedor_id?: string;
  cliente_id?: string;
  pedido_venda_id?: string;
  // Contenção
  contencao_descricao?: string;
  contencao_responsavel?: string;
  contencao_data_inicio?: string;
  contencao_data_fim?: string;
  contencao_eficaz?: boolean;
  contencao_evidencias?: string;
  // RCA
  rca_metodo?: string;
  rca_descricao?: string;
  rca_por_que_1?: string;
  rca_por_que_2?: string;
  rca_por_que_3?: string;
  rca_por_que_4?: string;
  rca_por_que_5?: string;
  rca_conclusao?: string;
  // Plano de Ação
  plano_acoes?: PlanoAcaoItem[];
  // Implementação
  impl_observacoes?: string;
  impl_data_inicio?: string;
  impl_data_fim?: string;
  impl_responsavel?: string;
  impl_evidencias?: string;
  // Verificação
  verif_eficaz?: boolean;
  verif_metodo?: string;
  verif_resultado?: string;
  verif_data?: string;
  verif_responsavel?: string;
  verif_evidencias?: string;
  // Encerramento
  encerramento_aprovado_por?: string;
  encerramento_data?: string;
  encerramento_observacoes?: string;
  encerramento_licoes_aprendidas?: string;
  // Anexos
  contencao_anexos?: any[];
  impl_anexos?: any[];
  verif_anexos?: any[];
  encerramento_anexos?: any[];
}

export interface PlanoAcaoItem {
  id: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  status: string;
}

const FASES_ORDER = [
  'IDENTIFICACAO',
  'CONTENCAO',
  'RCA',
  'PLANO_ACAO',
  'IMPLEMENTACAO',
  'VERIFICACAO',
  'ENCERRAMENTO',
] as const;

export type FaseCapa = typeof FASES_ORDER[number];

export function getFaseIndex(fase: string): number {
  return FASES_ORDER.indexOf(fase as FaseCapa);
}

export function isFaseAtiva(faseAtual: string, faseTab: string): boolean {
  return getFaseIndex(faseTab) <= getFaseIndex(faseAtual);
}

export function getProximaFase(faseAtual: string): string | null {
  const idx = getFaseIndex(faseAtual);
  if (idx < FASES_ORDER.length - 1) return FASES_ORDER[idx + 1];
  return null;
}

export const FASES_LABELS: Record<string, string> = {
  IDENTIFICACAO: 'Identificação',
  CONTENCAO: 'Contenção',
  RCA: 'Análise de Causa Raiz',
  PLANO_ACAO: 'Plano de Ação',
  IMPLEMENTACAO: 'Implementação',
  VERIFICACAO: 'Verificação',
  ENCERRAMENTO: 'Encerramento',
};

export const FASES_STATUS_MAP: Record<string, string> = {
  IDENTIFICACAO: 'ABERTO',
  CONTENCAO: 'EM_CONTENCAO',
  RCA: 'EM_ANALISE',
  PLANO_ACAO: 'EM_ANALISE',
  IMPLEMENTACAO: 'EM_IMPLEMENTACAO',
  VERIFICACAO: 'EM_VERIFICACAO',
  ENCERRAMENTO: 'FECHADO',
};

export function useDesvioDetail(id?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['qc-desvio', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('qc_desvios')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as DesvioCompleto | null;
    },
    enabled: !!id,
  });

  const salvar = useMutation({
    mutationFn: async (desvio: Partial<DesvioCompleto> & { id?: string }) => {
      if (desvio.id) {
        const { id: desvioId, ...updates } = desvio;
        const { error } = await supabase
          .from('qc_desvios')
          .update(updates as any)
          .eq('id', desvioId);
        if (error) throw error;
        return { id: desvioId };
      } else {
        const { data, error } = await supabase
          .from('qc_desvios')
          .insert(desvio as any)
          .select('id')
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['qc-desvio', result.id] });
      queryClient.invalidateQueries({ queryKey: ['qc-desvios'] });
      toast.success('Desvio salvo com sucesso');
    },
    onError: () => toast.error('Erro ao salvar desvio'),
  });

  const avancarFase = useMutation({
    mutationFn: async ({ desvioId, proximaFase }: { desvioId: string; proximaFase: string }) => {
      const newStatus = FASES_STATUS_MAP[proximaFase] || 'EM_ANALISE';
      const { error } = await supabase
        .from('qc_desvios')
        .update({ fase_atual: proximaFase, status: newStatus } as any)
        .eq('id', desvioId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qc-desvio', id] });
      queryClient.invalidateQueries({ queryKey: ['qc-desvios'] });
      toast.success('Fase avançada com sucesso');
    },
    onError: () => toast.error('Erro ao avançar fase'),
  });

  return { ...query, salvar, avancarFase };
}
