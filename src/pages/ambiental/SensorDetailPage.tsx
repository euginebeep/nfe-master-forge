// ============================================================
// BRAINX ERP — DETALHE DO SENSOR AMBIENTAL
// Relatório completo: Hoje / 7 dias / 15 dias / Personalizado
// Exportação PDF A4 com cabeçalho e rodapé padrão BrainX
// ============================================================
import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Printer, Download, Calendar, Thermometer,
  Droplets, ShieldCheck, AlertTriangle, CheckCircle2,
  Factory, RefreshCw,
} from "lucide-react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from "recharts";
import { useCompany } from "@/hooks/use-company";
import {
  useAmbientalHistorico,
  useAmbientalTempoReal,
  type PontoAgregado,
  type StatusConformidade,
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

function aggregateStatus(p: PontoAgregado): StatusConformidade {
  return p.fora_da_faixa > 0 ? "nao_conforme" : "conforme";
}

function fmtNumber(value: number | null | undefined, digits = 1) {
  return value == null || Number.isNaN(value) ? "—" : value.toFixed(digits);
}

// ─── Componente principal ─────────────────────────────────────
export default function SensorDetailPage() {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
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

  const { data: historico = [], isLoading, refetch } = useAmbientalHistorico(since, until, deviceId ?? null);
  const { data: tempoReal = [] } = useAmbientalTempoReal();
  const latestTempoReal = useMemo(
    () => tempoReal.find((r) => r.device_id === deviceId) ?? null,
    [tempoReal, deviceId],
  );

  // Dados do sensor (último registro)
  const latestAggregate = useMemo(
    () =>
      historico
        .slice()
        .sort((a, b) => new Date(b.bucket).getTime() - new Date(a.bucket).getTime())[0],
    [historico],
  );
  const roomName = latestTempoReal?.room_name ?? latestAggregate?.room_name ?? deviceId ?? "Sensor";
  const tempMin  = latestTempoReal?.temp_min ?? latestAggregate?.temp_min ?? 18;
  const tempMax  = latestTempoReal?.temp_max ?? latestAggregate?.temp_max ?? 25;
  const humMin   = latestTempoReal?.hum_min  ?? latestAggregate?.hum_min  ?? 40;
  const humMax   = latestTempoReal?.hum_max  ?? latestAggregate?.hum_max  ?? 60;
  const latestTemperature = latestTempoReal?.temperature ?? latestAggregate?.temp_avg ?? null;
  const latestHumidity = latestTempoReal?.humidity ?? latestAggregate?.hum_avg ?? null;
  const latestRecordedAt = latestTempoReal?.recorded_at ?? latestAggregate?.bucket ?? null;

  // KPIs
  const kpis = useMemo(() => {
    if (!historico.length) return null;
    const tempMins = historico.map(p => p.temp_min).filter((v): v is number => v != null);
    const tempMaxs = historico.map(p => p.temp_max).filter((v): v is number => v != null);
    const humMins  = historico.map(p => p.hum_min).filter((v): v is number => v != null);
    const humMaxs  = historico.map(p => p.hum_max).filter((v): v is number => v != null);
    const total = historico.reduce((sum, p) => sum + Math.max(1, p.leituras || 0), 0);
    const naoConformes = historico.reduce((sum, p) => sum + (p.fora_da_faixa || 0), 0);
    const tempPeso = historico.reduce((sum, p) => sum + (p.temp_avg == null ? 0 : Math.max(1, p.leituras || 0)), 0);
    const humPeso = historico.reduce((sum, p) => sum + (p.hum_avg == null ? 0 : Math.max(1, p.leituras || 0)), 0);
    return {
      tempMin:  tempMins.length ? Math.min(...tempMins) : 0,
      tempMax:  tempMaxs.length ? Math.max(...tempMaxs) : 0,
      tempMed:  tempPeso ? historico.reduce((sum, p) => sum + (p.temp_avg ?? 0) * Math.max(1, p.leituras || 0), 0) / tempPeso : 0,
      humMin:   humMins.length ? Math.min(...humMins) : 0,
      humMax:   humMaxs.length ? Math.max(...humMaxs) : 0,
      humMed:   humPeso ? historico.reduce((sum, p) => sum + (p.hum_avg ?? 0) * Math.max(1, p.leituras || 0), 0) / humPeso : 0,
      conformidade: total > 0 ? Math.max(0, ((total - naoConformes) / total) * 100) : 0,
      total,
      naoConformes,
    };
  }, [historico]);

  // Dados para gráfico agregados pela janela escolhida no RPC
  const chartData = useMemo(() => {
    if (!historico.length) return [];
    return historico
      .slice()
      .sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime())
      .map(p => ({
        time: fmtDateShort(p.bucket),
        temperatura: p.temp_avg != null ? +p.temp_avg.toFixed(1) : null,
        tempRange: p.temp_min != null && p.temp_max != null ? [p.temp_min, p.temp_max] : null,
        umidade: p.hum_avg != null ? +Number(p.hum_avg).toFixed(1) : null,
        humRange: p.hum_min != null && p.hum_max != null ? [p.hum_min, p.hum_max] : null,
      }));
  }, [historico]);

  // Exportação PDF
  const handleExportPDF = useCallback(() => {
    const empresaNome = company?.razao_social || company?.nome_fantasia || "BrainX ERP";
    const empresaCnpj = (company as any)?.cnpj || "";
    const periodoLabel = periodo === "personalizado"
      ? `${fmtDateOnly(customStart + "T12:00:00")} a ${fmtDateOnly(customEnd + "T12:00:00")}`
      : PERIODO_LABEL[periodo];

    const conformidade = kpis ? kpis.conformidade.toFixed(1) : "—";
    const naoConformes = kpis ? kpis.naoConformes : 0;

    const rowsHTML = [...historico].reverse().map(p => {
      const st = aggregateStatus(p);
      const statusColor = st === "conforme" ? "#059669" : "#dc2626";
      const statusLabel = STATUS_LABEL[st];
      return `
        <tr>
          <td>${fmtDate(p.bucket)}</td>
          <td style="font-weight:600;">${fmtNumber(p.temp_avg)}°C <span style="color:#64748B;font-weight:400;">(${fmtNumber(p.temp_min)}–${fmtNumber(p.temp_max)}°C)</span></td>
          <td style="font-weight:600;">${fmtNumber(p.hum_avg, 0)}% <span style="color:#64748B;font-weight:400;">(${fmtNumber(p.hum_min, 0)}–${fmtNumber(p.hum_max, 0)}%)</span></td>
          <td>${p.leituras}</td>
          <td>${p.fora_da_faixa}</td>
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
  <div class="info-cell"><div class="lbl">Total Leituras</div><div class="val">${kpis?.total ?? 0}</div></div>
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

<div class="section-title">Histórico agregado</div>
<table>
  <thead>
    <tr>
      <th>Bucket</th>
      <th>Temperatura</th>
      <th>Umidade</th>
      <th>Leituras</th>
      <th>Fora da faixa</th>
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
  }, [historico, roomName, deviceId, kpis, company, periodo, customStart, customEnd, tempMin, tempMax, humMin, humMax]);

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

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Última atualização</div>
            <div className="font-mono text-sm font-semibold">
              {latestRecordedAt ? fmtDate(latestRecordedAt) : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {latestTempoReal ? "Tempo real" : "Último bucket agregado"}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Temperatura atual</div>
            <div className="font-mono text-xl font-semibold text-red-600">
              {latestTemperature != null ? `${latestTemperature.toFixed(1)}°C` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">Limite: {tempMin}–{tempMax} °C</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Umidade atual</div>
            <div className="font-mono text-xl font-semibold text-blue-600">
              {latestHumidity != null ? `${Number(latestHumidity).toFixed(1)}%` : "—"}
            </div>
            <div className="text-[10px] text-muted-foreground">Limite: {humMin}–{humMax} %</div>
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
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v: any, name: string) => {
                      if (Array.isArray(v)) return [`${v[0]}–${v[1]}°C`, "Faixa temp"];
                      return [`${v}°C`, name === "temperatura" ? "Temp média" : "Temperatura"];
                    }}
                  />
                  <ReferenceLine y={tempMin} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Mín ${tempMin}°C`, fontSize: 9, fill: "#f59e0b" }} />
                  <ReferenceLine y={tempMax} stroke="#dc2626" strokeDasharray="4 2" label={{ value: `Máx ${tempMax}°C`, fontSize: 9, fill: "#dc2626" }} />
                  <Area type="monotone" dataKey="tempRange" stroke="none" fill="#ef4444" fillOpacity={0.14} dot={false} activeDot={false} />
                  <Line type="monotone" dataKey="temperatura" stroke="#ef4444" strokeWidth={2} dot={false} connectNulls />
                </ComposedChart>
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
                <ComposedChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v: any, name: string) => {
                      if (Array.isArray(v)) return [`${v[0]}–${v[1]}%`, "Faixa umid"];
                      return [`${v}%`, name === "umidade" ? "Umid média" : "Umidade"];
                    }}
                  />
                  <ReferenceLine y={humMin} stroke="#f59e0b" strokeDasharray="4 2" label={{ value: `Mín ${humMin}%`, fontSize: 9, fill: "#f59e0b" }} />
                  <ReferenceLine y={humMax} stroke="#3b82f6" strokeDasharray="4 2" label={{ value: `Máx ${humMax}%`, fontSize: 9, fill: "#3b82f6" }} />
                  <Area type="monotone" dataKey="humRange" stroke="none" fill="#3b82f6" fillOpacity={0.14} dot={false} activeDot={false} />
                  <Line type="monotone" dataKey="umidade" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabela de leituras */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">
            Histórico agregado
            {historico.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground font-normal">
                ({historico.length} buckets)
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
            <div className="p-8 text-center text-sm text-muted-foreground">Carregando histórico agregado...</div>
          ) : historico.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhum bucket agregado encontrado para o período selecionado.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-background z-10">
                  <TableRow>
                    <TableHead className="text-xs">Bucket</TableHead>
                    <TableHead className="text-xs">Temp média</TableHead>
                    <TableHead className="text-xs">Faixa temp</TableHead>
                    <TableHead className="text-xs">Umid média</TableHead>
                    <TableHead className="text-xs">Faixa umid</TableHead>
                    <TableHead className="text-xs">Leituras</TableHead>
                    <TableHead className="text-xs">Fora da faixa</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...historico].reverse().slice(0, 500).map(p => {
                    const st = aggregateStatus(p);
                    return (
                      <TableRow key={`${p.device_id}-${p.bucket}`}>
                        <TableCell className="font-mono text-xs">{fmtDate(p.bucket)}</TableCell>
                        <TableCell className={cn("font-mono text-xs font-semibold", STATUS_BADGE[st].includes("red") ? "text-red-600" : "text-emerald-600")}>
                          {fmtNumber(p.temp_avg)}°C
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {fmtNumber(p.temp_min)}–{fmtNumber(p.temp_max)} °C
                        </TableCell>
                        <TableCell className={cn("font-mono text-xs font-semibold", STATUS_BADGE[st].includes("red") ? "text-red-600" : "text-emerald-600")}>
                          {fmtNumber(p.hum_avg, 0)}%
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {fmtNumber(p.hum_min, 0)}–{fmtNumber(p.hum_max, 0)} %
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.leituras}</TableCell>
                        <TableCell className="font-mono text-xs">{p.fora_da_faixa}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={cn("text-xs", STATUS_BADGE[st])}>
                            {STATUS_LABEL[st]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {historico.length > 500 && (
                <div className="text-xs text-muted-foreground text-center py-3 border-t">
                  Mostrando 500 de {historico.length} buckets. Use o PDF para ver todos.
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
