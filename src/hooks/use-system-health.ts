import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addDays, format } from "date-fns";

export type HealthStatus = "ok" | "warn" | "error";

export interface HealthCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  details: string;
  value?: string;
}

export interface SystemHealthReport {
  generatedAt: string;
  items: HealthCheckItem[];
}

async function checkHttp(label: string, url: string): Promise<HealthCheckItem> {
  const started = performance.now();
  try {
    const res = await fetch(url, { method: "GET" });
    const ms = Math.round(performance.now() - started);

    if (!res.ok) {
      return {
        id: `http:${label}`,
        label,
        status: "warn",
        details: `HTTP ${res.status} (${ms}ms)`,
      };
    }

    return {
      id: `http:${label}`,
      label,
      status: "ok",
      details: `OK (${ms}ms)`,
    };
  } catch (e: unknown) {
    const ms = Math.round(performance.now() - started);
    const msg = e instanceof Error ? e.message : "Falha";
    return {
      id: `http:${label}`,
      label,
      status: "error",
      details: `${msg} (${ms}ms)`,
    };
  }
}

async function countTable(table: "itens" | "entidades" | "notas_entrada" | "estoque_lotes" | "formulas") {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

async function countExpiringLots90d() {
  const today = new Date();
  const startIso = format(today, "yyyy-MM-dd");
  const endIso = format(addDays(today, 90), "yyyy-MM-dd");

  const { count, error } = await supabase
    .from("estoque_lotes")
    .select("id", { count: "exact", head: true })
    .gte("data_val", startIso)
    .lte("data_val", endIso)
    .neq("status", "VENCIDO");

  if (error) throw error;
  return count ?? 0;
}

export function useSystemHealth() {
  return useQuery<SystemHealthReport>({
    queryKey: ["system-health"],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const items: HealthCheckItem[] = [];

      const safe = async (
        id: string,
        label: string,
        fn: () => Promise<{ value?: string; details: string; status?: HealthStatus }>,
      ) => {
        try {
          const r = await fn();
          items.push({
            id,
            label,
            status: r.status ?? "ok",
            details: r.details,
            value: r.value,
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : "Erro";
          items.push({
            id,
            label,
            status: "error",
            details: msg,
          });
        }
      };

      await safe("db:itens", "Banco: Itens", async () => {
        const n = await countTable("itens");
        return { value: String(n), details: `${n} registro(s)` };
      });

      await safe("db:entidades", "Banco: Entidades", async () => {
        const n = await countTable("entidades");
        return { value: String(n), details: `${n} registro(s)` };
      });

      await safe("db:notas_entrada", "Banco: Notas de Entrada", async () => {
        const n = await countTable("notas_entrada");
        return { value: String(n), details: `${n} registro(s)` };
      });

      await safe("db:estoque_lotes", "Banco: Lotes", async () => {
        const n = await countTable("estoque_lotes");
        return { value: String(n), details: `${n} registro(s)` };
      });

      await safe("db:expiring90", "Dashboard: Lotes a vencer (≤90d)", async () => {
        const n = await countExpiringLots90d();
        return {
          value: String(n),
          details: `${n} lote(s) no período`,
          status: n > 0 ? "ok" : "warn",
        };
      });

      await safe("db:formulas", "Banco: Fórmulas", async () => {
        const n = await countTable("formulas");
        return { value: String(n), details: `${n} registro(s)` };
      });

      // Conectividade de APIs externas usadas no dashboard
      items.push(await checkHttp("API: Cotações (AwesomeAPI)", "https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL"));
      items.push(await checkHttp("API: Cripto (CoinGecko)", "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"));
      items.push(await checkHttp("API: Índice (brapi)", "https://brapi.dev/api/quote/%5EBVSP?token=demo"));

      return {
        generatedAt: new Date().toISOString(),
        items,
      };
    },
  });
}
