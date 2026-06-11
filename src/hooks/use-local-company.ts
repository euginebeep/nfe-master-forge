import { useState, useEffect, useCallback } from 'react';
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
  const [company, setCompany] = useState<LocalCompany | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    setLoading(true);
    const data = LocalDb.getSingleton<LocalCompany>('company');
    
    // We strictly ignore any local storage data that marks itself as demo 
    // unless we are absolutely sure the session logic says otherwise.
    if (data?.is_demo && !sessionStorage.getItem('brainx_demo_mode')) {
      setCompany(null);
      setLoading(false);
      return;
    }
    setCompany(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data: company, isLoading: loading, refresh };
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
