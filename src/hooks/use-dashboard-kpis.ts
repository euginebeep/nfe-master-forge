import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardKPIs {
  totalEntidades: number;
  totalItens: number;
  totalLotes: number;
  lotesQuarentena: number;
  lotesAprovados: number;
  lotesDisponiveis: number;
  lotesVencendo30d: number;
  totalOPs: number;
  opsEmAndamento: number;
  opsFinalizadas: number;
  totalNotasEntrada: number;
  valorTotalNotas: number;
  totalFormulas: number;
}

/**
 * Resultado de uma contagem no Postgrest.
 * IMPORTANTE: usar { count: 'exact', head: true } em vez de .select('id') + data.length.
 * O Postgrest limita a resposta a 1000 linhas por padrão — contar pelo length do array
 * faz o KPI PARAR de crescer em 1000 sem avisar ninguém (número errado em silêncio).
 * Com head:true o banco devolve só o total, sem trafegar as linhas.
 */
type CountResult = { count: number | null; error: { message?: string; code?: string } | null };

function unwrapCount(res: CountResult, rotulo: string): number {
  if (res.error) {
    // não mascara falha como zero — quem chama decide como mostrar
    throw new Error(`${rotulo}: ${res.error.message || res.error.code || "erro desconhecido"}`);
  }
  return res.count ?? 0;
}

export function useDashboardKPIs() {
  return useQuery({
    queryKey: ["dashboard-kpis"],
    queryFn: async (): Promise<DashboardKPIs> => {
      const hoje = new Date().toISOString().split("T")[0];
      const em30dias = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

      const C = { count: "exact" as const, head: true };

      const [
        entidades,
        itens,
        lotes,
        lotesQ,
        lotesA,
        lotesD,
        lotesV,
        ops,
        opsAnd,
        opsFin,
        notasCount,
        formulas,
      ] = await Promise.all([
        supabase.from("entidades").select("*", C),
        supabase.from("itens").select("*", C).eq("ativo", true),
        supabase.from("estoque_lotes").select("*", C),
        supabase.from("estoque_lotes").select("*", C).eq("status", "QUARENTENA"),
        supabase.from("estoque_lotes").select("*", C).in("status", ["APROVADO", "DISPONIVEL"]),
        supabase.from("estoque_lotes").select("*", C).eq("status", "DISPONIVEL"),
        supabase
          .from("estoque_lotes")
          .select("*", C)
          .in("status", ["APROVADO", "DISPONIVEL"])
          .lte("data_val", em30dias)
          .gte("data_val", hoje),
        supabase.from("ordens_producao_industrial").select("*", C),
        supabase
          .from("ordens_producao_industrial")
          .select("*", C)
          .in("status", ["EM_PRODUCAO", "PESAGEM", "MISTURA", "ENCAPSULAMENTO"]),
        supabase.from("ordens_producao_industrial").select("*", C).eq("status", "FINALIZADA"),
        supabase.from("notas_entrada").select("*", C),
        supabase.from("formulas").select("*", C),
      ]);

      // O valor total das notas é uma SOMA, não uma contagem: precisa das linhas.
      // Paginamos em blocos de 1000 para não perder nota nenhuma quando o volume crescer.
      let valorTotalNotas = 0;
      const PAGINA = 1000;
      for (let inicio = 0; ; inicio += PAGINA) {
        const { data, error } = await supabase
          .from("notas_entrada")
          .select("total_nota")
          .range(inicio, inicio + PAGINA - 1);

        if (error) {
          throw new Error(`valor total das notas: ${error.message || error.code}`);
        }
        const linhas = data ?? [];
        valorTotalNotas += linhas.reduce(
          (soma, n) => soma + (Number((n as { total_nota?: number }).total_nota) || 0),
          0
        );
        if (linhas.length < PAGINA) break; // última página
      }

      return {
        totalEntidades: unwrapCount(entidades, "entidades"),
        totalItens: unwrapCount(itens, "itens"),
        totalLotes: unwrapCount(lotes, "lotes"),
        lotesQuarentena: unwrapCount(lotesQ, "lotes em quarentena"),
        lotesAprovados: unwrapCount(lotesA, "lotes aprovados"),
        lotesDisponiveis: unwrapCount(lotesD, "lotes disponíveis"),
        lotesVencendo30d: unwrapCount(lotesV, "lotes vencendo em 30 dias"),
        totalOPs: unwrapCount(ops, "ordens de produção"),
        opsEmAndamento: unwrapCount(opsAnd, "OPs em andamento"),
        opsFinalizadas: unwrapCount(opsFin, "OPs finalizadas"),
        totalNotasEntrada: unwrapCount(notasCount, "notas de entrada"),
        valorTotalNotas,
        totalFormulas: unwrapCount(formulas, "fórmulas"),
      };
    },
    staleTime: 60_000,
  });
}
