import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EstoqueCheck {
  disponivel: number;
  paraProducao: number;
  temEstoqueSuficiente: boolean;
  temEstoqueParcial: boolean;
  semEstoque: boolean;
}

/**
 * Verifica estoque disponível de produto acabado para um item.
 * RLS já filtra por company via op_id; usamos produto_id (campo real da tabela).
 */
export async function checkEstoqueDisponivel(
  itemId: string,
  quantidade: number,
  _companyId?: string | null
): Promise<EstoqueCheck> {
  const { data } = await supabase
    .from("lotes_produto_acabado")
    .select("quantidade_aprovada")
    .eq("produto_id", itemId)
    .eq("status", "DISPONIVEL");

  const totalEstoque =
    data?.reduce((s, l) => s + (Number(l.quantidade_aprovada) || 0), 0) || 0;
  const disponivel = Math.min(totalEstoque, quantidade);
  const paraProducao = Math.max(0, quantidade - totalEstoque);

  return {
    disponivel,
    paraProducao,
    temEstoqueSuficiente: totalEstoque >= quantidade && quantidade > 0,
    temEstoqueParcial: totalEstoque > 0 && totalEstoque < quantidade,
    semEstoque: totalEstoque === 0,
  };
}

function gerarCodigoOP() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(
    d.getDate()
  ).padStart(2, "0")}`;
  return `OP-${stamp}-${Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0")}`;
}

export interface ConfirmarPedidoResult {
  ops_geradas: number;
  itens_do_estoque: number;
}

export function useConfirmarPedido() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      pedidoId,
      companyId,
    }: {
      pedidoId: string;
      companyId: string;
    }): Promise<ConfirmarPedidoResult> => {
      const { data: itens, error: errItens } = await supabase
        .from("pedido_vendedor_itens")
        .select("*")
        .eq("pedido_id", pedidoId);
      if (errItens) throw errItens;

      let opsGeradas = 0;
      let itensEstoque = 0;

      for (const item of itens || []) {
        const check = await checkEstoqueDisponivel(
          item.item_id,
          Number(item.quantidade) || 0,
          companyId
        );

        await supabase
          .from("pedido_vendedor_itens")
          .update({
            qtd_do_estoque: check.disponivel,
            qtd_para_producao: check.paraProducao,
          })
          .eq("id", item.id);

        if (check.paraProducao > 0) {
          const { data: itemRow } = await supabase
            .from("itens")
            .select("formula_id, descricao_interna")
            .eq("id", item.item_id)
            .maybeSingle();

          const today = new Date();
          const dataFab = today.toISOString().slice(0, 10);
          const val = new Date(today);
          val.setDate(val.getDate() + 365);
          const dataVal = val.toISOString().slice(0, 10);

          const { data: novaOP, error: errOP } = await supabase
            .from("ordens_producao_industrial")
            .insert({
              codigo: gerarCodigoOP(),
              produto_nome:
                item.item_nome || itemRow?.descricao_interna || "Produto",
              produto_id: item.item_id,
              formula_id: itemRow?.formula_id ?? null,
              quantidade_frascos: Math.ceil(check.paraProducao),
              capsulas_por_frasco: 0,
              total_capsulas: 0,
              total_capsulas_com_acrescimo: 0,
              tipo_apresentacao: "CAPSULA",
              status: "PLANEJADA",
              pedido_id: pedidoId,
              lote_produto_acabado: `AUTO-${Date.now()}`,
              data_fabricacao: dataFab,
              data_validade: dataVal,
              company_id: companyId,
              observacoes: `Gerada automaticamente — Pedido #${pedidoId}`,
            } as any)
            .select("id")
            .maybeSingle();

          if (errOP) throw errOP;

          if (novaOP?.id) {
            opsGeradas += 1;
            await supabase
              .from("pedido_vendedor_itens")
              .update({ op_id: novaOP.id, status_item: "EM_PRODUCAO" })
              .eq("id", item.id);
          }
        }

        if (check.disponivel > 0) {
          itensEstoque += 1;
          if (check.paraProducao === 0) {
            await supabase
              .from("pedido_vendedor_itens")
              .update({ status_item: "RESERVADO" })
              .eq("id", item.id);
          }
        }
      }

      await supabase
        .from("pedidos_vendedor")
        .update({ status: "CONFIRMADO", updated_at: new Date().toISOString() })
        .eq("id", pedidoId);

      return { ops_geradas: opsGeradas, itens_do_estoque: itensEstoque };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos-vendedor"] });
      qc.invalidateQueries({ queryKey: ["ordens-producao-industrial"] });
    },
  });
}