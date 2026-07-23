import { supabase } from '@/integrations/supabase/client';

/**
 * Razão social vigente na data do evento (histórico Vitalnow → ProLab etc.).
 * Fallback para o cadastro atual se a RPC ainda não estiver tipada / disponível.
 */
export async function empresaRazaoSocialEm(
  companyId: string,
  dataIso: string,
  fallback: string,
): Promise<string> {
  try {
    const { data, error } = await (supabase as any).rpc('empresa_razao_social_em', {
      p_company_id: companyId,
      p_em: dataIso,
    });
    if (error || data == null) return fallback;
    if (typeof data === 'string') return data;
    if (typeof data === 'object' && data.razao_social) return String(data.razao_social);
    return fallback;
  } catch {
    return fallback;
  }
}

/** RT vigente na data do evento (histórico Laura → Camila etc.). */
export async function empresaRtEm(
  companyId: string,
  dataIso: string,
): Promise<{
  nome?: string | null;
  tipo_conselho?: string | null;
  uf_conselho?: string | null;
  numero_registro?: string | null;
} | null> {
  try {
    const { data, error } = await (supabase as any).rpc('empresa_rt_em', {
      p_company_id: companyId,
      p_em: dataIso,
    });
    if (error || !data) return null;
    if (Array.isArray(data)) return data[0] ?? null;
    return data;
  } catch {
    return null;
  }
}
