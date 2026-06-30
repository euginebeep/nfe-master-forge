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
    queryKey: ["sensor-readings", companyId, period, sessionStorage.getItem('brainx_demo_mode')],
    enabled: !!companyId || sessionStorage.getItem('brainx_demo_mode') === 'true',
    staleTime: 30_000,
    queryFn: async (): Promise<SensorReading[]> => {
      // Prioritiza o modo demo apenas se explicitamente solicitado ou se a empresa for a de demonstração
      const isExplicitDemo = sessionStorage.getItem('brainx_demo_mode') === 'true';
      const isDemoCompany = companyId === '00000000-0000-0000-0000-000000000001';
      
      // Removemos a verificação por hostname 'lovable' que forçava demo para usuários reais no preview
      const isDemoMode = isExplicitDemo || isDemoCompany;
      
      if (!companyId && !isDemoMode) return [];
      const hours = PERIODO_HORAS[period];
      const now = new Date();
      const since = new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
      
      // Se estiver em modo demo e não houver dados, simulamos leituras fictícias
      if (isDemoMode) {
        const demoReadings: SensorReading[] = [];
        const rooms = [
          { name: 'Almoxarifado MP', tmin: 15, tmax: 25, hmin: 30, hmax: 60 },
          { name: 'Sala de Pesagem', tmin: 18, tmax: 22, hmin: 35, hmax: 55 },
          { name: 'Produção Líquidos', tmin: 18, tmax: 24, hmin: 30, hmax: 60 },
          { name: 'Estoque PA', tmin: 15, tmax: 25, hmin: 30, hmax: 60 }
        ];

        // Gerar 24 leituras (uma por hora) para cada sala
        for (const room of rooms) {
          for (let i = 0; i < Math.min(hours, 24); i++) {
            const time = new Date(now.getTime() - i * 60 * 60 * 1000);
            demoReadings.push({
              id: `demo-${room.name}-${i}`,
              company_id: companyId,
              room_name: room.name,
              device_id: `SNSR-${room.name.substring(0,3).toUpperCase()}-01`,
              temperature: room.tmin + 2 + Math.random() * 3,
              humidity: room.hmin + 10 + Math.random() * 10,
              temp_min: room.tmin,
              temp_max: room.tmax,
              hum_min: room.hmin,
              hum_max: room.hmax,
              responsible: 'Monitoramento Automático',
              recorded_at: time.toISOString()
            });
          }
        }
        return demoReadings;
      }

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