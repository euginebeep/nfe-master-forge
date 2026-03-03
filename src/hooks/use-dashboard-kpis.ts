import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardKPIs {
  totalEntidades: number;
  totalItens: number;
  totalLotes: number;
  lotesQuarentena: number;
  lotesAprovados: number;
  lotesVencendo30d: number;
  totalOPs: number;
  opsEmAndamento: number;
  opsFinalizadas: number;
  totalNotasEntrada: number;
  valorTotalNotas: number;
  totalFormulas: number;
}

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async (): Promise<DashboardKPIs> => {
      const [
        entidades,
        itens,
        lotes,
        lotesQ,
        lotesA,
        lotesV,
        ops,
        opsAnd,
        opsFin,
        notas,
        formulas,
      ] = await Promise.all([
        supabase.from("entidades").select("id"),
        supabase.from("itens").select("id").eq("ativo", true),
        supabase.from("estoque_lotes").select("id"),
        supabase.from("estoque_lotes").select("id").eq("status", "QUARENTENA"),
        supabase.from("estoque_lotes").select("id").eq("status", "APROVADO"),
        supabase.from("estoque_lotes").select("id")
          .eq("status", "APROVADO")
          .lte("data_val", new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0])
          .gte("data_val", new Date().toISOString().split("T")[0]),
        supabase.from("ordens_producao_industrial").select("id"),
        supabase.from("ordens_producao_industrial").select("id").in("status", ["EM_PRODUCAO", "PESAGEM", "MISTURA", "ENCAPSULAMENTO"]),
        supabase.from("ordens_producao_industrial").select("id").eq("status", "FINALIZADA"),
        supabase.from("notas_entrada").select("id, total_nota"),
        supabase.from("formulas").select("id"),
      ]);

      const valorTotal = (notas.data || []).reduce(
        (sum, n) => sum + (Number((n as { total_nota?: number }).total_nota) || 0),
        0
      );

      return {
        totalEntidades: entidades.data?.length || 0,
        totalItens: itens.data?.length || 0,
        totalLotes: lotes.data?.length || 0,
        lotesQuarentena: lotesQ.data?.length || 0,
        lotesAprovados: lotesA.data?.length || 0,
        lotesVencendo30d: lotesV.data?.length || 0,
        totalOPs: ops.data?.length || 0,
        opsEmAndamento: opsAnd.data?.length || 0,
        opsFinalizadas: opsFin.data?.length || 0,
        totalNotasEntrada: notas.data?.length || 0,
        valorTotalNotas: valorTotal,
        totalFormulas: formulas.data?.length || 0,
      };
    },
    staleTime: 60_000,
  });
}
