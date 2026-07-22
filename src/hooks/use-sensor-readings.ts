import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
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

export const SEM_COMUNICACAO_SEGUNDOS = 30 * 60;

export interface LeituraTempoReal {
  device_id: string;
  room_name: string | null;
  temperature: number | null;
  humidity: number | null;
  temp_min: number | null;
  temp_max: number | null;
  hum_min: number | null;
  hum_max: number | null;
  recorded_at: string;
  segundos_atras: number;
  fora_da_faixa: boolean;
}

export interface PontoAgregado {
  bucket: string;
  device_id: string;
  room_name: string | null;
  temp_min: number | null;
  temp_max: number | null;
  temp_avg: number | null;
  hum_min: number | null;
  hum_max: number | null;
  hum_avg: number | null;
  leituras: number;
  fora_da_faixa: number;
}

const DEMO_COMPANY_ID = "00000000-0000-0000-0000-000000000001";
const DEMO_ROOMS = [
  { name: "Almoxarifado MP", deviceId: "SNSR-ALM-01", tmin: 15, tmax: 25, hmin: 30, hmax: 60 },
  { name: "Sala de Pesagem", deviceId: "SNSR-PES-01", tmin: 18, tmax: 22, hmin: 35, hmax: 55 },
  { name: "Produção Líquidos", deviceId: "SNSR-PRO-01", tmin: 18, tmax: 24, hmin: 30, hmax: 60 },
  { name: "Estoque PA", deviceId: "SNSR-EST-01", tmin: 15, tmax: 25, hmin: 30, hmax: 60 },
];

function isExplicitDemoMode() {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem("brainx_demo_mode") === "true";
}

function isDemoMode(companyId?: string | null) {
  return isExplicitDemoMode() || companyId === DEMO_COMPANY_ID;
}

function rounded(value: number, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function demoTempoReal(companyId?: string | null): LeituraTempoReal[] {
  const now = Date.now();
  return DEMO_ROOMS.map((room, index) => {
    const segundosAtras = [75, 240, 920, 2_100][index] ?? 120;
    const wave = Math.sin((now / 3_600_000) + index);
    const temperature = rounded((room.tmin + room.tmax) / 2 + wave * 1.8);
    const humidity = rounded((room.hmin + room.hmax) / 2 + Math.cos((now / 4_200_000) + index) * 6, 0);
    return {
      device_id: room.deviceId,
      room_name: room.name,
      temperature,
      humidity,
      temp_min: room.tmin,
      temp_max: room.tmax,
      hum_min: room.hmin,
      hum_max: room.hmax,
      recorded_at: new Date(now - segundosAtras * 1000).toISOString(),
      segundos_atras: segundosAtras,
      fora_da_faixa:
        temperature < room.tmin ||
        temperature > room.tmax ||
        humidity < room.hmin ||
        humidity > room.hmax ||
        (companyId === DEMO_COMPANY_ID && index === 2),
    };
  });
}

function demoHistorico(since: string, until: string, deviceId?: string | null): PontoAgregado[] {
  const start = new Date(since).getTime();
  const end = new Date(until).getTime();
  const bucket = baldePorJanela(new Date(since), new Date(until));
  const stepMs = bucket === "minute" ? 5 * 60_000 : bucket === "hour" ? 60 * 60_000 : 24 * 60 * 60_000;
  const rooms = DEMO_ROOMS.filter((room) => !deviceId || room.deviceId === deviceId);
  const points: PontoAgregado[] = [];

  for (const room of rooms) {
    for (let t = start; t <= end; t += stepMs) {
      const hour = t / 3_600_000;
      const wave = Math.sin(hour / 3 + room.deviceId.length);
      const tempAvg = rounded((room.tmin + room.tmax) / 2 + wave * 2);
      const humAvg = rounded((room.hmin + room.hmax) / 2 + Math.cos(hour / 4 + room.deviceId.length) * 7, 0);
      const tempMin = rounded(tempAvg - 0.8);
      const tempMax = rounded(tempAvg + 0.9);
      const humMin = rounded(humAvg - 3, 0);
      const humMax = rounded(humAvg + 3, 0);
      const fora =
        tempMin < room.tmin ||
        tempMax > room.tmax ||
        humMin < room.hmin ||
        humMax > room.hmax
          ? 1
          : 0;
      points.push({
        bucket: new Date(t).toISOString(),
        device_id: room.deviceId,
        room_name: room.name,
        temp_min: tempMin,
        temp_max: tempMax,
        temp_avg: tempAvg,
        hum_min: humMin,
        hum_max: humMax,
        hum_avg: humAvg,
        leituras: bucket === "minute" ? 5 : bucket === "hour" ? 60 : 24 * 60,
        fora_da_faixa: fora,
      });
    }
  }

  return points.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime());
}

export function fmtAtualizadoHa(segundos: number): string {
  if (segundos < 60) return "atualizado agora";
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `atualizado há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `atualizado há ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `atualizado há ${dias} d`;
}

export function leituraTempoRealToSensorReading(l: LeituraTempoReal): SensorReading {
  return {
    id: `tempo-real-${l.device_id}`,
    company_id: null,
    room_name: l.room_name ?? l.device_id,
    device_id: l.device_id,
    temperature: l.temperature,
    humidity: l.humidity,
    temp_min: l.temp_min,
    temp_max: l.temp_max,
    hum_min: l.hum_min,
    hum_max: l.hum_max,
    responsible: "Monitoramento Automático",
    recorded_at: l.recorded_at,
  };
}

export function pontoAgregadoToSensorReading(p: PontoAgregado): SensorReading {
  return {
    id: `agregado-${p.device_id}-${p.bucket}`,
    company_id: null,
    room_name: p.room_name ?? p.device_id,
    device_id: p.device_id,
    temperature: p.temp_avg,
    humidity: p.hum_avg,
    temp_min: p.temp_min,
    temp_max: p.temp_max,
    hum_min: p.hum_min,
    hum_max: p.hum_max,
    responsible: "Monitoramento Automático",
    recorded_at: p.bucket,
  };
}

export function baldePorJanela(since: Date, until: Date): "minute" | "hour" | "day" {
  const horas = (until.getTime() - since.getTime()) / 3_600_000;
  if (horas <= 6) return "minute";
  if (horas <= 24 * 30) return "hour";
  return "day";
}

export function useAmbientalTempoReal() {
  const { data: companyId } = useUserCompanyId();
  const demoMode = isDemoMode(companyId);

  return useQuery({
    queryKey: ["ambiental-tempo-real", demoMode, companyId],
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async (): Promise<LeituraTempoReal[]> => {
      if (demoMode) return demoTempoReal(companyId);
      const { data, error } = await (supabase as any).rpc("ambiental_tempo_real");
      if (error) throw error;
      return (data ?? []) as LeituraTempoReal[];
    },
  });
}

export function useAmbientalHistorico(
  since: string,
  until: string,
  deviceId?: string | null
) {
  const { data: companyId } = useUserCompanyId();
  const demoMode = isDemoMode(companyId);

  return useQuery({
    queryKey: ["ambiental-historico", since, until, deviceId, demoMode, companyId],
    staleTime: 60_000,
    enabled: !!since && !!until,
    queryFn: async (): Promise<PontoAgregado[]> => {
      if (demoMode) return demoHistorico(since, until, deviceId);
      const { data, error } = await (supabase as any).rpc("ambiental_historico_agregado", {
        p_since: since,
        p_until: until,
        p_bucket: baldePorJanela(new Date(since), new Date(until)),
        p_device_id: deviceId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as PontoAgregado[];
    },
  });
}

export function useMonitoramentoAmbiental(period: MonitoramentoPeriodo = "hoje") {
  const { since, until } = useMemo(() => {
    const now = new Date();
    return {
      since: new Date(now.getTime() - PERIODO_HORAS[period] * 3_600_000).toISOString(),
      until: now.toISOString(),
    };
  }, [period]);
  const query = useAmbientalHistorico(since, until);

  return {
    readings: (query.data || []).map(pontoAgregadoToSensorReading),
    isLoading: query.isLoading,
    error: query.error as Error | null,
  };
}

// Agrupa pela identidade ESTÁVEL do sensor (device_id), nunca pelo room_name.
// room_name em sensor_readings é um snapshot do nome no momento da leitura;
// se a sala for renomeada no ERP, leituras antigas e novas teriam nomes
// diferentes e o mesmo sensor apareceria duplicado no dashboard.
export function getLatestByDevice(readings: SensorReading[]): Record<string, SensorReading> {
  const map: Record<string, SensorReading> = {};
  for (const r of readings) {
    const cur = map[r.device_id];
    if (!cur || new Date(r.recorded_at) > new Date(cur.recorded_at)) {
      map[r.device_id] = r;
    }
  }
  return map;
}

/** @deprecated Use getLatestByDevice — agrupar por room_name duplica sensores quando a sala é renomeada. */
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