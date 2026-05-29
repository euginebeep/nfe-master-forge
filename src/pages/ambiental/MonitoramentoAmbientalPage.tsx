import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Thermometer,
  Droplets,
  Printer,
  Download,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

// === Limites default conforme RDC 658/2022 ===
const DEFAULT_LIMITS = {
  temp_min: 15,
  temp_max: 25,
  hum_min: 40,
  hum_max: 65,
};

interface SensorReading {
  id: string;
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
}

type Status = "CONFORME" | "ATENCAO" | "ALERTA";

function classify(
  temp: number | null,
  hum: number | null,
  tmin: number,
  tmax: number,
  hmin: number,
  hmax: number
): Status {
  if (temp == null || hum == null) return "ATENCAO";
  const tempOut = temp < tmin || temp > tmax;
  const humOut = hum < hmin || hum > hmax;
  const tempNear = Math.abs(temp - tmin) <= 1 || Math.abs(temp - tmax) <= 1;
  const humNear = Math.abs(hum - hmin) <= 3 || Math.abs(hum - hmax) <= 3;
  if (tempOut || humOut) return "ALERTA";
  if (tempNear || humNear) return "ATENCAO";
  return "CONFORME";
}

const STATUS_META: Record<
  Status,
  { label: string; cls: string; Icon: typeof CheckCircle2 }
> = {
  CONFORME: {
    label: "Conforme",
    cls: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    Icon: CheckCircle2,
  },
  ATENCAO: {
    label: "Atenção",
    cls: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    Icon: AlertTriangle,
  },
  ALERTA: {
    label: "Alerta",
    cls: "bg-destructive/10 text-destructive border-destructive/30",
    Icon: AlertCircle,
  },
};

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function MonitoramentoAmbientalPage() {
  const [readings, setReadings] = useState<SensorReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<string>("ALL");
  const [hours, setHours] = useState<number>(24);
  const [rtName, setRtName] = useState<string>("—");
  const [customLimits, setCustomLimits] = useState<
    Record<string, { temp_min: number; temp_max: number; hum_min: number; hum_max: number }>
  >({});

  // === Fetch readings (RLS filtra company_id) ===
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const since = new Date(Date.now() - hours * 3600 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sensor_readings" as any)
        .select("*")
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: false })
        .limit(2000);
      if (!active) return;
      if (error) {
        toast.error("Erro ao carregar leituras: " + error.message);
        setReadings([]);
      } else {
        setReadings((data || []) as unknown as SensorReading[]);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [hours]);

  // === Fetch RT ===
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("responsaveis_tecnicos")
        .select("nome_completo, tipo_conselho, numero_conselho, uf_conselho")
        .eq("status", "ATIVO")
        .limit(1)
        .maybeSingle();
      if (data) {
        setRtName(
          `${data.nome_completo} — ${data.tipo_conselho} ${data.numero_conselho}/${data.uf_conselho}`
        );
      }
    })();
  }, []);

  // === Agregação por sala (última leitura) ===
  const rooms = useMemo(() => {
    const map = new Map<string, SensorReading>();
    for (const r of readings) {
      if (!map.has(r.room_name)) map.set(r.room_name, r);
    }
    return Array.from(map.entries()).map(([name, last]) => {
      const limits = customLimits[name] || {
        temp_min: last.temp_min ?? DEFAULT_LIMITS.temp_min,
        temp_max: last.temp_max ?? DEFAULT_LIMITS.temp_max,
        hum_min: last.hum_min ?? DEFAULT_LIMITS.hum_min,
        hum_max: last.hum_max ?? DEFAULT_LIMITS.hum_max,
      };
      const status = classify(
        last.temperature,
        last.humidity,
        limits.temp_min,
        limits.temp_max,
        limits.hum_min,
        limits.hum_max
      );
      return { name, last, limits, status };
    });
  }, [readings, customLimits]);

  const roomNames = useMemo(() => rooms.map((r) => r.name), [rooms]);

  // === Série para gráfico ===
  const chartData = useMemo(() => {
    const filter =
      selectedRoom === "ALL"
        ? readings
        : readings.filter((r) => r.room_name === selectedRoom);
    return [...filter]
      .sort((a, b) => +new Date(a.recorded_at) - +new Date(b.recorded_at))
      .map((r) => ({
        time: new Date(r.recorded_at).toLocaleTimeString("pt-BR", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        temperatura: r.temperature,
        umidade: r.humidity,
      }));
  }, [readings, selectedRoom]);

  // === Exportar CSV ===
  function exportCsv() {
    if (readings.length === 0) {
      toast.warning("Não há leituras para exportar.");
      return;
    }
    const header = [
      "data_hora",
      "sala",
      "device_id",
      "temperatura_c",
      "umidade_pct",
      "temp_min",
      "temp_max",
      "hum_min",
      "hum_max",
      "status",
      "responsavel",
    ];
    const rowsCsv = readings.map((r) => {
      const lim = customLimits[r.room_name] || {
        temp_min: r.temp_min ?? DEFAULT_LIMITS.temp_min,
        temp_max: r.temp_max ?? DEFAULT_LIMITS.temp_max,
        hum_min: r.hum_min ?? DEFAULT_LIMITS.hum_min,
        hum_max: r.hum_max ?? DEFAULT_LIMITS.hum_max,
      };
      const st = classify(
        r.temperature,
        r.humidity,
        lim.temp_min,
        lim.temp_max,
        lim.hum_min,
        lim.hum_max
      );
      return [
        fmtDateTime(r.recorded_at),
        r.room_name,
        r.device_id,
        r.temperature ?? "",
        r.humidity ?? "",
        lim.temp_min,
        lim.temp_max,
        lim.hum_min,
        lim.hum_max,
        st,
        r.responsible ?? "",
      ];
    });
    const csv = [header, ...rowsCsv]
      .map((row) =>
        row
          .map((v) => {
            const s = String(v).replace(/"/g, '""');
            return /[,;"\n]/.test(s) ? `"${s}"` : s;
          })
          .join(";")
      )
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoramento-ambiental-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  }

  function updateLimit(
    name: string,
    field: "temp_min" | "temp_max" | "hum_min" | "hum_max",
    value: number
  ) {
    setCustomLimits((prev) => {
      const cur =
        prev[name] || {
          temp_min: DEFAULT_LIMITS.temp_min,
          temp_max: DEFAULT_LIMITS.temp_max,
          hum_min: DEFAULT_LIMITS.hum_min,
          hum_max: DEFAULT_LIMITS.hum_max,
        };
      return { ...prev, [name]: { ...cur, [field]: value } };
    });
  }

  return (
    <div className="p-6 space-y-6 print:p-2">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Thermometer className="w-6 h-6 text-primary" />
            Monitoramento Ambiental
          </h1>
          <p className="text-sm text-muted-foreground">
            Conforme RDC 658/2022 — Boas Práticas de Fabricação ANVISA
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={selectedRoom} onValueChange={setSelectedRoom}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Sala" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas as salas</SelectItem>
              {roomNames.map((n) => (
                <SelectItem key={n} value={n}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(hours)} onValueChange={(v) => setHours(Number(v))}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Últimas 6h</SelectItem>
              <SelectItem value="24">Últimas 24h</SelectItem>
              <SelectItem value="72">Últimos 3 dias</SelectItem>
              <SelectItem value="168">Última semana</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
          <Button onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" />
            Imprimir relatório
          </Button>
        </div>
      </div>

      {/* Cabeçalho de impressão */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Relatório de Monitoramento Ambiental — ANVISA</h1>
        <p className="text-xs text-muted-foreground">
          RDC 658/2022 • Emitido em {new Date().toLocaleString("pt-BR")}
        </p>
      </div>

      {/* Cards por sala */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando leituras…</p>
      ) : rooms.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma leitura registrada no período selecionado.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map(({ name, last, limits, status }) => {
            const meta = STATUS_META[status];
            return (
              <Card key={name} className="border-l-4" style={{ borderLeftColor: status === "ALERTA" ? "hsl(var(--destructive))" : status === "ATENCAO" ? "hsl(45 95% 50%)" : "hsl(150 65% 40%)" }}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{name}</CardTitle>
                    <Badge variant="outline" className={meta.cls}>
                      <meta.Icon className="w-3 h-3 mr-1" />
                      {meta.label}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Device: {last.device_id} • {fmtDateTime(last.recorded_at)}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-5 h-5 text-orange-500" />
                      <div>
                        <div className="text-2xl font-bold leading-none">
                          {last.temperature?.toFixed(1) ?? "—"}°C
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {limits.temp_min}–{limits.temp_max}°C
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Droplets className="w-5 h-5 text-blue-500" />
                      <div>
                        <div className="text-2xl font-bold leading-none">
                          {last.humidity ?? "—"}%
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {limits.hum_min}–{limits.hum_max}% UR
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Limites configuráveis */}
                  <div className="grid grid-cols-4 gap-2 print:hidden">
                    <div>
                      <Label className="text-[10px]">T min</Label>
                      <Input
                        type="number"
                        step="0.1"
                        className="h-7 text-xs"
                        value={limits.temp_min}
                        onChange={(e) => updateLimit(name, "temp_min", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">T max</Label>
                      <Input
                        type="number"
                        step="0.1"
                        className="h-7 text-xs"
                        value={limits.temp_max}
                        onChange={(e) => updateLimit(name, "temp_max", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">UR min</Label>
                      <Input
                        type="number"
                        className="h-7 text-xs"
                        value={limits.hum_min}
                        onChange={(e) => updateLimit(name, "hum_min", Number(e.target.value))}
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">UR max</Label>
                      <Input
                        type="number"
                        className="h-7 text-xs"
                        value={limits.hum_max}
                        onChange={(e) => updateLimit(name, "hum_max", Number(e.target.value))}
                      />
                    </div>
                  </div>

                  {last.responsible && (
                    <p className="text-[11px] text-muted-foreground">
                      Responsável: {last.responsible}
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Gráfico */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Evolução —{" "}
            {selectedRoom === "ALL" ? "Todas as salas (combinado)" : selectedRoom} • últimas{" "}
            {hours}h
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[340px]">
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem dados no período.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="temperatura"
                  name="Temp (°C)"
                  stroke="#f97316"
                  dot={false}
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="umidade"
                  name="UR (%)"
                  stroke="#3b82f6"
                  dot={false}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Rodapé com RT */}
      <footer className="border-t pt-4 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <span>
          Responsável Técnico: <span className="font-semibold text-foreground">{rtName}</span>
        </span>
        <span>BrainX ERP • RDC 658/2022 ANVISA</span>
      </footer>
    </div>
  );
}