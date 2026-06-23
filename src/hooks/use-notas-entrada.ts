import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NotaEntrada {
  id: string;
  chave_nfe: string;
  numero: string;
  serie: string;
  modelo: string;
  dh_emissao: string;
  fornecedor_id?: string;
  fornecedor_razao?: string;
  fornecedor_cnpj?: string;
  fornecedor_nome_fantasia?: string;
  total_produtos: number;
  total_nota: number;
  status: 'IMPORTADA' | 'PROCESSADA' | 'CANCELADA';
  xml_raw?: string;
  created_at?: string;
  // Campos enriquecidos
  qtd_itens?: number;
  qtd_itens_vinculados?: number;
  // Financeiro
  vencimento?: string | null;
  status_financeiro?: 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'SEM_DUPLICATA';
  valor_pago?: number | null;
  total_parcelas?: number;
}

export interface NotaEntradaItem {
  id: string;
  nota_entrada_id: string;
  item_id?: string;
  codigo_fornecedor: string;
  descricao: string;
  ncm?: string;
  cfop?: string;
  ucom: string;
  qcom: number;
  vuncom: number;
  vprod: number;
}

export function useNotasEntrada() {
  return useQuery({
    queryKey: ['notas-entrada'],
    queryFn: async () => {
      // 1. Buscar notas com join de entidades (fornecedor)
      const { data: notas, error } = await supabase
        .from('notas_entrada')
        .select(`*, entidades:fornecedor_id (razao_social, nome_fantasia, cpf_cnpj)`)
        .order('dh_emissao', { ascending: false });

      if (error) throw error;
      if (!notas || notas.length === 0) return [];

      const notaIds = notas.map((n: any) => n.id);

      // 2. Contar itens por nota (total e vinculados)
      const { data: itensCounts } = await supabase
        .from('notas_entrada_itens')
        .select('nota_entrada_id, item_id')
        .in('nota_entrada_id', notaIds);

      // 3. Buscar contas a pagar vinculadas
      const { data: contasPagar } = await supabase
        .from('contas_pagar')
        .select('nota_entrada_id, data_vencimento, data_pagamento, status, valor, valor_pago, numero_parcela, total_parcelas')
        .in('nota_entrada_id', notaIds)
        .order('numero_parcela', { ascending: true });

      // Mapa de contagens de itens por nota
      const itensMap: Record<string, { total: number; vinculados: number }> = {};
      for (const item of (itensCounts || [])) {
        const nid = item.nota_entrada_id;
        if (!itensMap[nid]) itensMap[nid] = { total: 0, vinculados: 0 };
        itensMap[nid].total++;
        if (item.item_id) itensMap[nid].vinculados++;
      }

      // Mapa financeiro por nota
      const financeiroMap: Record<string, {
        vencimento: string | null;
        status_financeiro: 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'SEM_DUPLICATA';
        valor_pago: number | null;
        total_parcelas: number;
      }> = {};

      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);

      for (const cp of (contasPagar || [])) {
        const nid = cp.nota_entrada_id;
        if (!nid) continue;
        if (!financeiroMap[nid]) {
          const venc = cp.data_vencimento ? new Date(cp.data_vencimento) : null;
          let statusFin: 'PAGO' | 'PENDENTE' | 'VENCIDO' | 'SEM_DUPLICATA' = 'PENDENTE';
          if (cp.status === 'PAGO' || cp.data_pagamento) {
            statusFin = 'PAGO';
          } else if (venc && venc < hoje) {
            statusFin = 'VENCIDO';
          }
          financeiroMap[nid] = {
            vencimento: cp.data_vencimento ?? null,
            status_financeiro: statusFin,
            valor_pago: cp.valor_pago ?? null,
            total_parcelas: cp.total_parcelas ?? 1,
          };
        } else if (financeiroMap[nid].status_financeiro !== 'PAGO') {
          const venc = cp.data_vencimento ? new Date(cp.data_vencimento) : null;
          if (!(cp.status === 'PAGO' || cp.data_pagamento) && venc && venc < hoje) {
            financeiroMap[nid].status_financeiro = 'VENCIDO';
          }
        }
      }

      return notas.map((nota: any) => {
        const ent = nota.entidades;
        const itens = itensMap[nota.id] ?? { total: 0, vinculados: 0 };
        const fin = financeiroMap[nota.id] ?? null;
        return {
          id: nota.id,
          chave_nfe: nota.chave_nfe,
          numero: nota.numero,
          serie: nota.serie,
          modelo: nota.modelo,
          dh_emissao: nota.dh_emissao,
          fornecedor_id: nota.fornecedor_id,
          fornecedor_razao: ent?.razao_social ?? nota.fornecedor_razao ?? null,
          fornecedor_nome_fantasia: ent?.nome_fantasia ?? null,
          fornecedor_cnpj: ent?.cpf_cnpj ?? nota.fornecedor_cnpj ?? null,
          total_produtos: nota.total_produtos,
          total_nota: nota.total_nota,
          status: nota.status,
          xml_raw: nota.xml_raw,
          created_at: nota.created_at,
          qtd_itens: itens.total,
          qtd_itens_vinculados: itens.vinculados,
          vencimento: fin?.vencimento ?? null,
          status_financeiro: fin?.status_financeiro ?? 'SEM_DUPLICATA',
          valor_pago: fin?.valor_pago ?? null,
          total_parcelas: fin?.total_parcelas ?? 0,
        } as NotaEntrada;
      });
    },
  });
}

export function useNotaEntradaItems(notaId: string | undefined) {
  return useQuery({
    queryKey: ['nota-entrada-items', notaId],
    enabled: !!notaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notas_entrada_itens')
        .select('*')
        .eq('nota_entrada_id', notaId!);
      if (error) throw error;
      return (data || []) as unknown as NotaEntradaItem[];
    },
  });
}

export async function checkNFeExistsByChave(chave: string): Promise<NotaEntrada | null> {
  const { data } = await supabase
    .from('notas_entrada')
    .select('*')
    .eq('chave_nfe', chave)
    .maybeSingle();
  return (data as unknown as NotaEntrada) || null;
}

export async function saveNotaEntrada(input: Omit<NotaEntrada, 'id'>): Promise<NotaEntrada> {
  const { data, error } = await supabase
    .from('notas_entrada')
    .insert(input as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as NotaEntrada;
}

export async function saveNotaEntradaItem(input: Omit<NotaEntradaItem, 'id'>): Promise<NotaEntradaItem> {
  const { data, error } = await supabase
    .from('notas_entrada_itens')
    .insert(input as any)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as NotaEntradaItem;
}
