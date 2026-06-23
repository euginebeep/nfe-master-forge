// ============================================================
// BRAINX ERP — DETALHE DO SENSOR AMBIENTAL
// Relatório completo: Hoje / 7 dias / 15 dias / Personalizado
// Exportação PDF A4 com cabeçalho e rodapé padrão BrainX
// ============================================================
import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Printer, Download, Calendar, Thermometer,
  Droplets, ShieldCheck, AlertTriangle, CheckCircle2,
  Factory, RefreshCw,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { useCompany } from "@/hooks/use-company";
import {
  calcStatus, combineStatus,
  type SensorReading, type StatusConformidade,
} from "@/hooks/use-sensor-readings";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

// ─── Constantes ──────────────────────────────────────────────
const TEMP_MARGIN = 1.5;
const HUM_MARGIN  = 3;

const STATUS_HEX: Record<StatusConformidade, string> = {
  conforme:     "#059669",
  atencao:      "#f59e0b",
  nao_conforme: "#dc2626",
};
const STATUS_LABEL: Record<StatusConformidade, string> = {
  conforme:     "Conforme",
  atencao:      "Atenção",
  nao_conforme: "Não conforme",
};
const STATUS_BADGE: Record<StatusConformidade, string> = {
  conforme:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  atencao:      "bg-amber-100 text-amber-700 border-amber-200",
  nao_conforme: "bg-red-100 text-red-700 border-red-200",
};

type Periodo = "hoje" | "7dias" | "15dias" | "personalizado";
const PERIODO_HORAS: Record<Exclude<Periodo, "personalizado">, number> = {
  hoje:   24,
  "7dias":  24 * 7,
  "15dias": 24 * 15,
};
const PERIODO_LABEL: Record<Periodo, string> = {
  hoje:         "Hoje",
  "7dias":      "7 dias",
  "15dias":     "15 dias",
  personalizado: "Personalizado",
};

// ─── Helpers ─────────────────────────────────────────────────
function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateShort(iso: string) {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}
function fmtDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function readingStatus(r: SensorReading) {
  const temp = calcStatus(r.temperature, r.temp_min, r.temp_max, TEMP_MARGIN);
  const hum  = calcStatus(r.humidity,    r.hum_min,  r.hum_max,  HUM_MARGIN);
  return { temp, hum, overall: combineStatus(temp, hum) };
}

// ─── Hook de dados ────────────────────────────────────────────
function useSensorDetail(
  deviceId: string | undefined,
  since: string,
  until: string,
) {
  const { data: companyId } = useUserCompanyId();
  return useQuery({
    queryKey: ["sensor-detail", companyId, deviceId, since, until],
    enabled: !!companyId && !!deviceId,
    staleTime: 30_000,
    queryFn: async (): Promise<SensorReading[]> => {
      const { data, error } = await (supabase as any)
        .from("sensor_readings")
        .select("*")
        .eq("company_id", companyId)
        .eq("device_id", deviceId)
        .gte("recorded_at", since)
        .lte("recorded_at", until)
        .order("recorded_at", { ascending: true })
        .limit(10000);
      if (error) throw error;
      return (data || []) as SensorReading[];
    },
  });
}

// ─── Componente principal ─────────────────────────────────────
export default function SensorDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const { data: companyId } = useUserCompanyId();
  const { data: company } = useCompany();
  // Período
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [customStart, setCustomStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [customEnd, setCustomEnd] = useState(() => new Date().toISOString().split("T")[0]);

  const { since, until } = useMemo(() => {
    const now = new Date();
    if (periodo === "personalizado") {
      return {
        since: new Date(customStart + "T00:00:00").toISOString(),
        until: new Date(customEnd   + "T23:59:59").toISOString(),
      };
    }
    const h = PERIODO_HORAS[periodo as Exclude<Periodo, "personalizado">];
    return {
      since: new Date(now.getTime() - h * 3_600_000).toISOString(),
      until: now.toISOString(),
    };
  }, [periodo, customStart, customEnd]);

  const { data: readings = [], isLoading, refetch } = useSensorDetail(deviceId, since, until);

  // Dados do sensor (último registro)
  const latest = readings[readings.length - 1];
  const roomName = latest?.room_name ?? deviceId ?? "Sensor";
  const tempMin  = latest?.temp_min ?? 18;
  const tempMax  = latest?.temp_max ?? 25;
  const humMin   = latest?.hum_min  ?? 40;
  const humMax   = latest?.hum_max  ?? 60;

  // KPIs
  const kpis = useMemo(() => {
    if (!readings.length) return null;
    const temps = readings.map(r => r.temperature).filter((v): v is number => v != null);
    const hums  = readings.map(r => r.humidity).filter((v): v is number => v != null);
    const conformes = readings.filter(r => readingStatus(r).overall === "conforme").length;
    const total = readings.length;
    return {
      tempMin:  Math.min(...temps),
      tempMax:  Math.max(...temps),
      tempMed:  temps.reduce((a, b) => a + b, 0) / temps.length,
      humMin:   Math.min(...hums),
      humMax:   Math.max(...hums),
      humMed:   hums.reduce((a, b) => a + b, 0) / hums.length,
      conformidade: total > 0 ? (conformes / total) * 100 : 0,
      total,
      naoConformes: readings.filter(r => readingStatus(r).overall === "nao_conforme").length,
    };
  }, [readings]);

  // Dados para gráfico (agrupados por hora se > 48 pontos)
  const chartData = useMemo(() => {
    if (!readings.length) return [];
    if (readings.length <= 200) {
      return readings.map(r => ({
        time: fmtDateShort(r.recorded_at),
        temperatura: r.temperature != null ? +r.temperature.toFixed(1) : null,
        umidade:     r.humidity    != null ? +Number(r.humidity).toFixed(1) : null,
        tempMin, tempMax, humMin, humMax,
      }));
    }
    // Agrupar por hora
    const byHour = new Map<string, SensorReading[]>();
    readings.forEach(r => {
      const d = new Date(r.recorded_at);
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${d.getHours()}`;
      if (!byHour.has(key)) byHour.set(key, []);
      byHour.get(key)!.push(r);
    });
    return Array.from(byHour.entries()).map(([, group]) => {
      const temps = group.map(r => r.temperature).filter((v): v is number => v != null);
      const hums  = group.map(r => r.humidity).filter((v): v is number => v != null);
      return {
        time: fmtDateShort(group[0].recorded_at),
        temperatura: temps.length ? +(temps.reduce((a,b)=>a+b,0)/temps.length).toFixed(1) : null,
        umidade:     hums.length  ? +(hums.reduce((a,b)=>a+b,0)/hums.length).toFixed(1)  : null,
        tempMin, tempMax, humMin, humMax,
      };
    });
  }, [readings, tempMin, tempMax, humMin, humMax]);

  // Exportação PDF
  const handleExportPDF = useCallback(() => {
    const empresaNome = company?.razao_social || company?.nome_fantasia || "BrainX ERP";
    const empresaCnpj = (company as any)?.cnpj || "";
    const periodoLabel = periodo === "personalizado"
      ? `${fmtDateOnly(customStart + "T12:00:00")} a ${fmtDateOnly(customEnd + "T12:00:00")}`
      : PERIODO_LABEL[periodo];

    const conformidade = kpis ? kpis.conformidade.toFixed(1) : "—";
    const naoConformes = kpis ? kpis.naoConformes : 0;

    const rowsHTML = [...readings].reverse().map(r => {
      const st = readingStatus(r);
      const statusColor = st.overall === "conforme" ? "#059669"
        : st.overall === "atencao" ? "#d97706" : "#dc2626";
      const statusLabel = STATUS_LABEL[st.overall];
      return `
        <tr>
          <td>${fmtDate(r.recorded_at)}</td>
          <td style="color:${calcStatus(r.temperature,r.temp_min,r.temp_max,TEMP_MARGIN)==='nao_conforme'?'#dc2626':calcStatus(r.temperature,r.temp_min,r.temp_max,TEMP_MARGIN)==='atencao'?'#d97706':'#059669'};font-weight:600;">${r.temperature != null ? r.temperature.toFixed(1)+"°C" : "—"}</td>
          <td style="color:${calcStatus(r.humidity,r.hum_min,r.hum_max,HUM_MARGIN)==='nao_conforme'?'#dc2626':calcStatus(r.humidity,r.hum_min,r.hum_max,HUM_MARGIN)==='atencao'?'#d97706':'#059669'};font-weight:600;">${r.humidity != null ? Number(r.humidity).toFixed(1)+"%" : "—"}</td>
          <td style="color:${statusColor};font-weight:600;">${statusLabel}</td>
        </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Relatório Ambiental — ${roomName}</title>
<style>
  @page { size: A4; margin: 18mm 15mm 22mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10pt; color: #1A2535; background: #fff; }
  /* CABEÇALHO */
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0F2A44; padding-bottom: 10px; margin-bottom: 14px; }
  .header-left h1 { font-size: 15pt; font-weight: 800; color: #0F2A44; }
  .header-left p  { font-size: 8.5pt; color: #64748B; margin-top: 2px; }
  .header-right   { text-align: right; }
  .header-right .empresa { font-size: 10pt; font-weight: 700; color: #0F2A44; }
  .header-right .cnpj    { font-size: 8pt; color: #64748B; }
  .badge-rdc { display: inline-block; background: #EAF3EE; color: #1C7A4D; border: 1px solid #B9E4CB; border-radius: 4px; font-size: 8pt; font-weight: 700; padding: 2px 8px; margin-top: 4px; }
  /* INFO GRID */
  .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 14px; }
  .info-cell { background: #F4F6F8; border: 1px solid #D8DDE3; border-radius: 6px; padding: 8px 10px; }
  .info-cell .lbl { font-size: 7.5pt; color: #64748B; text-transform: uppercase; letter-spacing: .5px; }
  .info-cell .val { font-size: 11pt; font-weight: 700; color: #0F2A44; margin-top: 2px; }
  /* KPI GRID */
  .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 14px; }
  .kpi-card { border: 1px solid #D8DDE3; border-radius: 6px; padding: 10px 12px; }
  .kpi-card .kpi-lbl { font-size: 7.5pt; color: #64748B; text-transform: uppercase; }
  .kpi-card .kpi-val { font-size: 13pt; font-weight: 800; margin-top: 3px; }
  .kpi-card .kpi-sub { font-size: 8pt; color: #64748B; margin-top: 1px; }
  /* TABELA */
  .section-title { font-size: 10pt; font-weight: 700; color: #0F2A44; border-left: 3px solid #0F2A44; padding-left: 8px; margin-bottom: 8px; margin-top: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  thead tr { background: #0F2A44; color: #fff; }
  thead th { padding: 7px 10px; text-align: left; font-size: 8.5pt; font-weight: 600; }
  tbody tr:nth-child(even) { background: #F8FAFC; }
  tbody tr { border-bottom: 1px solid #EEF1F4; }
  tbody td { padding: 6px 10px; }
  /* RODAPÉ */
  .footer { position: fixed; bottom: 0; left: 0; right: 0; border-top: 2px solid #0F2A44; padding: 6px 15mm; display: flex; justify-content: space-between; align-items: center; font-size: 7.5pt; color: #64748B; background: #fff; }
  .footer .footer-brand { font-weight: 700; color: #0F2A44; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <h1>Relatório de Monitoramento Ambiental</h1>
    <p>Sensor: <strong>${roomName}</strong> &nbsp;|&nbsp; Dispositivo: <code>${deviceId}</code></p>
    <p>Período: <strong>${periodoLabel}</strong> &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleString("pt-BR")}</p>
    <span class="badge-rdc">Monitoramento Ambiental</span>
  </div>
  <div class="header-right">
    <div class="empresa">${empresaNome}</div>
    ${empresaCnpj ? `<div class="cnpj">CNPJ: ${empresaCnpj}</div>` : ""}
    <div style="font-size:8pt;color:#64748B;margin-top:4px;">Sistema: BrainX ERP</div>
  </div>
</div>

<div class="info-grid">
  <div class="info-cell"><div class="lbl">Sala / Ambiente</div><div class="val">${roomName}</div></div>
  <div class="info-cell"><div class="lbl">Limite Temp.</div><div class="val">${tempMin}–${tempMax} °C</div></div>
  <div class="info-cell"><div class="lbl">Limite Umidade</div><div class="val">${humMin}–${humMax} %</div></div>
  <div class="info-cell"><div class="lbl">Total Leituras</div><div class="val">${readings.length}</div></div>
</div>

<div class="kpi-grid">
  <div class="kpi-card">
    <div class="kpi-lbl">Conformidade</div>
    <div class="kpi-val" style="color:${(kpis?.conformidade??0)>=95?'#059669':(kpis?.conformidade??0)>=80?'#d97706':'#dc2626'}">${conformidade}%</div>
    <div class="kpi-sub">${kpis?.total ?? 0} leituras analisadas</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-lbl">Temperatura</div>
    <div class="kpi-val" style="color:#0F2A44;">${kpis ? kpis.tempMed.toFixed(1) : "—"}°C</div>
    <div class="kpi-sub">Mín ${kpis ? kpis.tempMin.toFixed(1) : "—"}°C · Máx ${kpis ? kpis.tempMax.toFixed(1) : "—"}°C</div>
  </div>
  <div class="kpi-card">
    <div class="kpi-lbl">Umidade Relativa</div>
    <div class="kpi-val" style="color:#0F2A44;">${kpis ? kpis.humMed.toFixed(1) : "—"}%</div>
    <div class="kpi-sub">Mín ${kpis ? kpis.humMin.toFixed(1) : "—"}% · Máx ${kpis ? kpis.humMax.toFixed(1) : "—"}%</div>
  </div>
</div>

<div class="section-title">Registros de Leituras</div>
<table>
  <thead>
    <tr>
      <th>Data / Hora</th>
      <th>Temperatura</th>
      <th>Umidade</th>
      <th>Status</th>
    </tr>
  </thead>
  <tbody>${rowsHTML}</tbody>
</table>

<div class="footer">
  <span><span class="footer-brand">BrainX ERP</span> &nbsp;|&nbsp; ${empresaNome}</span>
  <span>Registros mantidos por 5 anos conforme legislação vigente &nbsp;|&nbsp; www.brainxerp.com</span>
</div>

<script>
  window.addEventListener('load', function() {
    setTimeout(function() { try { window.focus(); window.print(); } catch(e){} }, 400);
  });
</script>
</body>
</html>`;

    const old = document.getElementById("sensor-pdf-iframe");
    if (old) old.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "sensor-pdf-iframe";
    Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch(e){} }, 600);
  }, [readings, roomName, deviceId, kpis, company, periodo, customStart, customEnd, tempMin, tempMax, humMin, humMax]);

  // ─── Render ───────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <PageHeader
        title={roomName}
        description={`Dispositivo: ${deviceId} · Monitoramento Ambiental`}
        icon={Factory}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1.5" />
              Atualizar
            </Button>
            <Button size="sm" onClick={handleExportPDF}>
              <Printer className="w-4 h-4 mr-1.5" />
              Exportar PDF
            </Button>
          </div>
        }
      />

      {/* Voltar */}
      <Button variant="ghost" size="sm" className="gap-1.5 -mt-2" onClick={() => navigate("/ambiental/monitoramento")}>
        <ArrowLeft className="w-4 h-4" />
        Voltar ao Monitoramento
      </Button>

      {/* Seletor de período */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
              <Calendar className="w-4 h-4" /> Período:
            </span>
            {(["hoje", "7dias", "15dias", "personalizado"] as Periodo[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-sm font-medium border transition-all",
                  periodo === p
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                )}
              >
                {PERIODO_LABEL[p]}
              </button>
            ))}
            {periodo === "personalizado" && (
              <div className="flex items-center gap-2 ml-2">
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">De</Label>
                  <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 text-xs w-36" />
                </div>
                <div className="flex items-center gap-1.5">
                  <Label className="text-xs">Até</Label>
                  <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-8 text-xs w-36" />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><CardContent className="p-4 h-20 animate-pulse bg-muted/40" /></Card>
          ))}
        </div>
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard
            icon={CheckCircle2}
            label="Conformidade"
            value={`${kpis.conformidade.toFixed(1)}%`}
            sub={`${kpis.total} leituras`}
            tone={kpis.conformidade >= 95 ? "emerald" : kpis.conformidade >= 80 ? "amber" : "red"}
          />
          <KpiCard
            icon={AlertTriangle}
            label="Não conformidades"
            value={String(kpis.naoConformes)}
            sub={`de ${kpis.total} leituras`}
            tone={kpis.naoConformes === 0 ? "emerald" : kpis.naoConformes <= 3 ? "amber" : "red"}
          />
          <KpiCard
            icon={Thermometer}
            label="Temperatura média"
            value={`${kpis.tempMed.toFixed(1)}°C`}
            sub={`${kpis.tempMin.toFixed(1)}–${kpis.tempMax.toFixed(1)}°C`}
            tone="blue"
          />
          <KpiCard
            icon={Droplets}
            label="Umidade média"
            value={`${kpis.humMed.toFixed(1)}%`}
            sub={`${kpis.humMin.toFixed(1)}–${kpis.humMax.toFixed(1)}%`}
            tone="blue"
          />
        </div>
      ) : null}

      {/* Gráficos */}
      {!isLoading && chartData.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Temperatura */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Thermometer className="w-4 h-4 text-red-500" />
                Temperatura (°C)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v: any) => [`${v}°C`, "Temperatura"]}
                  />
                  <ReferenceLine y={tempMin} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Mín ${tempMin}°C`, fontSize: 9, fill: "#f59e0b" }} />
                  <ReferenceLine y={tempMax} stroke="#dc2626" strokeDasharray="4 2" label={{ value: `Máx ${tempMax}°C`, fontSize: 9, fill: "#dc2626" }} />
                  <Line type="monotone" dataKey="temperatura" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Umidade */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Droplets className="w-4 h-4 text-blue-500" />
                Umidade Relativa (%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v: any) => [`${v}%`, "Umidade"]}
                  />
                  <ReferenceLine y={humMin} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Mín ${humMin}%`, fontSize: 9, fill: "#f59e0b" }} />
                  <ReferenceLine y={humMax} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: `Máx ${humMax}%`, fontSize: 9, fill: "#3b82f6" }} />
                  <Line type="monotone" dataKey="umidade" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de leituras */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            Registros de Leituras
            {readings.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({readings.length} registros)
              </span>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            PDF A4
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando leituras...</div>
          ) : readings.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma leitura encontrada para o período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs">Data / Hora</TableHead>
                    <TableHead className="text-xs">Temperatura</TableHead>
                    <TableHead className="text-xs">Limite Temp.</TableHead>
                    <TableHead className="text-xs">Umidade</TableHead>
                    <TableHead className="text-xs">Limite Umid.</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...readings].reverse().slice(0, 500).map(r => {
                    const st = readingStatus(r);
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{fmtDate(r.recorded_at)}</TableCell>
                        <TableCell className={cn("font-mono text-xs font-semibold", {
                          "text-emerald-600": st.temp === "conforme",
                          "text-amber-500":   st.temp === "atencao",
                          "text-red-600":     st.temp === "nao_conforme",
                        })}>
                          {r.temperature != null ? `${r.temperature.toFixed(1)}°C` : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.temp_min ?? "—"}–{r.temp_max ?? "—"} °C
                        </TableCell>
                        <TableCell className={cn("font-mono text-xs font-semibold", {
                          "text-emerald-600": st.hum === "conforme",
                          "text-amber-500":   st.hum === "atencao",
                          "text-red-600":     st.hum === "nao_conforme",
                        })}>
                          {r.humidity != null ? `${Number(r.humidity).toFixed(1)}%` : "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {r.hum_min ?? "—"}–{r.hum_max ?? "—"} %
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", STATUS_BADGE[st.overall])}>
                            {STATUS_LABEL[st.overall]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {readings.length > 500 && (
                <div className="text-xs text-muted-foreground text-center py-3 border-t">
                  Mostrando 500 de {readings.length} registros. Use o PDF para ver todos.
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rodapé ANVISA */}
      <div className="border-t pt-4 mt-2 flex flex-wrap items-center gap-2 text-[11px] font-mono text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Sistema: BrainX ERP</span>
        <span className="mx-1">|</span>
        <span>{company?.nome_fantasia || company?.razao_social || 'BrainX ERP'}</span>
        <span className="mx-1">|</span>
        <span>Registros mantidos por 5 anos conforme legislação vigente</span>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────
const TONE: Record<string, { bg: string; fg: string; val: string }> = {
  emerald: { bg: "bg-emerald-100", fg: "text-emerald-700", val: "text-emerald-600" },
  amber:   { bg: "bg-amber-100",   fg: "text-amber-700",   val: "text-amber-600"   },
  red:     { bg: "bg-red-100",     fg: "text-red-700",     val: "text-red-600"     },
  blue:    { bg: "bg-blue-100",    fg: "text-blue-700",    val: "text-blue-600"    },
};
function KpiCard({ icon: Icon, label, value, sub, tone }: {
  icon: any; label: string; value: string; sub?: string; tone: string;
}) {
  const t = TONE[tone] ?? TONE.blue;
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", t.bg)}>
          <Icon className={cn("w-5 h-5", t.fg)} />
        </div>
        <div className="min-w-0">
          <div className={cn("text-xl font-semibold leading-tight font-mono", t.val)}>{value}</div>
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
          {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
        </div>
      </CardContent>
    </Card>
  );
}
