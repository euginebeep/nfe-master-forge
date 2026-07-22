import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import {
  Thermometer,
  Droplets,
  Printer,
  FileSpreadsheet,
  Wifi,
  ShieldCheck,
  Factory,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Settings,
  Loader2,
} from "lucide-react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { useCompany } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import {
  useAmbientalTempoReal,
  useAmbientalHistorico,
  leituraTempoRealToSensorReading,
  pontoAgregadoToSensorReading,
  fmtAtualizadoHa,
  SEM_COMUNICACAO_SEGUNDOS,
  calcStatus,
  combineStatus,
  type SensorReading,
  type LeituraTempoReal,
  type PontoAgregado,
  type StatusConformidade,
  type MonitoramentoPeriodo,
} from "@/hooks/use-sensor-readings";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { SensorDrawer } from "@/components/ambiental/SensorDrawer";

const TEMP_MARGIN = 1.5;
const HUM_MARGIN = 3;
const TEMP_GAUGE_MAX = 40;
const HUM_GAUGE_MAX = 100;

const PERIOD_LABEL: Record<MonitoramentoPeriodo, string> = {
  hoje: "Hoje",
  semana: "7 dias",
  mes: "Mês",
  trimestre: "Trimestre",
};

const STATUS_HEX: Record<StatusConformidade, string> = {
  conforme: "#059669",
  atencao: "#f59e0b",
  nao_conforme: "#dc2626",
};

const STATUS_TEXT: Record<StatusConformidade, string> = {
  conforme: "NORMAL",
  atencao: "ATENÇÃO",
  nao_conforme: "ALERTA",
};

const STATUS_BADGE_CLASS: Record<StatusConformidade, string> = {
  conforme: "bg-emerald-100 text-emerald-700 border-emerald-200",
  atencao: "bg-amber-100 text-amber-700 border-amber-200",
  nao_conforme: "bg-red-100 text-red-700 border-red-200",
};

const STATUS_VALUE_CLASS: Record<StatusConformidade, string> = {
  conforme: "text-emerald-600",
  atencao: "text-amber-500",
  nao_conforme: "text-red-600",
};

const PERIOD_HOURS: Record<MonitoramentoPeriodo, number> = {
  hoje: 24,
  semana: 24 * 7,
  mes: 24 * 30,
  trimestre: 24 * 90,
};

function periodoWindow(period: MonitoramentoPeriodo) {
  const until = new Date();
  const since = new Date(until.getTime() - PERIOD_HOURS[period] * 3_600_000);
  return { since: since.toISOString(), until: until.toISOString() };
}

function aggregateStatus(p: PontoAgregado): StatusConformidade {
  return p.fora_da_faixa > 0 ? "nao_conforme" : "conforme";
}

function fmtNumber(value: number | null | undefined, digits = 1) {
  return value == null ? "—" : value.toFixed(digits);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function readingStatus(r: SensorReading): {
  temp: StatusConformidade;
  hum: StatusConformidade;
  overall: StatusConformidade;
} {
  const temp = calcStatus(r.temperature, r.temp_min, r.temp_max, TEMP_MARGIN);
  const hum = calcStatus(r.humidity, r.hum_min, r.hum_max, HUM_MARGIN);
  return { temp, hum, overall: combineStatus(temp, hum) };
}

/* ------------------------------------------------------------------ */
/*  SVG GAUGE                                                          */
/* ------------------------------------------------------------------ */
function Gauge({
  value,
  max,
  color,
}: {
  value: number | null;
  max: number;
  color: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  // semicircle from 180° to 360°, radius 35, center (40, 40)
  const R = 35;
  const CX = 40;
  const CY = 40;
  const startAngle = 180;
  const endAngle = 180 + 180 * pct;
  const polar = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return { x: CX + R * Math.cos(rad), y: CY + R * Math.sin(rad) };
  };
  const s = polar(startAngle);
  const e = polar(endAngle);
  const largeArc = pct > 0.5 ? 1 : 0;
  const fullEnd = polar(360);
  return (
    <svg viewBox="0 0 80 44" className="w-full h-9">
      <path
        d={`M ${s.x} ${s.y} A ${R} ${R} 0 1 1 ${fullEnd.x} ${fullEnd.y}`}
        fill="none"
        stroke="hsl(var(--muted))"
        strokeWidth={5}
        strokeLinecap="round"
      />
      {pct > 0 && (
        <path
          d={`M ${s.x} ${s.y} A ${R} ${R} 0 ${largeArc} 1 ${e.x} ${e.y}`}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  ROOM CARD                                                          */
/* ------------------------------------------------------------------ */
function RoomCard({
  reading,
  tempoReal,
  selected,
  onClick,
}: {
  reading: SensorReading;
  tempoReal: LeituraTempoReal;
  selected: boolean;
  onClick: () => void;
}) {
  const st = readingStatus(reading);
  const semComunicacao = tempoReal.segundos_atras > SEM_COMUNICACAO_SEGUNDOS;
  const destaque = semComunicacao || tempoReal.fora_da_faixa;
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left bg-card rounded-lg border shadow-sm overflow-hidden transition-all hover:shadow-md",
        selected ? "border-emerald-500 ring-1 ring-emerald-500/30" : "border-border",
        semComunicacao && "border-red-300 ring-1 ring-red-200",
        !semComunicacao && tempoReal.fora_da_faixa && "border-amber-300 ring-1 ring-amber-200",
      )}
    >
      <div className="h-[3px]" style={{ background: semComunicacao ? "#dc2626" : STATUS_HEX[st.overall] }} />
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            {reading.room_name}
          </span>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] font-bold",
            semComunicacao
              ? "bg-red-100 text-red-700 border-red-300"
              : destaque
                ? STATUS_BADGE_CLASS.nao_conforme
                : STATUS_BADGE_CLASS[st.overall],
          )}
        >
          {semComunicacao ? "SEM COMUNICAÇÃO" : destaque ? "FORA DA FAIXA" : STATUS_TEXT[st.overall]}
        </Badge>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border border-t border-border">
        {/* Temperature */}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Thermometer className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Temperatura</span>
          </div>
          <div className={cn("font-mono text-[19px] font-semibold leading-tight", STATUS_VALUE_CLASS[st.temp])}>
            {reading.temperature != null ? `${reading.temperature.toFixed(1)}°C` : "—"}
          </div>
          <Gauge value={reading.temperature} max={TEMP_GAUGE_MAX} color={STATUS_HEX[st.temp]} />
          <div className="font-mono text-[9px] text-muted-foreground mt-0.5">
            {reading.temp_min ?? "—"}–{reading.temp_max ?? "—"} °C
          </div>
        </div>
        {/* Humidity */}
        <div className="p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Droplets className="w-3 h-3 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Umidade</span>
          </div>
          <div className={cn("font-mono text-[19px] font-semibold leading-tight", STATUS_VALUE_CLASS[st.hum])}>
            {reading.humidity != null ? `${reading.humidity}%` : "—"}
          </div>
          <Gauge value={reading.humidity} max={HUM_GAUGE_MAX} color={STATUS_HEX[st.hum]} />
          <div className="font-mono text-[9px] text-muted-foreground mt-0.5">
            {reading.hum_min ?? "—"}–{reading.hum_max ?? "—"} %
          </div>
        </div>
      </div>
      <div className="px-4 py-2 border-t border-border flex items-center justify-between bg-muted/30">
        <div className="min-w-0">
          <span className="font-mono text-[9px] text-muted-foreground truncate block">{reading.device_id}</span>
          <span className={cn("text-[9px] font-medium", semComunicacao ? "text-red-600" : "text-muted-foreground")}>
            {fmtAtualizadoHa(tempoReal.segundos_atras)}
          </span>
        </div>
        <Link
          to={`/ambiental/sensor/${encodeURIComponent(reading.device_id)}`}
          onClick={e => e.stopPropagation()}
          className="font-mono text-[9px] text-primary underline hover:no-underline ml-2 shrink-0"
        >
          Ver relatório →
        </Link>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  HEATMAP                                                            */
/* ------------------------------------------------------------------ */
function Heatmap({ pontos, rooms }: { pontos: PontoAgregado[]; rooms: { deviceId: string; label: string }[] }) {
  // last 12 hours buckets
  const now = new Date();
  const buckets: { label: string; start: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - i);
    buckets.push({ label: d.getHours().toString().padStart(2, "0") + "h", start: d });
  }

  function cellFor(deviceId: string, bucketStart: Date) {
    const end = new Date(bucketStart);
    end.setHours(end.getHours() + 1);
    const inBucket = pontos.filter(
      (p) =>
        p.device_id === deviceId &&
        new Date(p.bucket) >= bucketStart &&
        new Date(p.bucket) < end,
    );
    if (inBucket.length === 0) return null;
    const tempPoints = inBucket.filter((p) => p.temp_avg != null);
    const totalLeituras = tempPoints.reduce((sum, p) => sum + Math.max(1, p.leituras || 0), 0);
    const avg = totalLeituras
      ? tempPoints.reduce((sum, p) => sum + (p.temp_avg ?? 0) * Math.max(1, p.leituras || 0), 0) / totalLeituras
      : null;
    const sample = inBucket[0];
    const st: StatusConformidade = inBucket.some((p) => p.fora_da_faixa > 0) ? "nao_conforme" : "conforme";
    const min = Math.min(...inBucket.map((p) => p.temp_min).filter((v): v is number => v != null));
    const max = Math.max(...inBucket.map((p) => p.temp_max).filter((v): v is number => v != null));
    const center = (min + max) / 2;
    const halfRange = (max - min) / 2 || 1;
    const distFromCenter = avg == null || !Number.isFinite(center) ? 0 : Math.abs(avg - center) / halfRange; // 0 center, 1 edge
    let bg = "";
    if (st === "conforme") {
      const intensity = 0.2 + (1 - Math.min(1, distFromCenter)) * 0.6;
      bg = `rgba(16,185,129,${intensity.toFixed(2)})`;
    } else if (st === "atencao") {
      bg = "rgba(245,158,11,0.6)";
    } else {
      bg = "rgba(220,38,38,0.7)";
    }
    return {
      avg,
      bg,
      label: `${sample.room_name ?? sample.device_id} ${fmtHour(bucketStart.toISOString())} — ${
        avg == null ? "sem média" : `${avg.toFixed(1)}°C`
      }`,
    };
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="flex items-center gap-1 pl-[70px] mb-1">
          {buckets.map((b) => (
            <div key={b.label} className="flex-1 text-center font-mono text-[9px] text-muted-foreground">
              {b.label}
            </div>
          ))}
        </div>
        <div className="space-y-1">
          {rooms.map((room) => (
            <div key={room.deviceId} className="flex items-center gap-1">
              <div className="w-[70px] text-[10px] font-medium truncate pr-1">{room.label}</div>
              {buckets.map((b) => {
                const cell = cellFor(room.deviceId, b.start);
                return (
                  <div
                    key={b.label}
                    title={cell?.label || `${room.label} ${b.label} — sem dados`}
                    className="flex-1 h-6 rounded-sm border border-border/40"
                    style={{ background: cell?.bg || "hsl(var(--muted))" }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function MonitoramentoAmbientalPage() {
  const { profile } = useAuth();
  const isDemo = profile?.is_demo || 
                 sessionStorage.getItem('brainx_demo_mode') === 'true' || 
                 profile?.company_id === '00000000-0000-0000-0000-000000000001';
  const [period, setPeriod] = useState<MonitoramentoPeriodo>("hoje");
  const [deviceFilter, setDeviceFilter] = useState<string>("all");
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [drawerDevice, setDrawerDevice] = useState<string | null>(null);

  const periodo = useMemo(() => periodoWindow(period), [period]);
  const {
    data: tempoReal = [],
    isLoading: isLoadingTempoReal,
  } = useAmbientalTempoReal();
  const {
    data: historico = [],
    isLoading: isLoadingHistorico,
  } = useAmbientalHistorico(periodo.since, periodo.until);
  const realtimeReadings = useMemo(
    () => tempoReal.map(leituraTempoRealToSensorReading),
    [tempoReal],
  );
  const navigate = useNavigate();
  const { data: companyId } = useUserCompanyId();
  const { data: company } = useCompany();
  const empresaNome = company?.nome_fantasia || company?.razao_social || "BrainX ERP";

  // Sensores configurados pelo tenant
  const { data: sensores = [], isLoading: isLoadingSensores } = useQuery({
    queryKey: ["ambiental-sensores-page", companyId, isDemo],
    enabled: !!companyId || isDemo,
    queryFn: async () => {
      if (isDemo) {
        return [
          { id: 'd1', device_id: 'SNSR-ALM-01', room_name: 'Almoxarifado MP', ativo: true },
          { id: 'd2', device_id: 'SNSR-PES-01', room_name: 'Sala de Pesagem', ativo: true },
          { id: 'd3', device_id: 'SNSR-PRO-01', room_name: 'Produção Líquidos', ativo: true },
          { id: 'd4', device_id: 'SNSR-EST-01', room_name: 'Estoque PA', ativo: true },
        ];
      }
      const { data, error } = await (supabase as any)
        .from("ambiental_sensores")
        .select("id, device_id, room_name, ativo")
        .eq("company_id", companyId)
        .eq("ativo", true);
      if (error) throw error;
      return (data || []) as Array<{ id: string; device_id: string; room_name: string; ativo: boolean }>;
    },
  });

  // RT
  const { data: rt } = useQuery({
    queryKey: ["rt-ativo-ambiental"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("responsaveis_tecnicos")
        .select("nome, tipo_conselho, numero_registro, uf_registro")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      return data as
        | { nome: string; tipo_conselho: string; numero_registro: string; uf_registro: string }
        | null;
    },
  });

  // Lista de devices p/ filtro e heatmap: chave estável (device_id), label = nome
  // mais recente conhecido (reflete renomeações feitas no ERP automaticamente)
  const deviceOptions = useMemo(() => {
    const map = new Map<string, { deviceId: string; label: string; lastSeen: number }>();
    for (const sensor of sensores) {
      map.set(sensor.device_id, { deviceId: sensor.device_id, label: sensor.room_name, lastSeen: 0 });
    }
    for (const r of tempoReal) {
      const t = new Date(r.recorded_at).getTime();
      const cur = map.get(r.device_id);
      if (!cur || t > cur.lastSeen) {
        map.set(r.device_id, { deviceId: r.device_id, label: r.room_name ?? r.device_id, lastSeen: t });
      }
    }
    for (const p of historico) {
      const t = new Date(p.bucket).getTime();
      const cur = map.get(p.device_id);
      if (!cur || t > cur.lastSeen) {
        map.set(p.device_id, { deviceId: p.device_id, label: p.room_name ?? p.device_id, lastSeen: t });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [sensores, tempoReal, historico]);

  const filteredHistorico = useMemo(
    () => (deviceFilter === "all" ? historico : historico.filter((p) => p.device_id === deviceFilter)),
    [historico, deviceFilter],
  );

  const latestByDevice = useMemo(() => {
    const map: Record<string, SensorReading> = {};
    for (const r of realtimeReadings) {
      map[r.device_id] = r;
    }
    return map;
  }, [realtimeReadings]);
  const tempoRealByDevice = useMemo(() => {
    const map = new Map<string, LeituraTempoReal>();
    for (const r of tempoReal) map.set(r.device_id, r);
    return map;
  }, [tempoReal]);
  const latestList = useMemo(
    () => realtimeReadings.slice().sort((a, b) => a.room_name.localeCompare(b.room_name)),
    [realtimeReadings],
  );

  // Effective selected device
  const effectiveDevice = selectedDevice || latestList[0]?.device_id || deviceOptions[0]?.deviceId || null;

  // KPIs
  const kpis = useMemo(() => {
    if (filteredHistorico.length === 0) {
      return { conformidade: 0, naoConf: 0, tempAvg: 0, humAvg: 0 };
    }
    let naoConf = 0;
    let tempSum = 0;
    let humSum = 0;
    let tempN = 0;
    let humN = 0;
    let total = 0;
    for (const p of filteredHistorico) {
      const peso = Math.max(1, p.leituras || 0);
      total += peso;
      naoConf += p.fora_da_faixa || 0;
      if (p.temp_avg != null) {
        tempSum += p.temp_avg * peso;
        tempN += peso;
      }
      if (p.hum_avg != null) {
        humSum += p.hum_avg * peso;
        humN += peso;
      }
    }
    return {
      conformidade: total ? Math.max(0, ((total - naoConf) / total) * 100) : 0,
      naoConf,
      tempAvg: tempN ? tempSum / tempN : 0,
      humAvg: humN ? humSum / humN : 0,
    };
  }, [filteredHistorico]);

  // Chart data — histórico agregado para o sensor selecionado
  const chartData = useMemo(() => {
    if (!effectiveDevice) return [];
    return historico
      .filter((p) => p.device_id === effectiveDevice)
      .slice()
      .sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime())
      .map((p) => ({
        hora: period === "hoje" ? fmtHour(p.bucket) : fmtDate(p.bucket),
        temp: p.temp_avg,
        tempRange: p.temp_min != null && p.temp_max != null ? [p.temp_min, p.temp_max] : null,
        hum: p.hum_avg,
        humRange: p.hum_min != null && p.hum_max != null ? [p.hum_min, p.hum_max] : null,
      }));
  }, [historico, effectiveDevice, period]);

  const selectedRoomLimits = useMemo(() => {
    if (!effectiveDevice) return null;
    const latestAggregate = historico
      .filter((p) => p.device_id === effectiveDevice)
      .slice()
      .sort((a, b) => new Date(b.bucket).getTime() - new Date(a.bucket).getTime())[0];
    return latestByDevice[effectiveDevice] || (latestAggregate ? pontoAgregadoToSensorReading(latestAggregate) : null);
  }, [latestByDevice, historico, effectiveDevice]);

  // Non-conformities
  const naoConformidades = useMemo(() => {
    return filteredHistorico
      .filter((p) => p.fora_da_faixa > 0)
      .slice()
      .sort((a, b) => new Date(b.bucket).getTime() - new Date(a.bucket).getTime());
  }, [filteredHistorico]);

  /* ---------------- CSV ---------------- */
  function exportCSV() {
    const header = [
      "Bucket",
      "Sala",
      "Device ID",
      "Temp Média (°C)",
      "Temp Mín (°C)",
      "Temp Máx (°C)",
      "Umid Média (%)",
      "Umid Mín (%)",
      "Umid Máx (%)",
      "Leituras",
      "Fora da Faixa",
      "Responsável Técnico",
      "Sistema",
      "Referência Normativa",
    ];
    const rtName = rt
      ? `${rt.nome} (${rt.tipo_conselho}-${rt.uf_registro} ${rt.numero_registro})`
      : "Não configurado";
    const rows = filteredHistorico.map((p) => {
      return [
        fmtDate(p.bucket),
        p.room_name ?? p.device_id,
        p.device_id,
        p.temp_avg ?? "",
        p.temp_min ?? "",
        p.temp_max ?? "",
        p.hum_avg ?? "",
        p.hum_min ?? "",
        p.hum_max ?? "",
        p.leituras,
        p.fora_da_faixa,
        rtName,
        empresaNome,
        "Monitoramento Ambiental agregado",
      ];
    });
    const csv =
      "\uFEFF" +
      [header, ...rows]
        .map((row) =>
          row
            .map((c) => {
              const s = String(c ?? "");
              return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
            })
            .join(";"),
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `controle_ambiental_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ---------------- EMPTY ---------------- */
  const isEmpty = !isLoadingTempoReal && !isLoadingHistorico && tempoReal.length === 0 && historico.length === 0;
  const isCarregandoEstado = isLoadingTempoReal || isLoadingHistorico || isLoadingSensores;
  const semConfiguracao = !isCarregandoEstado && sensores.length === 0 && !isDemo;
  const aguardandoLeituras = !isCarregandoEstado && sensores.length > 0 && tempoReal.length === 0 && historico.length === 0 && !isDemo;

  const sensoresOnline = useMemo(
    () => tempoReal.filter((r) => r.segundos_atras <= SEM_COMUNICACAO_SEGUNDOS).length,
    [tempoReal],
  );
  const sensoresSemComunicacao = tempoReal.length - sensoresOnline;
  const monitoramentoAoVivo = tempoReal.length > 0 && sensoresSemComunicacao === 0;
  const monitoramentoParcial = sensoresOnline > 0 && sensoresSemComunicacao > 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      <PageHeader
        icon={Factory}
        title="Monitoramento Ambiental"
        description="Controle de temperatura e umidade em tempo real"
        actions={
          <>
            <Badge
              className={cn(
                "gap-1.5",
                monitoramentoAoVivo
                  ? "bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : monitoramentoParcial
                    ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100"
                    : "bg-red-100 text-red-700 border-red-200 hover:bg-red-100",
              )}
              title={
                tempoReal.length === 0
                  ? "Sem leituras recentes"
                  : `${sensoresOnline} online · ${sensoresSemComunicacao} sem comunicação (>${SEM_COMUNICACAO_SEGUNDOS / 60} min)`
              }
            >
              <span className="relative flex h-2 w-2">
                {monitoramentoAoVivo && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex rounded-full h-2 w-2",
                    monitoramentoAoVivo
                      ? "bg-emerald-600"
                      : monitoramentoParcial
                        ? "bg-amber-500"
                        : "bg-red-600",
                  )}
                />
              </span>
              {monitoramentoAoVivo
                ? "Ao vivo"
                : monitoramentoParcial
                  ? `${sensoresOnline}/${tempoReal.length} online`
                  : tempoReal.length === 0
                    ? "Sem dados"
                    : "Sem comunicação"}
            </Badge>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!isDemo && isEmpty}>
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={() => window.print()}
              disabled={!isDemo && isEmpty}
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir / PDF
            </Button>
          </>
        }
      />

      {(semConfiguracao && !isDemo) ? (
        <Card className="border-amber-200">
          <CardContent className="py-6">
            <EmptyState
              icon={Settings}
              title="Módulo não configurado"
              description="Configure suas credenciais eWeLink e mapeie os sensores por sala antes de usar o monitoramento."
              actionLabel="Configurar agora →"
              onAction={() => navigate("/ambiental/configuracao")}
              className="[&_.rounded-full]:bg-amber-100 [&_svg]:text-amber-600"
            />
          </CardContent>
        </Card>
      ) : (aguardandoLeituras && !isDemo) ? (
        <Card className="border-blue-200">
          <CardContent className="py-6">
            <EmptyState
              icon={Wifi}
              title="Aguardando primeiras leituras"
              description={`${sensores.length} sensor(es) configurado(s). O sistema está coletando os dados — as leituras aparecerão automaticamente em até 60 segundos.`}
              className="[&_.rounded-full]:bg-blue-100 [&_svg]:text-blue-600"
            />
            <div className="flex justify-center mt-2">
              <Badge className="bg-blue-100 text-blue-700 border-blue-200 gap-1.5 hover:bg-blue-100">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600" />
                </span>
                Sincronizando...
              </Badge>
            </div>
          </CardContent>
        </Card>
      ) : isCarregandoEstado ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-sm text-muted-foreground italic">Carregando telemetria ambiental...</p>
        </div>
      ) : (
        <>
          {/* Period tabs + Room filter */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Tabs value={period} onValueChange={(v) => setPeriod(v as MonitoramentoPeriodo)}>
              <TabsList>
                {(Object.keys(PERIOD_LABEL) as MonitoramentoPeriodo[]).map((p) => (
                  <TabsTrigger key={p} value={p}>
                    {PERIOD_LABEL[p]}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            
            {!isDemo && (
              <Select value={deviceFilter} onValueChange={setDeviceFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todas as salas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as salas</SelectItem>
                  {deviceOptions.map((r) => (
                    <SelectItem key={r.deviceId} value={r.deviceId}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard
              icon={CheckCircle2}
              label="Conformidade"
              value={`${kpis.conformidade.toFixed(1)}%`}
              tone={
                kpis.conformidade >= 98
                  ? "emerald"
                  : kpis.conformidade >= 90
                    ? "amber"
                    : "red"
              }
            />
            <KpiCard
              icon={AlertTriangle}
              label="Não conformidades"
              value={kpis.naoConf.toString()}
              tone={kpis.naoConf > 0 ? "red" : "muted"}
            />
            <KpiCard
              icon={Thermometer}
              label="Temperatura média"
              value={`${kpis.tempAvg.toFixed(1)} °C`}
              tone="blue"
            />
            <KpiCard
              icon={Droplets}
              label="Umidade média"
              value={`${kpis.humAvg.toFixed(0)} %`}
              tone="blue"
            />
          </div>

          {/* Main grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {/* Room cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 content-start">
              {latestList.map((r) => (
                <RoomCard
                  key={r.device_id}
                  reading={r}
                  tempoReal={tempoRealByDevice.get(r.device_id)!}
                  selected={effectiveDevice === r.device_id}
                  onClick={() => {
                    setSelectedDevice(r.device_id);
                    setDrawerDevice(r.device_id);
                  }}
                />
              ))}
            </div>

            {/* Right column: heatmap + chart */}
            <div className="space-y-4 flex flex-col">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                    Heatmap de temperatura — últimas 12h por sala
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Heatmap pontos={historico} rooms={deviceOptions} />
                </CardContent>
              </Card>

              <Card className="flex-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span>{selectedRoomLimits?.room_name || "—"} — {PERIOD_LABEL[period]}</span>
                    <div className="flex items-center gap-3 text-[10px] font-normal text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-sm bg-emerald-200" /> Faixa temp
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-emerald-600" /> Temp °C
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-blue-600" /> Umid %
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {chartData.length === 0 ? (
                    <div className="text-xs text-muted-foreground py-6 text-center">
                      Sem dados no período para esta sala.
                    </div>
                  ) : (
                    <div style={{ width: "100%", height: 140 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                          <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                          <XAxis dataKey="hora" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="t" tick={{ fontSize: 10 }} width={28} />
                          <YAxis yAxisId="h" orientation="right" tick={{ fontSize: 10 }} width={28} />
                          <Tooltip
                            contentStyle={{ fontSize: 11 }}
                            formatter={(value: any, name: string) => {
                              if (Array.isArray(value)) {
                                const suffix = name === "tempRange" ? "°C" : "%";
                                return [`${value[0]}–${value[1]}${suffix}`, name === "tempRange" ? "Faixa temp" : "Faixa umid"];
                              }
                              return name === "temp" ? [`${value}°C`, "Temp média"] : [`${value}%`, "Umid média"];
                            }}
                          />
                          {selectedRoomLimits?.temp_max != null && (
                            <ReferenceLine
                              yAxisId="t"
                              y={selectedRoomLimits.temp_max}
                              stroke="#10b981"
                              strokeDasharray="4 4"
                              strokeOpacity={0.5}
                            />
                          )}
                          {selectedRoomLimits?.temp_min != null && (
                            <ReferenceLine
                              yAxisId="t"
                              y={selectedRoomLimits.temp_min}
                              stroke="#10b981"
                              strokeDasharray="4 4"
                              strokeOpacity={0.5}
                            />
                          )}
                          <Area
                            yAxisId="t"
                            type="monotone"
                            dataKey="tempRange"
                            stroke="none"
                            fill="#10b981"
                            fillOpacity={0.16}
                            dot={false}
                            activeDot={false}
                          />
                          <Area
                            yAxisId="h"
                            type="monotone"
                            dataKey="humRange"
                            stroke="none"
                            fill="#2563eb"
                            fillOpacity={0.08}
                            dot={false}
                            activeDot={false}
                          />
                          <Line
                            yAxisId="t"
                            type="monotone"
                            dataKey="temp"
                            stroke="#059669"
                            strokeWidth={2}
                            dot={false}
                          />
                          <Line
                            yAxisId="h"
                            type="monotone"
                            dataKey="hum"
                            stroke="#2563eb"
                            strokeWidth={2}
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Non-conformities */}
          <Card>
            <CardHeader className="bg-red-50 dark:bg-red-950/20 border-b border-red-100 dark:border-red-900/40 py-3">
              <CardTitle className="text-sm flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-red-700 dark:text-red-300">
                  <AlertTriangle className="w-4 h-4" />
                  Não conformidades no período
                </span>
                <Badge
                  className={cn(
                    "border",
                    naoConformidades.length === 0
                      ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                      : "bg-red-100 text-red-700 border-red-200",
                  )}
                >
                  {naoConformidades.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {naoConformidades.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Nenhuma não conformidade"
                  description="Período em conformidade total."
                />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bucket</TableHead>
                        <TableHead>Sala</TableHead>
                        <TableHead>Temp média</TableHead>
                        <TableHead>Faixa temp</TableHead>
                        <TableHead>Umid média</TableHead>
                        <TableHead>Faixa umid</TableHead>
                        <TableHead>Leituras</TableHead>
                        <TableHead>Fora da faixa</TableHead>
                        <TableHead>Device ID</TableHead>
                        <TableHead>Ação sugerida</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {naoConformidades.slice(0, 100).map((p) => (
                        <TableRow key={`${p.device_id}-${p.bucket}`}>
                          <TableCell className="font-mono text-xs">{fmtDate(p.bucket)}</TableCell>
                          <TableCell className="text-xs">{p.room_name ?? p.device_id}</TableCell>
                          <TableCell className="font-mono text-xs text-red-600">
                            {fmtNumber(p.temp_avg)}°C
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {fmtNumber(p.temp_min)}–{fmtNumber(p.temp_max)} °C
                          </TableCell>
                          <TableCell className="font-mono text-xs text-red-600">
                            {fmtNumber(p.hum_avg, 0)}%
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {fmtNumber(p.hum_min, 0)}–{fmtNumber(p.hum_max, 0)} %
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.leituras}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                              {p.fora_da_faixa}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{p.device_id}</TableCell>
                          <TableCell className="text-xs">Investigar excursão ambiental · Abrir CAPA</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Full table */}
          <Card>
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Histórico agregado</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {filteredHistorico.length} buckets
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Bucket</TableHead>
                      <TableHead>Sala</TableHead>
                      <TableHead>Device ID</TableHead>
                      <TableHead>Temp média</TableHead>
                      <TableHead>Faixa temp</TableHead>
                      <TableHead>Umid média</TableHead>
                      <TableHead>Faixa umid</TableHead>
                      <TableHead>Leituras</TableHead>
                      <TableHead>Fora da faixa</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHistorico.slice(0, 100).map((p) => {
                      const st = aggregateStatus(p);
                      return (
                        <TableRow key={`${p.device_id}-${p.bucket}`}>
                          <TableCell className="font-mono text-xs">{fmtDate(p.bucket)}</TableCell>
                          <TableCell className="text-xs">{p.room_name ?? p.device_id}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.device_id}
                          </TableCell>
                          <TableCell className={cn("font-mono text-xs", STATUS_VALUE_CLASS[st])}>
                            {fmtNumber(p.temp_avg)}°C
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {fmtNumber(p.temp_min)}–{fmtNumber(p.temp_max)} °C
                          </TableCell>
                          <TableCell className={cn("font-mono text-xs", STATUS_VALUE_CLASS[st])}>
                            {fmtNumber(p.hum_avg, 0)}%
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {fmtNumber(p.hum_min, 0)}–{fmtNumber(p.hum_max, 0)} %
                          </TableCell>
                          <TableCell className="font-mono text-xs">{p.leituras}</TableCell>
                          <TableCell className="font-mono text-xs">{p.fora_da_faixa}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_BADGE_CLASS[st]}>
                              {st === "conforme" ? "Conforme" : "Não conforme"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredHistorico.length > 100 && (
                <div className="text-xs text-muted-foreground text-center py-3 border-t">
                  Mostrando 100 de {filteredHistorico.length} buckets
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Footer ANVISA */}
      <div className="border-t pt-4 mt-4 flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>
          Responsável Técnico:{" "}
          {rt ? (
            `${rt.nome} · ${rt.tipo_conselho}-${rt.uf_registro} ${rt.numero_registro}`
          ) : (
            <>
              Não configurado —{" "}
              <Link
                to="/cadastros/responsaveis-tecnicos"
                className="text-primary underline hover:no-underline"
              >
                cadastre em Resp. Técnicos
              </Link>
            </>
          )}
        </span>
        <span className="mx-1">|</span>
        <span>Sistema: BrainX ERP</span>
        <span className="mx-1">|</span>
        <span>{empresaNome}</span>
        <span className="mx-1">|</span>
        <span>Registros mantidos por 5 anos conforme legislação vigente</span>
      </div>
      <SensorDrawer 
        reading={drawerDevice ? latestByDevice[drawerDevice] : null}
        history={
          drawerDevice
            ? historico
                .filter((p) => p.device_id === drawerDevice)
                .map(pontoAgregadoToSensorReading)
            : []
        }
        onClose={() => setDrawerDevice(null)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  KPI CARD                                                           */
/* ------------------------------------------------------------------ */
const TONE_CLASSES: Record<string, { bg: string; fg: string; val: string }> = {
  emerald: { bg: "bg-emerald-100", fg: "text-emerald-700", val: "text-emerald-600" },
  amber: { bg: "bg-amber-100", fg: "text-amber-700", val: "text-amber-600" },
  red: { bg: "bg-red-100", fg: "text-red-700", val: "text-red-600" },
  blue: { bg: "bg-blue-100", fg: "text-blue-700", val: "text-blue-600" },
  muted: { bg: "bg-muted", fg: "text-muted-foreground", val: "text-foreground" },
};

function KpiCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: any;
  label: string;
  value: string;
  tone: keyof typeof TONE_CLASSES;
}) {
  const t = TONE_CLASSES[tone];
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", t.bg)}>
          <Icon className={cn("w-5 h-5", t.fg)} />
        </div>
        <div className="min-w-0">
          <div className={cn("text-xl font-semibold leading-tight font-mono", t.val)}>{value}</div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">{label}</div>
        </div>
      </CardContent>
    </Card>
  );
}
