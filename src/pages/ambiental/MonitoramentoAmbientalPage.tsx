import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Thermometer, Droplets, Download, Printer, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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

type SensorReading = {
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

type Periodo = "hoje" | "7d" | "30d" | "3m";

const PERIODO_DIAS: Record<Periodo, number> = {
  hoje: 1,
  "7d": 7,
  "30d": 30,
  "3m": 90,
};

type Status = "CONFORME" | "ATENCAO" | "ALERTA";

function classify(
  value: number | null,
  min: number | null,
  max: number | null,
  buffer: number
): Status {
  if (value == null || min == null || max == null) return "CONFORME";
  if (value < min || value > max) return "ALERTA";
  if (value <= min + buffer || value >= max - buffer) return "ATENCAO";
  return "CONFORME";
}

function combineStatus(a: Status, b: Status): Status {
  if (a === "ALERTA" || b === "ALERTA") return "ALERTA";
  if (a === "ATENCAO" || b === "ATENCAO") return "ATENCAO";
  return "CONFORME";
}

function statusLabel(s: Status) {
  return s === "CONFORME" ? "Conforme" : s === "ATENCAO" ? "Atenção" : "Não Conforme";
}

function statusVariant(s: Status): "default" | "secondary" | "destructive" {
  return s === "CONFORME" ? "default" : s === "ATENCAO" ? "secondary" : "destructive";
}

function progressColor(s: Status) {
  if (s === "ALERTA") return "bg-destructive";
  if (s === "ATENCAO") return "bg-yellow-500";
  return "bg-green-500";
}

function progressPct(value: number | null, min: number | null, max: number | null) {
  if (value == null || min == null || max == null || max <= min) return 0;
  const pct = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, pct));
}

export default function MonitoramentoAmbientalPage() {
  const { data: companyId } = useUserCompanyId();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [salaFiltro, setSalaFiltro] = useState<string>("__all__");

  const sinceIso = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - PERIODO_DIAS[periodo]);
    return d.toISOString();
  }, [periodo]);

  const { data: readings = [], isLoading } = useQuery({
    queryKey: ["sensor_readings", companyId, sinceIso],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sensor_readings")
        .select("*")
        .eq("company_id", companyId!)
        .gte("recorded_at", sinceIso)
        .order("recorded_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as SensorReading[];
    },
  });

  const { data: rtNome } = useQuery({
    queryKey: ["rt-ativo-monitoramento"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("responsaveis_tecnicos")
        .select("nome_completo, nome, conselho, numero_registro")
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();
      if (!data) return null;
      const anyData = data as any;
      const nome = anyData.nome_completo ?? anyData.nome ?? "";
      const reg =
        anyData.conselho && anyData.numero_registro
          ? ` (${anyData.conselho} ${anyData.numero_registro})`
          : "";
      return `${nome}${reg}`;
    },
  });

  const salas = useMemo(() => {
    const set = new Set<string>();
    readings.forEach((r) => set.add(r.room_name));
    return Array.from(set).sort();
  }, [readings]);

  const filtered = useMemo(
    () =>
      salaFiltro === "__all__"
        ? readings
        : readings.filter((r) => r.room_name === salaFiltro),
    [readings, salaFiltro]
  );

  // Última leitura por sala para os cards
  const ultimasPorSala = useMemo(() => {
    const map = new Map<string, SensorReading>();
    for (const r of readings) {
      if (!map.has(r.room_name)) map.set(r.room_name, r);
    }
    return Array.from(map.values());
  }, [readings]);

  function exportCsv() {
    const headers = [
      "data_hora",
      "sala",
      "device_id",
      "temperatura",
      "umidade",
      "temp_min",
      "temp_max",
      "hum_min",
      "hum_max",
      "status",
      "responsavel",
    ];
    const rows = filtered.map((r) => {
      const st = combineStatus(
        classify(r.temperature, r.temp_min, r.temp_max, 1),
        classify(r.humidity, r.hum_min, r.hum_max, 3)
      );
      return [
        new Date(r.recorded_at).toLocaleString("pt-BR"),
        r.room_name,
        r.device_id,
        r.temperature ?? "",
        r.humidity ?? "",
        r.temp_min ?? "",
        r.temp_max ?? "",
        r.hum_min ?? "",
        r.hum_max ?? "",
        statusLabel(st),
        r.responsible ?? "",
      ];
    });
    const csv =
      "\uFEFF" +
      [headers, ...rows]
        .map((row) =>
          row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monitoramento-ambiental-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const rtTexto = `Responsável Técnico: ${
    rtNome ?? "Não cadastrado"
  } — RDC 658/2022 / POP-AMB-001`;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Monitoramento Ambiental"
        description="Leituras de temperatura e umidade conforme RDC 658/2022 — ANVISA"
        icon={Thermometer}
        actions={
          <div className="flex flex-wrap gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download className="w-4 h-4 mr-2" /> Exportar CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-2" /> Imprimir / PDF
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-3 print:hidden">
        <Select value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="7d">Últimos 7 dias</SelectItem>
            <SelectItem value="30d">Últimos 30 dias</SelectItem>
            <SelectItem value="3m">Últimos 3 meses</SelectItem>
          </SelectContent>
        </Select>

        <Select value={salaFiltro} onValueChange={setSalaFiltro}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Filtrar por sala" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as salas</SelectItem>
            {salas.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isLoading && readings.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          title="Sem leituras"
          description="Nenhuma leitura registrada. Configure a integração eWeLink via n8n para começar o monitoramento."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ultimasPorSala
              .filter(
                (r) => salaFiltro === "__all__" || r.room_name === salaFiltro
              )
              .map((r) => {
                const tempSt = classify(r.temperature, r.temp_min, r.temp_max, 1);
                const humSt = classify(r.humidity, r.hum_min, r.hum_max, 3);
                const overall = combineStatus(tempSt, humSt);
                return (
                  <Card key={r.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-base truncate">
                          {r.room_name}
                        </CardTitle>
                        <Badge variant={statusVariant(overall)}>
                          {statusLabel(overall)}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {r.device_id} ·{" "}
                        {new Date(r.recorded_at).toLocaleString("pt-BR")}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Thermometer className="w-4 h-4" /> Temperatura
                          </span>
                          <span className="font-medium">
                            {r.temperature != null ? `${r.temperature}°C` : "—"}
                          </span>
                        </div>
                        <Progress
                          value={progressPct(r.temperature, r.temp_min, r.temp_max)}
                          indicatorClassName={progressColor(tempSt)}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Limites: {r.temp_min ?? "—"}°C – {r.temp_max ?? "—"}°C
                        </p>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Droplets className="w-4 h-4" /> Umidade
                          </span>
                          <span className="font-medium">
                            {r.humidity != null ? `${r.humidity}%` : "—"}
                          </span>
                        </div>
                        <Progress
                          value={progressPct(r.humidity, r.hum_min, r.hum_max)}
                          indicatorClassName={progressColor(humSt)}
                        />
                        <p className="text-[11px] text-muted-foreground">
                          Limites: {r.hum_min ?? "—"}% – {r.hum_max ?? "—"}%
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Registros do período ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Sala</TableHead>
                    <TableHead>Device ID</TableHead>
                    <TableHead className="text-right">Temp.</TableHead>
                    <TableHead className="text-right">Umid.</TableHead>
                    <TableHead>Limites</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Responsável</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const st = combineStatus(
                      classify(r.temperature, r.temp_min, r.temp_max, 1),
                      classify(r.humidity, r.hum_min, r.hum_max, 3)
                    );
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">
                          {new Date(r.recorded_at).toLocaleString("pt-BR")}
                        </TableCell>
                        <TableCell>{r.room_name}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.device_id}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.temperature != null ? `${r.temperature}°C` : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {r.humidity != null ? `${r.humidity}%` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          T: {r.temp_min ?? "—"}–{r.temp_max ?? "—"}°C · U:{" "}
                          {r.hum_min ?? "—"}–{r.hum_max ?? "—"}%
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(st)}>
                            {statusLabel(st)}
                          </Badge>
                        </TableCell>
                        <TableCell>{r.responsible ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        className="text-center text-muted-foreground py-6"
                      >
                        Nenhum registro no período selecionado.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      <footer className="pt-4 border-t text-xs text-muted-foreground text-center">
        {rtTexto}
      </footer>
    </div>
  );
}