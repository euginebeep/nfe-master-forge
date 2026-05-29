import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";

export type SensorReading = {
  id: string;
  company_id: string | null;
  room_name: string;
  device_id: string;
  temperature: number | null;
  humidity: number | null;
  temp_min: number | null;
  temp_max: number | null;
  hum_min: number | null;
  hum_max: number | null;
  responsible: string | null;
  recorded_at: string;
};

export type MonitoramentoPeriodo = "hoje" | "semana" | "mes" | "trimestre";

const PERIODO_HORAS: Record<MonitoramentoPeriodo, number> = {
  hoje: 24,
  semana: 24 * 7,
  mes: 24 * 30,
  trimestre: 24 * 90,
};

export function useMonitoramentoAmbiental(period: MonitoramentoPeriodo = "hoje") {
  const { data: companyId } = useUserCompanyId();

  const query = useQuery({
    queryKey: ["sensor-readings", companyId, period],
    enabled: !!companyId,
    staleTime: 30_000,
    queryFn: async (): Promise<SensorReading[]> => {
      if (!companyId) return [];
      const hours = PERIODO_HORAS[period];
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from("sensor_readings")
        .select("*")
        .eq("company_id", companyId)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as SensorReading[];
    },
  });

  return {
    readings: query.data || [],
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

export function getLatestByRoom(readings: SensorReading[]): Record<string, SensorReading> {
  const map: Record<string, SensorReading> = {};
  for (const r of readings) {
    const cur = map[r.room_name];
    if (!cur || new Date(r.recorded_at) > new Date(cur.recorded_at)) {
      map[r.room_name] = r;
    }
  }
  return map;
}

export type StatusConformidade = "conforme" | "atencao" | "nao_conforme";

export function calcStatus(
  value: number | null | undefined,
  min: number | null | undefined,
  max: number | null | undefined,
  margin: number,
): StatusConformidade {
  if (value == null || min == null || max == null) return "conforme";
  if (value < min || value > max) return "nao_conforme";
  if (value - min <= margin || max - value <= margin) return "atencao";
  return "conforme";
}

export function combineStatus(a: StatusConformidade, b: StatusConformidade): StatusConformidade {
  if (a === "nao_conforme" || b === "nao_conforme") return "nao_conforme";
  if (a === "atencao" || b === "atencao") return "atencao";
  return "conforme";
}