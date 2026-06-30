import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface LogRow {
  termo: string;
  origem: string;
  encontrou_match: boolean;
  total_resultados: number;
  usou_ia: boolean;
  duracao_ms: number | null;
  created_at: string;
}

export function AnvisaSearchStats() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<LogRow[]>([]);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("anvisa_search_log" as any)
      .select("termo, origem, encontrou_match, total_resultados, usou_ia, duracao_ms, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    setRows((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const now = Date.now();
  const last24h = rows.filter((r) => now - new Date(r.created_at).getTime() < 86400000);
  const last30d = rows.filter((r) => now - new Date(r.created_at).getTime() < 30 * 86400000);
  const totalIa = rows.filter((r) => r.usou_ia).length;
  const totalMatch = last30d.filter((r) => r.encontrou_match).length;
  const totalSemMatch = last30d.filter((r) => !r.encontrou_match && r.origem !== "erro").length;
  const totalErro = last30d.filter((r) => r.origem === "erro").length;
  const custoEstimadoUsd = totalIa * 0.0002;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            Pesquisas ANVISA — Consumo e Estatísticas
          </CardTitle>
          <CardDescription>
            Auditoria de chamadas ao motor de consulta ANVISA (Power BI IN 28/2018). A IA só é acionada
            quando o termo não existe na base oficial.
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Últimas 24h" value={last24h.length} />
          <StatCard label="Últimos 30 dias" value={last30d.length} />
          <StatCard label="Com match oficial" value={totalMatch} icon={<CheckCircle2 className="w-4 h-4 text-green-600" />} />
          <StatCard label="Sem match" value={totalSemMatch} icon={<XCircle className="w-4 h-4 text-amber-600" />} />
          <StatCard label="Erros" value={totalErro} icon={<AlertTriangle className="w-4 h-4 text-destructive" />} />
        </div>

        <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total de chamadas à IA BrainX (histórico completo)</span>
            <span className="font-semibold tabular-nums">{totalIa}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Custo estimado IA (≈ US$ 0,0002/chamada)</span>
            <span className="font-semibold tabular-nums">US$ {custoEstimadoUsd.toFixed(4)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Consultas Power BI (sem custo)</span>
            <span className="font-semibold tabular-nums">{rows.length - totalIa}</span>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-semibold mb-2">Últimas 20 pesquisas</h4>
          <div className="rounded-lg border max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr className="text-left">
                  <th className="px-2 py-1.5">Quando</th>
                  <th className="px-2 py-1.5">Termo</th>
                  <th className="px-2 py-1.5">Origem</th>
                  <th className="px-2 py-1.5 text-right">Result.</th>
                  <th className="px-2 py-1.5 text-right">Tempo</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 20).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-2 py-1.5 font-medium">{r.termo}</td>
                    <td className="px-2 py-1.5">
                      <Badge variant={r.encontrou_match ? "default" : r.origem === "erro" ? "destructive" : "secondary"} className="text-[10px]">
                        {r.origem === "erro" ? "ERRO" : r.encontrou_match ? "MATCH" : "SEM MATCH"}
                      </Badge>
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">{r.total_resultados}</td>
                    <td className="px-2 py-1.5 text-right text-muted-foreground tabular-nums">
                      {r.duracao_ms ? `${r.duracao_ms} ms` : "—"}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !loading && (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-muted-foreground">
                      Nenhuma pesquisa registrada ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}