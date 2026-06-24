import { useCallback, useState } from 'react';
import { useSupabase } from './use-supabase';
import { toast } from 'sonner';

export type EntidadeStatus = 
  | 'PENDENTE_CERTIFICADO' 
  | 'CERTIFICADO_VALIDADO' 
  | 'DADOS_COMPLETOS' 
  | 'INATIVO';

export interface EntidadeData {
  id?: string;
  documento: string; // CNPJ
  company_id: string;
  razao_social: string;
  nome_fantasia?: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  status?: EntidadeStatus;
  classificacao?: string;
  site?: string;
}

interface UpsertResult {
  success: boolean;
  entidade_id?: string;
  error?: string;
}

/**
 * Hook para fazer upsert seguro de entidades (previne duplicação de CNPJ)
 * Usa a função RPC do Supabase que implementa lógica idempotente
 */
export function useEntidadeUpsert() {
  const { supabase } = useSupabase();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upsert = useCallback(
    async (data: EntidadeData): Promise<UpsertResult> => {
      try {
        setLoading(true);
        setError(null);

        // Validar dados obrigatórios
        if (!data.documento) {
          throw new Error('CNPJ é obrigatório');
        }
        if (!data.company_id) {
          throw new Error('Company ID é obrigatório');
        }
        if (!data.razao_social) {
          throw new Error('Razão social é obrigatória');
        }

        // Chamar função RPC que faz upsert seguro
        const { data: result, error: rpcError } = await supabase.rpc(
          'upsert_entidade',
          {
            p_id: data.id || null,
            p_documento: data.documento,
            p_company_id: data.company_id,
            p_razao_social: data.razao_social,
            p_nome_fantasia: data.nome_fantasia || null,
            p_ie: data.ie || null,
            p_im: data.im || null,
            p_cnae: data.cnae || null,
            p_crt: data.crt || null,
            p_status: data.status || 'PENDENTE_CERTIFICADO',
            p_classificacao: data.classificacao || 'REGULAR',
            p_site: data.site || null,
          }
        );

        if (rpcError) {
          // Verificar se é erro de duplicação
          if (rpcError.message.includes('já existe')) {
            throw new Error(
              `Esta empresa (CNPJ ${data.documento}) já está cadastrada neste tenant`
            );
          }
          throw rpcError;
        }

        if (!result) {
          throw new Error('Falha ao criar/atualizar entidade');
        }

        toast.success('Entidade salva com sucesso');

        return {
          success: true,
          entidade_id: result,
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(errorMessage);
        toast.error(errorMessage);

        return {
          success: false,
          error: errorMessage,
        };
      } finally {
        setLoading(false);
      }
    },
    [supabase]
  );

  /**
   * Verificar se CNPJ já existe no tenant
   */
  const checkDuplicate = useCallback(
    async (documento: string, company_id: string): Promise<boolean> => {
      try {
        const { data, error } = await supabase
          .from('entidades')
          .select('id')
          .eq('documento', documento)
          .eq('company_id', company_id)
          .neq('status', 'INATIVO')
          .limit(1);

        if (error) throw error;

        return data && data.length > 0;
      } catch (err) {
        console.error('Erro ao verificar duplicação:', err);
        return false;
      }
    },
    [supabase]
  );

  /**
   * Atualizar status da entidade
   */
  const updateStatus = useCallback(
    async (entidade_id: string, status: EntidadeStatus): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from('entidades')
          .update({ status })
          .eq('id', entidade_id);

        if (error) throw error;

        toast.success(`Status atualizado para ${status}`);
        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
        toast.error(errorMessage);
        return false;
      }
    },
    [supabase]
  );

  /**
   * Obter histórico de auditoria da entidade
   */
  const getAuditHistory = useCallback(
    async (entidade_id: string) => {
      try {
        const { data, error } = await supabase
          .from('entidades_auditoria')
          .select('*')
          .eq('entidade_id', entidade_id)
          .order('timestamp', { ascending: false });

        if (error) throw error;

        return data || [];
      } catch (err) {
        console.error('Erro ao obter histórico:', err);
        return [];
      }
    },
    [supabase]
  );

  return {
    upsert,
    checkDuplicate,
    updateStatus,
    getAuditHistory,
    loading,
    error,
  };
}
