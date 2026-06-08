import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Activity, Thermometer, Droplets, Clock } from "lucide-react";
import { type SensorReading, type StatusConformidade, calcStatus } from "@/hooks/use-sensor-readings";
import { ResponsiveContainer, ComposedChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, ReferenceLine } from "recharts";

interface SensorDrawerProps {
  reading: SensorReading | null;
  history: SensorReading[];
  onClose: () => void;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtHour(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function SensorDrawer({ reading, history, onClose }: SensorDrawerProps) {
  if (!reading) return null;

  const chartData = history
    .slice()
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map((r) => ({
      hora: fmtHour(r.recorded_at),
      temp: r.temperature,
      hum: r.humidity,
    }));

  const TEMP_MARGIN = 1.5;
  const HUM_MARGIN = 3;

  const tempStatus = calcStatus(reading.temperature, reading.temp_min, reading.temp_max, TEMP_MARGIN);
  const humStatus = calcStatus(reading.humidity, reading.hum_min, reading.hum_max, HUM_MARGIN);

  const getStatusBadge = (status: StatusConformidade) => {
    switch (status) {
      case "conforme":
        return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">CONFORME</Badge>;
      case "atencao":
        return <Badge className="bg-amber-100 text-amber-700 border-amber-200">ATENÇÃO</Badge>;
      case "nao_conforme":
        return <Badge className="bg-red-100 text-red-700 border-red-200">ALERTA</Badge>;
      default:
        return null;
    }
  };

  return (
    <Sheet open={!!reading} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="sm:max-w-xl w-full">
        <SheetHeader className="pb-4 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl font-bold">
            <Activity className="w-5 h-5 text-emerald-600" />
            {reading.room_name}
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">
            Device ID: {reading.device_id}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] pr-4 mt-4">
          <div className="space-y-6 pb-8">
            {/* Status Atual */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Thermometer className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Temperatura</span>
                </div>
                <div className="text-2xl font-black mb-1">
                  {reading.temperature?.toFixed(1)}°C
                </div>
                {getStatusBadge(tempStatus)}
                <div className="text-[10px] text-muted-foreground mt-2">
                  Faixa: {reading.temp_min}°C – {reading.temp_max}°C
                </div>
              </div>

              <div className="p-4 rounded-xl border bg-muted/30">
                <div className="flex items-center gap-2 mb-2">
                  <Droplets className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Umidade</span>
                </div>
                <div className="text-2xl font-black mb-1">
                  {reading.humidity?.toFixed(0)}%
                </div>
                {getStatusBadge(humStatus)}
                <div className="text-[10px] text-muted-foreground mt-2">
                  Faixa: {reading.hum_min}% – {reading.hum_max}%
                </div>
              </div>
            </div>

            {/* Gráfico */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">
                <Clock className="w-4 h-4" /> Tendência Histórica
              </h4>
              <div className="h-[200px] w-full border rounded-xl p-4 bg-card">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                    <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="hora" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="t" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ fontSize: 11, borderRadius: '8px' }} />
                    {reading.temp_max && <ReferenceLine yAxisId="t" y={reading.temp_max} stroke="#ef4444" strokeDasharray="3 3" opacity={0.3} />}
                    {reading.temp_min && <ReferenceLine yAxisId="t" y={reading.temp_min} stroke="#ef4444" strokeDasharray="3 3" opacity={0.3} />}
                    <Line yAxisId="t" type="monotone" dataKey="temp" stroke="#059669" strokeWidth={3} dot={false} animationDuration={1000} />
                    <Line yAxisId="t" type="monotone" dataKey="hum" stroke="#2563eb" strokeWidth={3} dot={false} animationDuration={1000} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Leituras Recentes */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold uppercase tracking-tight">Leituras Recentes</h4>
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="text-[10px] uppercase h-8">Hora</TableHead>
                      <TableHead className="text-[10px] uppercase h-8">Temp</TableHead>
                      <TableHead className="text-[10px] uppercase h-8">Umid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.slice(0, 10).map((r, i) => {
                      const st = calcStatus(r.temperature, r.temp_min, r.temp_max, TEMP_MARGIN);
                      return (
                        <TableRow key={i} className="h-10">
                          <TableCell className="text-[11px] font-mono">{fmtDate(r.recorded_at)}</TableCell>
                          <TableCell className={`text-[11px] font-bold ${st === 'nao_conforme' ? 'text-red-500' : ''}`}>
                            {r.temperature?.toFixed(1)}°C
                          </TableCell>
                          <TableCell className="text-[11px] font-medium">{r.humidity?.toFixed(0)}%</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
