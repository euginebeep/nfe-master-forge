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
        supabase.from("entidades").select("id", { count: "exact", head: true }),
        supabase.from("itens").select("id", { count: "exact", head: true }).eq("ativo", true),
        supabase.from("estoque_lotes").select("id", { count: "exact", head: true }),
        supabase.from("estoque_lotes").select("id", { count: "exact", head: true }).eq("status", "QUARENTENA"),
        supabase.from("estoque_lotes").select("id", { count: "exact", head: true }).eq("status", "APROVADO"),
        supabase.from("estoque_lotes").select("id", { count: "exact", head: true })
          .eq("status", "APROVADO")
          .lte("data_val", new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0])
          .gte("data_val", new Date().toISOString().split("T")[0]),
        supabase.from("ordens_producao_industrial" as any).select("id", { count: "exact", head: true }),
        supabase.from("ordens_producao_industrial" as any).select("id", { count: "exact", head: true }).in("status", ["EM_PRODUCAO", "PESAGEM", "MISTURA", "ENCAPSULAMENTO"]),
        supabase.from("ordens_producao_industrial" as any).select("id", { count: "exact", head: true }).eq("status", "FINALIZADA"),
        supabase.from("notas_entrada").select("id, total_nota"),
        supabase.from("formulas").select("id", { count: "exact", head: true }),
      ]);

      const valorTotal = (notas.data || []).reduce((sum, n: any) => sum + (Number(n.total_nota) || 0), 0);

      return {
        totalEntidades: entidades.count || 0,
        totalItens: itens.count || 0,
        totalLotes: lotes.count || 0,
        lotesQuarentena: lotesQ.count || 0,
        lotesAprovados: lotesA.count || 0,
        lotesVencendo30d: lotesV.count || 0,
        totalOPs: ops.count || 0,
        opsEmAndamento: opsAnd.count || 0,
        opsFinalizadas: opsFin.count || 0,
        totalNotasEntrada: notas.count || (notas.data?.length || 0),
        valorTotalNotas: valorTotal,
        totalFormulas: formulas.count || 0,
      };
    },
    staleTime: 60_000,
  });
}
