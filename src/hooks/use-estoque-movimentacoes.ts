import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getUserCompanyId } from '@/hooks/use-user-company';
import { toast } from 'sonner';

export interface EstoqueMovimentacao {
  id: string;
  tipo: string;
  item_id: string;
  lote_id: string | null;
  quantidade: number;
  unidade: string;
  custo_unitario: number | null;
  motivo: string;
  documento_ref: string | null;
  origem: string;
  observacoes: string | null;
  created_at: string;
  item?: { descricao_interna: string; sku_interno: string | null };
  lote?: { numero_lote: string } | null;
}

export function useEstoqueMovimentacoes() {
  const queryClient = useQueryClient();

  const { data: movimentacoes = [], isLoading } = useQuery({
    queryKey: ['estoque-movimentacoes'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_movimentacoes')
        .select('*, itens!inner(descricao_interna, sku_interno), estoque_lotes(numero_lote)')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []).map((m: Record<string, unknown>) => ({
        ...m,
        item: m.itens as { descricao_interna: string; sku_interno: string | null },
        lote: m.estoque_lotes as { numero_lote: string } | null,
      })) as EstoqueMovimentacao[];
    },
  });

  const createMovimentacao = useMutation({
    mutationFn: async (mov: {
      tipo: string;
      item_id: string;
      lote_id?: string;
      quantidade: number;
      unidade: string;
      custo_unitario?: number;
      motivo: string;
      documento_ref?: string;
      origem?: string;
      observacoes?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');
      const companyId = await getUserCompanyId();
      if (!companyId) throw new Error('Empresa não identificada');
      const { error } = await supabase.from('estoque_movimentacoes').insert({
        ...mov,
        usuario_id: user.id,
        company_id: companyId,
      });
      if (error) throw error;
    },
    onSuccess: async (_, mov) => {
      queryClient.invalidateQueries({ queryKey: ['estoque-movimentacoes'] });
      toast.success('Movimentação registrada com sucesso!');

      // ── PASSO 4: Recebimento DESTRAVA OPs em stand-by ────────
      if (mov.tipo === 'ENTRADA' && mov.item_id) {
        try {
          // Buscar OPs em AGUARDANDO_MATERIAIS com requisição envolvendo este item
          const { data: requisicoes } = await supabase
            .from('requisicoes_compra_itens')
            .select('requisicao_id, requisicao:requisicoes_compra(op_id)')
            .eq('item_id', mov.item_id)
            .eq('status', 'PENDENTE');

          if (requisicoes && requisicoes.length > 0) {
            const opIds = [...new Set(requisicoes.map((r: any) => r.requisicao?.op_id).filter(Boolean))];

            for (const opId of opIds) {
              try {
                // Buscar OP
                const { data: op } = await supabase
                  .from('ordens_producao_industrial')
                  .select('id, codigo, formula_id, quantidade_frascos, company_id')
                  .eq('id', opId)
                  .single();

                if (op && op.status === 'AGUARDANDO_MATERIAIS') {
                  // RE-RODAR verificação MRP
                  const { calcularNecessidadeOP } = await import('@/hooks/use-ordem-producao-industrial');
                  const necessidades = await calcularNecessidadeOP(op);

                  if (necessidades.length > 0) {
                    const itemIds = necessidades.map(n => n.item_id);
                    const { getSaldos } = await import('@/hooks/use-estoque-movimentacoes');
                    const saldos = await getSaldos(itemIds);

                    const faltantes = necessidades.filter(n => {
                      const saldo = saldos[n.item_id] || 0;
                      return n.quantidade > saldo;
                    });

                    if (faltantes.length === 0) {
                      // Liberar OP: mudar para PLANEJADA
                      const { error: updateError } = await supabase
                        .from('ordens_producao_industrial')
                        .update({ status: 'PLANEJADA' })
                        .eq('id', opId);

                      if (!updateError) {
                        // Marcar requisição como ATENDIDA
                        const { error: reqUpdateError } = await supabase
                          .from('requisicoes_compra')
                          .update({ status: 'ATENDIDA' })
                          .eq('op_id', opId);

                        if (!reqUpdateError) {
                          toast.success(`OP ${op.codigo} liberada — materiais disponíveis`);
                        }
                      }
                    } else {
                      // Ainda falta: atualizar requisição para PARCIAL
                      const { error: partialError } = await supabase
                        .from('requisicoes_compra')
                        .update({ status: 'PARCIAL' })
                        .eq('op_id', opId);

                      // Atualizar quantidades dos itens faltantes
                      for (const f of faltantes) {
                        await supabase
                          .from('requisicoes_compra_itens')
                          .update({
                            quantidade_disponivel: saldos[f.item_id] || 0,
                            quantidade_faltante: f.quantidade - (saldos[f.item_id] || 0),
                          })
                          .eq('item_id', f.item_id)
                          .eq('requisicao_id', requisicoes[0].requisicao_id);
                      }
                    }
                  }
                }
              } catch (opErr) {
                console.error('Erro ao reavalia OP:', opErr);
              }
            }
          }
        } catch (mrpErr) {
          console.error('Erro ao verificar OPs em stand-by:', mrpErr);
        }
      }
    },
    onError: () => {
      toast.error('Erro ao registrar movimentação');
    },
  });

  return { movimentacoes, isLoading, createMovimentacao };
}

/**
 * Calcula o saldo de um item somando ENTRADAS - SAIDAS
 * @param itemId ID do item
 * @returns Saldo em unidade interna (ou 0 se não encontrado)
 */
export async function getSaldoItem(itemId: string): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('estoque_movimentacoes')
      .select('tipo, quantidade')
      .eq('item_id', itemId);

    if (error) {
      console.error('Erro ao buscar saldo do item:', error);
      return 0;
    }

    const saldo = (data || []).reduce((acc, mov: any) => {
      if (mov.tipo === 'ENTRADA') return acc + (mov.quantidade || 0);
      if (mov.tipo === 'SAIDA') return acc - (mov.quantidade || 0);
      return acc;
    }, 0);

    return Math.max(0, saldo);
  } catch (err) {
    console.error('Erro em getSaldoItem:', err);
    return 0;
  }
}

/**
 * Calcula saldos de múltiplos itens em uma única query (performance)
 * @param itemIds Array de IDs dos itens
 * @returns Record com { [itemId]: saldo }
 */
export async function getSaldos(itemIds: string[]): Promise<Record<string, number>> {
  if (!itemIds || itemIds.length === 0) return {};

  try {
    const { data, error } = await supabase
      .from('estoque_movimentacoes')
      .select('item_id, tipo, quantidade')
      .in('item_id', itemIds);

    if (error) {
      console.error('Erro ao buscar saldos:', error);
      return itemIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {});
    }

    const saldos: Record<string, number> = {};
    itemIds.forEach(id => { saldos[id] = 0; });

    (data || []).forEach((mov: any) => {
      if (!saldos.hasOwnProperty(mov.item_id)) saldos[mov.item_id] = 0;
      if (mov.tipo === 'ENTRADA') saldos[mov.item_id] += mov.quantidade || 0;
      if (mov.tipo === 'SAIDA') saldos[mov.item_id] -= mov.quantidade || 0;
    });

    // Garantir que nenhum saldo seja negativo
    Object.keys(saldos).forEach(id => {
      saldos[id] = Math.max(0, saldos[id]);
    });

    return saldos;
  } catch (err) {
    console.error('Erro em getSaldos:', err);
    return itemIds.reduce((acc, id) => ({ ...acc, [id]: 0 }), {});
  }
}
