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
  // 3-way match (Fase 5)
  pedido_id?: string | null;
  nota_avulsa?: boolean;
  motivo_sem_pedido?: string | null;
  pedido_numero?: string | null;
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
        .select(`
          *,
          entidades:fornecedor_id (razao_social, nome_fantasia, documento),
          pedido:pedido_id (id, numero_interno)
        `)
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
        const ped = nota.pedido;
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
          fornecedor_cnpj: ent?.documento ?? nota.fornecedor_cnpj ?? null,
          total_produtos: nota.total_produtos,
          total_nota: nota.total_nota,
          status: nota.status,
          xml_raw: nota.xml_raw,
          created_at: nota.created_at,
          qtd_itens: itens.total,
          qtd_itens_vinculados: itens.vinculados,
          pedido_id: nota.pedido_id ?? ped?.id ?? null,
          nota_avulsa: !!nota.nota_avulsa,
          motivo_sem_pedido: nota.motivo_sem_pedido ?? null,
          pedido_numero: ped?.numero_interno ?? null,
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


// ============================================================
// PASSO 1 + PASSO 2: Processar Nota (IMPORTADA → PROCESSADA)
// ============================================================
export async function processarNota(notaId: string): Promise<{
  movimentacoes: number;
  contas_pagar: number;
}> {
  try {
    // 1. Buscar nota
    const { data: nota, error: notaError } = await supabase
      .from('notas_entrada')
      .select('*')
      .eq('id', notaId)
      .single();

    if (notaError || !nota) throw new Error('Nota não encontrada');
    if (nota.status !== 'IMPORTADA') throw new Error('Nota não está em status IMPORTADA');

    // 2. Buscar itens da nota
    const { data: itens, error: itensError } = await supabase
      .from('notas_entrada_itens')
      .select('*')
      .eq('nota_entrada_id', notaId);

    if (itensError) throw itensError;
    if (!itens || itens.length === 0) throw new Error('Nota sem itens');

    // 3. Validar que TODOS os itens têm item_id vinculado
    const itensNaoVinculados = itens.filter((i: any) => !i.item_id);
    if (itensNaoVinculados.length > 0) {
      throw new Error(
        `${itensNaoVinculados.length} item(ns) não vinculado(s) ao cadastro. Vincule todos antes de processar.`
      );
    }

    // 4. Registrar movimentações de estoque (ENTRADA)
    const { inserirMovimentacaoEstoque } = await import('@/hooks/use-estoque-movimentacoes');

    let movimentacoesCount = 0;
    for (const item of itens) {
      try {
        await inserirMovimentacaoEstoque({
          tipo: 'ENTRADA',
          item_id: item.item_id,
          quantidade: item.qcom,
          unidade: item.ucom,
          custo_unitario: item.vuncom,
          documento_ref: 'NOTA_ENTRADA',
          documento_ref_id: notaId,
        });
        movimentacoesCount++;
      } catch (movErr) {
        console.error(`Erro ao registrar movimentação para item ${item.item_id}:`, movErr);
        throw new Error(`Falha ao registrar movimentação: ${movErr}`);
      }
    }

    // 5. PASSO 2: Extrair duplicatas do XML e gerar contas a pagar
    let contasPagarCount = 0;

    // Verificar se já existem contas a pagar para esta nota (evitar duplicação)
    const { data: contasExistentes } = await supabase
      .from('contas_pagar')
      .select('id')
      .eq('nota_entrada_id', notaId);

    if (!contasExistentes || contasExistentes.length === 0) {
      // Parsear XML para extrair duplicatas
      let duplicatas: Array<{ nDup: string; dVenc: string; vDup: number }> = [];

      if (nota.xml_raw) {
        try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(nota.xml_raw, 'text/xml');

          // Buscar todas as tags <dup> dentro de <cobr>
          const dupElements = xmlDoc.querySelectorAll('cobr dup');
          if (dupElements.length > 0) {
            dupElements.forEach((dupEl: any) => {
              const nDupEl = dupEl.querySelector('nDup');
              const dVencEl = dupEl.querySelector('dVenc');
              const vDupEl = dupEl.querySelector('vDup');

              if (nDupEl && dVencEl && vDupEl) {
                duplicatas.push({
                  nDup: nDupEl.textContent || '',
                  dVenc: dVencEl.textContent || '',
                  vDup: parseFloat(vDupEl.textContent || '0'),
                });
              }
            });
          }
        } catch (xmlErr) {
          console.warn('Erro ao parsear XML:', xmlErr);
        }
      }

      // Se não encontrou duplicatas, gerar uma conta única (à vista)
      if (duplicatas.length === 0) {
        duplicatas = [
          {
            nDup: '1',
            dVenc: nota.dh_emissao.split('T')[0], // data de emissão
            vDup: nota.total_nota,
          },
        ];
      }

      // Gerar contas a pagar por parcela
      for (let i = 0; i < duplicatas.length; i++) {
        const dup = duplicatas[i];
        const { error: cpError } = await supabase
          .from('contas_pagar')
          .insert({
            nota_entrada_id: notaId,
            fornecedor_id: nota.fornecedor_id,
            descricao: `NF ${nota.numero} - parcela ${dup.nDup}`,
            numero_parcela: i + 1,
            total_parcelas: duplicatas.length,
            valor: dup.vDup,
            data_emissao: nota.dh_emissao.split('T')[0],
            data_vencimento: dup.dVenc,
            status: 'PENDENTE',
            categoria: 'COMPRA_INSUMO',
            company_id: nota.company_id,
          });

        if (cpError) {
          console.error('Erro ao gerar conta a pagar:', cpError);
          throw new Error(`Falha ao gerar conta a pagar: ${cpError.message}`);
        }
        contasPagarCount++;
      }
    }

    // 6. Atualizar status da nota para PROCESSADA
    const { error: updateError } = await supabase
      .from('notas_entrada')
      .update({ status: 'PROCESSADA' })
      .eq('id', notaId);

    if (updateError) throw updateError;

    return {
      movimentacoes: movimentacoesCount,
      contas_pagar: contasPagarCount,
    };
  } catch (err) {
    console.error('Erro em processarNota:', err);
    throw err;
  }
}

