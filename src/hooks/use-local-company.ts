import { useState, useEffect, useCallback, useMemo } from 'react';
import { LocalDb } from '@/lib/local-db';
import { toast } from 'sonner';

export interface LocalCompany {
  id: string;
  is_demo?: boolean;
  razao_social: string;
  nome_fantasia?: string;
  cnpj: string;
  ie?: string;
  im?: string;
  cnae?: string;
  crt?: string;
  regime_tributario?: string;
  endereco_logradouro?: string;
  endereco_nro?: string;
  endereco_compl?: string;
  endereco_bairro?: string;
  endereco_cidade?: string;
  endereco_uf?: string;
  endereco_cep?: string;
  endereco_pais?: string;
  telefone?: string;
  site?: string;
  email_fiscal?: string;
  email_financeiro?: string;
  nfe_ambiente?: 'HOMOLOGACAO' | 'PRODUCAO';
  nfe_serie_padrao?: number;
  nfe_numero_inicial?: number;
  csc_idtoken?: string;
  csc_token?: string;
  logo_nome?: string;
  logo_tipo?: string;
  logo_data?: string;
  certificado_nome?: string;
  certificado_tipo?: string;
  certificado_senha?: string;
  optout_parceiros?: boolean;
  created_at?: string;
  updated_at?: string;
}

export function useLocalCompany() {
  const [localData, setLocalData] = useState<LocalCompany | null>(() => {
    // Initial sync fetch to avoid flicker
    if (typeof window === 'undefined') return null;
    const data = LocalDb.getSingleton<LocalCompany>('company');
    const isDemoSession = sessionStorage.getItem('brainx_demo_mode') === 'true';
    if (data?.is_demo && !isDemoSession) return null;
    return data;
  });
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(() => {
    const data = LocalDb.getSingleton<LocalCompany>('company');
    const isDemoSession = sessionStorage.getItem('brainx_demo_mode') === 'true';
    if (data?.is_demo && !isDemoSession) {
      setLocalData(null);
    } else {
      setLocalData(data);
    }
  }, []);

  useEffect(() => {
    const handleLocalDbChange = (e: any) => {
      if (e.detail?.collection === 'company' || e.detail?.collection === '*') {
        refresh();
      }
    };
    window.addEventListener('localdb:change', handleLocalDbChange);
    return () => window.removeEventListener('localdb:change', handleLocalDbChange);
  }, [refresh]);

  return { data: localData, isLoading: loading, refresh };
}

export function useUpsertLocalCompany() {
  const upsert = useCallback((data: Partial<LocalCompany>, showToast = true) => {
    const updated = LocalDb.upsertSingleton<LocalCompany>('company', data as LocalCompany);
    if (showToast) {
      toast.success('Empresa salva com sucesso');
    }
    return updated;
  }, []);

  return { upsert };
}
