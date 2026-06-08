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
import { useAuth } from "@/hooks/use-auth";
import {
  useMonitoramentoAmbiental,
  getLatestByRoom,
  calcStatus,
  combineStatus,
  type SensorReading,
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
  selected,
  onClick,
}: {
  reading: SensorReading;
  selected: boolean;
  onClick: () => void;
}) {
  const st = readingStatus(reading);
  return (
    <button
      onClick={onClick}
      className={cn(
        "text-left bg-card rounded-lg border shadow-sm overflow-hidden transition-all hover:shadow-md",
        selected ? "border-emerald-500 ring-1 ring-emerald-500/30" : "border-border",
      )}
    >
      <div className="h-[3px]" style={{ background: STATUS_HEX[st.overall] }} />
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Factory className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-foreground">
            {reading.room_name}
          </span>
        </div>
        <Badge variant="outline" className={cn("text-[10px] font-bold", STATUS_BADGE_CLASS[st.overall])}>
          {STATUS_TEXT[st.overall]}
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
        <span className="font-mono text-[9px] text-muted-foreground truncate">{reading.device_id}</span>
        <span className="font-mono text-[9px] text-muted-foreground truncate ml-2">
          {reading.responsible || "—"}
        </span>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  HEATMAP                                                            */
/* ------------------------------------------------------------------ */
function Heatmap({ readings, rooms }: { readings: SensorReading[]; rooms: string[] }) {
  // last 12 hours buckets
  const now = new Date();
  const buckets: { label: string; start: Date }[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setMinutes(0, 0, 0);
    d.setHours(d.getHours() - i);
    buckets.push({ label: d.getHours().toString().padStart(2, "0") + "h", start: d });
  }

  function cellFor(room: string, bucketStart: Date) {
    const end = new Date(bucketStart);
    end.setHours(end.getHours() + 1);
    const inBucket = readings.filter(
      (r) =>
        r.room_name === room &&
        new Date(r.recorded_at) >= bucketStart &&
        new Date(r.recorded_at) < end,
    );
    if (inBucket.length === 0) return null;
    const avg = inBucket.reduce((s, r) => s + (r.temperature ?? 0), 0) / inBucket.length;
    const sample = inBucket[0];
    const st = calcStatus(avg, sample.temp_min, sample.temp_max, TEMP_MARGIN);
    const min = sample.temp_min ?? 15;
    const max = sample.temp_max ?? 25;
    const center = (min + max) / 2;
    const halfRange = (max - min) / 2 || 1;
    const distFromCenter = Math.abs(avg - center) / halfRange; // 0 center, 1 edge
    let bg = "";
    if (st === "conforme") {
      const intensity = 0.2 + (1 - Math.min(1, distFromCenter)) * 0.6;
      bg = `rgba(16,185,129,${intensity.toFixed(2)})`;
    } else if (st === "atencao") {
      bg = "rgba(245,158,11,0.6)";
    } else {
      bg = "rgba(220,38,38,0.7)";
    }
    return { avg, bg, label: `${room} ${fmtHour(bucketStart.toISOString())} — ${avg.toFixed(1)}°C` };
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
            <div key={room} className="flex items-center gap-1">
              <div className="w-[70px] text-[10px] font-medium truncate pr-1">{room}</div>
              {buckets.map((b) => {
                const cell = cellFor(room, b.start);
                return (
                  <div
                    key={b.label}
                    title={cell?.label || `${room} ${b.label} — sem dados`}
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
                 profile?.nome_completo?.toLowerCase().includes('demo');
  const [period, setPeriod] = useState<MonitoramentoPeriodo>("hoje");
  const [roomFilter, setRoomFilter] = useState<string>("all");
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [drawerRoom, setDrawerRoom] = useState<string | null>(null);

  const { readings, isLoading } = useMonitoramentoAmbiental(period);
  const navigate = useNavigate();
  const { data: companyId } = useUserCompanyId();

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

  const rooms = useMemo(() => {
    const set = new Set<string>();
    readings.forEach((r) => set.add(r.room_name));
    return Array.from(set).sort();
  }, [readings]);

  const filteredReadings = useMemo(
    () => (roomFilter === "all" ? readings : readings.filter((r) => r.room_name === roomFilter)),
    [readings, roomFilter],
  );

  const latestByRoom = useMemo(() => getLatestByRoom(readings), [readings]);
  const latestList = useMemo(
    () =>
      Object.values(latestByRoom).sort((a, b) => a.room_name.localeCompare(b.room_name)),
    [latestByRoom],
  );

  // Effective selected room
  const effectiveRoom = selectedRoom || latestList[0]?.room_name || null;

  // KPIs
  const kpis = useMemo(() => {
    if (filteredReadings.length === 0) {
      return { conformidade: 0, naoConf: 0, tempAvg: 0, humAvg: 0 };
    }
    let conf = 0;
    let naoConf = 0;
    let tempSum = 0;
    let humSum = 0;
    let tempN = 0;
    let humN = 0;
    for (const r of filteredReadings) {
      const st = readingStatus(r).overall;
      if (st === "conforme") conf++;
      if (st === "nao_conforme") naoConf++;
      if (r.temperature != null) {
        tempSum += r.temperature;
        tempN++;
      }
      if (r.humidity != null) {
        humSum += r.humidity;
        humN++;
      }
    }
    return {
      conformidade: (conf / filteredReadings.length) * 100,
      naoConf,
      tempAvg: tempN ? tempSum / tempN : 0,
      humAvg: humN ? humSum / humN : 0,
    };
  }, [filteredReadings]);

  // Chart data — last 24h for effectiveRoom
  const chartData = useMemo(() => {
    if (!effectiveRoom) return [];
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return readings
      .filter((r) => r.room_name === effectiveRoom && new Date(r.recorded_at).getTime() >= since)
      .slice()
      .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
      .map((r) => ({
        hora: fmtHour(r.recorded_at),
        temp: r.temperature,
        hum: r.humidity,
      }));
  }, [readings, effectiveRoom]);

  const selectedRoomLimits = useMemo(() => {
    if (!effectiveRoom) return null;
    return latestByRoom[effectiveRoom] || null;
  }, [latestByRoom, effectiveRoom]);

  // Non-conformities
  const naoConformidades = useMemo(() => {
    return filteredReadings
      .map((r) => {
        const st = readingStatus(r);
        const items: {
          r: SensorReading;
          tipo: "TEMPERATURA" | "UMIDADE";
          valor: number;
          limite: string;
          desvio: number;
          acao: string;
        }[] = [];
        if (st.temp === "nao_conforme" && r.temperature != null) {
          const tmin = r.temp_min ?? 0;
          const tmax = r.temp_max ?? 0;
          const high = r.temperature > tmax;
          items.push({
            r,
            tipo: "TEMPERATURA",
            valor: r.temperature,
            limite: `${tmin}–${tmax} °C`,
            desvio: high ? r.temperature - tmax : r.temperature - tmin,
            acao: high
              ? "Verificar HVAC · Abrir CAPA"
              : "Verificar aquecimento · Abrir CAPA",
          });
        }
        if (st.hum === "nao_conforme" && r.humidity != null) {
          const hmin = r.hum_min ?? 0;
          const hmax = r.hum_max ?? 0;
          const high = r.humidity > hmax;
          items.push({
            r,
            tipo: "UMIDADE",
            valor: r.humidity,
            limite: `${hmin}–${hmax} %`,
            desvio: high ? r.humidity - hmax : r.humidity - hmin,
            acao: high
              ? "Verificar desumidificador · Abrir CAPA"
              : "Verificar umidificador · Abrir CAPA",
          });
        }
        return items;
      })
      .flat();
  }, [filteredReadings]);

  /* ---------------- CSV ---------------- */
  function exportCSV() {
    const header = [
      "Data/Hora",
      "Sala",
      "Device ID",
      "Temperatura (°C)",
      "Umidade (%)",
      "Limite Temp Min",
      "Limite Temp Max",
      "Limite Umid Min",
      "Limite Umid Max",
      "Status",
      "Responsável Técnico",
      "Sistema",
      "Referência Normativa",
    ];
    const rtName = rt
      ? `${rt.nome} (${rt.tipo_conselho}-${rt.uf_registro} ${rt.numero_registro})`
      : "Não configurado";
    const rows = filteredReadings.map((r) => {
      const st = readingStatus(r).overall;
      return [
        fmtDate(r.recorded_at),
        r.room_name,
        r.device_id,
        r.temperature ?? "",
        r.humidity ?? "",
        r.temp_min ?? "",
        r.temp_max ?? "",
        r.hum_min ?? "",
        r.hum_max ?? "",
        STATUS_TEXT[st],
        rtName,
        "BrainX ERP",
        "RDC 658/2022 / POP-AMB-001",
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
  const isEmpty = !isLoading && readings.length === 0;
  const isCarregandoEstado = isLoading || isLoadingSensores;
  const semConfiguracao = !isCarregandoEstado && sensores.length === 0;
  const aguardandoLeituras = !isCarregandoEstado && sensores.length > 0 && readings.length === 0;

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
      <PageHeader
        icon={Factory}
        title="Monitoramento Ambiental"
        description="RDC 658/2022"
        actions={
          <>
            <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 gap-1.5 hover:bg-emerald-100">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600" />
              </span>
              Ao vivo
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
              <Select value={roomFilter} onValueChange={setRoomFilter}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Todas as salas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as salas</SelectItem>
                  {rooms.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
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
                  key={r.room_name}
                  reading={r}
                  selected={effectiveRoom === r.room_name}
                  onClick={() => {
                    setSelectedRoom(r.room_name);
                    setDrawerRoom(r.room_name);
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
                  <Heatmap readings={readings} rooms={rooms} />
                </CardContent>
              </Card>

              <Card className="flex-1">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center justify-between gap-2">
                    <span>{effectiveRoom || "—"} — Últimas 24h</span>
                    <div className="flex items-center gap-3 text-[10px] font-normal text-muted-foreground">
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
                      Sem dados nas últimas 24h para esta sala.
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
                            formatter={(value: any, name: string) =>
                              name === "temp" ? [`${value}°C`, "Temp"] : [`${value}%`, "Umid"]
                            }
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
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Sala</TableHead>
                        <TableHead>Parâmetro</TableHead>
                        <TableHead>Leitura</TableHead>
                        <TableHead>Limite violado</TableHead>
                        <TableHead>Desvio</TableHead>
                        <TableHead>Device ID</TableHead>
                        <TableHead>Ação sugerida</TableHead>
                        <TableHead>Responsável</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {naoConformidades.slice(0, 100).map((nc, i) => (
                        <TableRow key={`${nc.r.id}-${nc.tipo}-${i}`}>
                          <TableCell className="font-mono text-xs">{fmtDate(nc.r.recorded_at)}</TableCell>
                          <TableCell className="text-xs">{nc.r.room_name}</TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={
                                nc.tipo === "TEMPERATURA"
                                  ? "bg-orange-50 text-orange-700 border-orange-200"
                                  : "bg-blue-50 text-blue-700 border-blue-200"
                              }
                            >
                              {nc.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-red-600">
                            {nc.tipo === "TEMPERATURA" ? `${nc.valor.toFixed(1)}°C` : `${nc.valor}%`}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{nc.limite}</TableCell>
                          <TableCell className="font-mono text-xs text-red-600">
                            {nc.desvio > 0 ? "+" : ""}
                            {nc.desvio.toFixed(1)}
                            {nc.tipo === "TEMPERATURA" ? "°" : "%"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {nc.r.device_id}
                          </TableCell>
                          <TableCell className="text-xs">{nc.acao}</TableCell>
                          <TableCell className="text-xs">{nc.r.responsible || "—"}</TableCell>
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
                <span>Registros completos</span>
                <span className="text-xs font-normal text-muted-foreground">
                  {filteredReadings.length} registros
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Sala</TableHead>
                      <TableHead>Device ID</TableHead>
                      <TableHead>Temp °C</TableHead>
                      <TableHead>Umid %</TableHead>
                      <TableHead>Lim Temp</TableHead>
                      <TableHead>Lim Umid</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredReadings.slice(0, 100).map((r) => {
                      const st = readingStatus(r);
                      return (
                        <TableRow key={r.id}>
                          <TableCell className="font-mono text-xs">{fmtDate(r.recorded_at)}</TableCell>
                          <TableCell className="text-xs">{r.room_name}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.device_id}
                          </TableCell>
                          <TableCell className={cn("font-mono text-xs", STATUS_VALUE_CLASS[st.temp])}>
                            {r.temperature != null ? r.temperature.toFixed(1) : "—"}
                          </TableCell>
                          <TableCell className={cn("font-mono text-xs", STATUS_VALUE_CLASS[st.hum])}>
                            {r.humidity ?? "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.temp_min ?? "—"}–{r.temp_max ?? "—"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {r.hum_min ?? "—"}–{r.hum_max ?? "—"}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={STATUS_BADGE_CLASS[st.overall]}>
                              {st.overall === "conforme"
                                ? "Conforme"
                                : st.overall === "atencao"
                                  ? "Atenção"
                                  : "Não conforme"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs">{r.responsible || "—"}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredReadings.length > 100 && (
                <div className="text-xs text-muted-foreground text-center py-3 border-t">
                  Mostrando 100 de {filteredReadings.length} registros
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
        <span>Ref: RDC 658/2022 / POP-AMB-001</span>
        <span className="mx-1">|</span>
        <span>Registros mantidos por 5 anos conforme legislação vigente</span>
      </div>
      <SensorDrawer 
        reading={drawerRoom ? latestByRoom[drawerRoom] : null}
        history={drawerRoom ? readings.filter(r => r.room_name === drawerRoom) : []}
        onClose={() => setDrawerRoom(null)}
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
