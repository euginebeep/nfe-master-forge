import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LocalDb } from "@/lib/local-db";

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
      // Try Supabase first
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
        supabase.from("ordens_producao_industrial" as any).select("id"),
        supabase.from("ordens_producao_industrial" as any).select("id").in("status", ["EM_PRODUCAO", "PESAGEM", "MISTURA", "ENCAPSULAMENTO"]),
        supabase.from("ordens_producao_industrial" as any).select("id").eq("status", "FINALIZADA"),
        supabase.from("notas_entrada").select("id, total_nota"),
        supabase.from("formulas").select("id"),
      ]);

      const supabaseEntidades = entidades.data?.length || 0;
      const supabaseItens = itens.data?.length || 0;
      const supabaseLotes = lotes.data?.length || 0;
      const supabaseNotas = notas.data?.length || 0;

      // Check if Supabase has data - if yes, use it exclusively
      const hasSupabaseData = supabaseEntidades > 0 || supabaseItens > 0 || supabaseLotes > 0 || supabaseNotas > 0;

      if (hasSupabaseData) {
        const valorTotal = (notas.data || []).reduce((sum, n) => sum + (Number((n as { total_nota?: number }).total_nota) || 0), 0);

        return {
          totalEntidades: supabaseEntidades,
          totalItens: supabaseItens,
          totalLotes: supabaseLotes,
          lotesQuarentena: lotesQ.data?.length || 0,
          lotesAprovados: lotesA.data?.length || 0,
          lotesVencendo30d: lotesV.data?.length || 0,
          totalOPs: ops.data?.length || 0,
          opsEmAndamento: opsAnd.data?.length || 0,
          opsFinalizadas: opsFin.data?.length || 0,
          totalNotasEntrada: supabaseNotas,
          valorTotalNotas: valorTotal,
          totalFormulas: formulas.data?.length || 0,
        };
      }

      // Fallback to LocalDb
      console.log('[Dashboard KPIs] Supabase empty, using LocalDb fallback');

      const localEntidades = LocalDb.getCollection<{ id: string }>('entidades');
      const localItens = LocalDb.getCollection<{ id: string; ativo?: boolean }>('itens');
      const localLotes = LocalDb.getCollection<{ id: string; status?: string; data_val?: string; quantidade_interna?: number }>('estoque_lotes');
      const localNotas = LocalDb.getCollection<{ id: string; total_nota?: number }>('notas_entrada');

      const now = new Date();
      const in30d = new Date(Date.now() + 30 * 86400000);
      const todayStr = now.toISOString().split("T")[0];
      const in30dStr = in30d.toISOString().split("T")[0];

      const localLotesAprovados = localLotes.filter(l => l.status === 'APROVADO');
      const localLotesQuarentena = localLotes.filter(l => l.status === 'QUARENTENA');
      const localLotesVencendo = localLotesAprovados.filter(l => {
        if (!l.data_val) return false;
        const dv = l.data_val.split("T")[0];
        return dv >= todayStr && dv <= in30dStr;
      });

      const localValorTotal = localNotas.reduce((sum, n) => sum + (Number(n.total_nota) || 0), 0);

      return {
        totalEntidades: localEntidades.length,
        totalItens: localItens.filter(i => i.ativo !== false).length,
        totalLotes: localLotes.length,
        lotesQuarentena: localLotesQuarentena.length,
        lotesAprovados: localLotesAprovados.length,
        lotesVencendo30d: localLotesVencendo.length,
        totalOPs: 0, // OPs not in LocalDb
        opsEmAndamento: 0,
        opsFinalizadas: 0,
        totalNotasEntrada: localNotas.length,
        valorTotalNotas: localValorTotal,
        totalFormulas: 0, // Formulas not in LocalDb
      };
    },
    staleTime: 60_000,
  });
}
