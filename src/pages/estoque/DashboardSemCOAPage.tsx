import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  TriangleAlert,
  ShieldOff,
  TrendingUp,
  Users,
  Package,
  FileText,
  ArrowLeft,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

// Categorias de justificativas para agrupamento automático
const CATEGORIAS_JUSTIFICATIVA = [
  { label: "COA em trânsito / aguardando fornecedor", keywords: ["trânsito", "aguardando", "fornecedor", "envio", "prazo"] },
  { label: "Urgência de produção", keywords: ["urgência", "urgente", "emergência", "prazo", "produção"] },
  { label: "COA aprovado verbalmente pelo RT", keywords: ["verbal", "rt", "responsável", "aprovado", "autorizado"] },
  { label: "Reprocessamento / retrabalho", keywords: ["reprocessamento", "retrabalho", "repro"] },
  { label: "Lote de desenvolvimento / P&D", keywords: ["desenvolvimento", "p&d", "pesquisa", "piloto", "teste"] },
  { label: "Outros", keywords: [] },
];

function categorizarJustificativa(texto: string): string {
  const lower = texto.toLowerCase();
  for (const cat of CATEGORIAS_JUSTIFICATIVA) {
    if (cat.keywords.length > 0 && cat.keywords.some((k) => lower.includes(k))) {
      return cat.label;
    }
  }
  return "Outros";
}

const CORES_GRAFICO = ["#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#10b981", "#6b7280"];

export default function DashboardSemCOAPage() {
  const navigate = useNavigate();

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["lote-liberacoes-sem-coa-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lote_liberacoes_sem_coa" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Métricas gerais
  const totalRegistros = registros.length;
  const semCOA = registros.filter((r) => !r.coa_presente).length;
  const comCOANaoValidado = registros.filter((r) => r.coa_presente).length;
  const operadoresUnicos = new Set(registros.map((r) => r.usuario_email || r.usuario_nome)).size;
  const lotesUnicos = new Set(registros.map((r) => r.lote_id)).size;

  // Agrupamento por categoria de justificativa
  const porCategoria = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const r of registros) {
      const cat = categorizarJustificativa(r.justificativa || "");
      mapa[cat] = (mapa[cat] || 0) + 1;
    }
    return Object.entries(mapa)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [registros]);

  // Agrupamento por operador
  const porOperador = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const r of registros) {
      const nome = r.usuario_nome || "Desconhecido";
      mapa[nome] = (mapa[nome] || 0) + 1;
    }
    return Object.entries(mapa)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [registros]);

  // Evolução por mês
  const porMes = useMemo(() => {
    const mapa: Record<string, number> = {};
    for (const r of registros) {
      if (!r.created_at) continue;
      const mes = format(new Date(r.created_at), "MMM/yy", { locale: ptBR });
      mapa[mes] = (mapa[mes] || 0) + 1;
    }
    return Object.entries(mapa).map(([name, value]) => ({ name, value }));
  }, [registros]);

  // Top 5 justificativas textuais mais frequentes (palavras-chave)
  const topJustificativas = useMemo(() => {
    const contagem: Record<string, { count: number; exemplos: string[] }> = {};
    for (const r of registros) {
      const cat = categorizarJustificativa(r.justificativa || "");
      if (!contagem[cat]) contagem[cat] = { count: 0, exemplos: [] };
      contagem[cat].count++;
      if (contagem[cat].exemplos.length < 3) {
        contagem[cat].exemplos.push(r.justificativa?.slice(0, 120) || "");
      }
    }
    return Object.entries(contagem)
      .map(([categoria, { count, exemplos }]) => ({ categoria, count, exemplos }))
      .sort((a, b) => b.count - a.count);
  }, [registros]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <p className="text-muted-foreground text-sm">Carregando dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Cabeçalho */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-amber-500" />
            Dashboard — Liberações sem COA
          </h1>
          <p className="text-sm text-muted-foreground">
            Análise de todas as liberações de lote realizadas sem COA validado.
            Base legal: RDC 275/2002 Art. 3 · RDC 243/2018 Art. 12
          </p>
        </div>
      </div>

      {totalRegistros === 0 ? (
        <Card className="border-green-200 bg-green-50/30">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <FileText className="h-6 w-6 text-green-600" />
            </div>
            <p className="text-green-800 font-semibold">Nenhuma liberação sem COA registrada</p>
            <p className="text-sm text-green-700">Todos os lotes foram liberados com COA validado.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Cards de métricas */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card className="border-amber-200 bg-amber-50/40">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <TriangleAlert className="h-4 w-4 text-amber-500" />
                  <span className="text-xs text-muted-foreground">Total de registros</span>
                </div>
                <p className="text-2xl font-bold text-amber-800">{totalRegistros}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <ShieldOff className="h-4 w-4 text-red-400" />
                  <span className="text-xs text-muted-foreground">Sem COA algum</span>
                </div>
                <p className="text-2xl font-bold text-red-700">{semCOA}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-muted-foreground">COA não validado</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">{comCOANaoValidado}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="h-4 w-4 text-purple-400" />
                  <span className="text-xs text-muted-foreground">Lotes únicos</span>
                </div>
                <p className="text-2xl font-bold text-purple-700">{lotesUnicos}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-green-400" />
                  <span className="text-xs text-muted-foreground">Operadores</span>
                </div>
                <p className="text-2xl font-bold text-green-700">{operadoresUnicos}</p>
              </CardContent>
            </Card>
          </div>

          {/* Gráficos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Categorias de justificativa — Pizza */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-amber-500" />
                  Categorias de Justificativa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={porCategoria}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {porCategoria.map((_, i) => (
                        <Cell key={i} fill={CORES_GRAFICO[i % CORES_GRAFICO.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => [`${v} registro(s)`, ""]} />
                    <Legend
                      formatter={(value) =>
                        value.length > 30 ? value.slice(0, 30) + "…" : value
                      }
                      wrapperStyle={{ fontSize: "11px" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Por operador — Barras horizontais */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" />
                  Liberações por Operador
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart
                    data={porOperador}
                    layout="vertical"
                    margin={{ left: 8, right: 16 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip formatter={(v: any) => [`${v} registro(s)`, "Liberações"]} />
                    <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Evolução por mês */}
            {porMes.length > 1 && (
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-500" />
                    Evolução Mensal
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={porMes}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => [`${v} registro(s)`, "Liberações"]} />
                      <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Top justificativas com exemplos */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" />
                Justificativas Mais Comuns — com exemplos reais
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {topJustificativas.map((item, idx) => (
                <div key={item.categoria}>
                  <div className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: CORES_GRAFICO[idx % CORES_GRAFICO.length] }}
                        />
                        <span className="text-sm font-medium">{item.categoria}</span>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {item.count} registro{item.count > 1 ? "s" : ""}
                        {" "}({((item.count / totalRegistros) * 100).toFixed(0)}%)
                      </Badge>
                    </div>
                    {item.exemplos.length > 0 && (
                      <div className="ml-5 space-y-1">
                        {item.exemplos.map((ex, i) => (
                          <p key={i} className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2">
                            "{ex}{ex.length >= 120 ? "…" : ""}"
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                  {idx < topJustificativas.length - 1 && <Separator />}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Tabela de registros recentes */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                <TriangleAlert className="h-4 w-4 text-amber-500" />
                Registros Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-2 font-semibold">Data/Hora</th>
                      <th className="text-left px-4 py-2 font-semibold">Lote</th>
                      <th className="text-left px-4 py-2 font-semibold">Operador</th>
                      <th className="text-left px-4 py-2 font-semibold">COA</th>
                      <th className="text-left px-4 py-2 font-semibold">Justificativa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registros.slice(0, 20).map((r: any) => (
                      <tr
                        key={r.id}
                        className="border-b hover:bg-muted/20 cursor-pointer"
                        onClick={() => navigate(`/estoque/lotes/${r.lote_id}`)}
                      >
                        <td className="px-4 py-2 font-mono whitespace-nowrap">
                          {r.created_at
                            ? format(new Date(r.created_at), "dd/MM/yy HH:mm", { locale: ptBR })
                            : "—"}
                        </td>
                        <td className="px-4 py-2 font-semibold text-amber-800">
                          {r.numero_lote || "—"}
                        </td>
                        <td className="px-4 py-2">{r.usuario_nome || "—"}</td>
                        <td className="px-4 py-2">
                          <Badge
                            variant="outline"
                            className={
                              r.coa_presente
                                ? "text-blue-600 border-blue-300 text-[10px]"
                                : "text-red-600 border-red-300 text-[10px]"
                            }
                          >
                            {r.coa_presente ? "Não validado" : "Ausente"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2 max-w-xs truncate text-muted-foreground">
                          {r.justificativa || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {registros.length > 20 && (
                  <p className="text-xs text-muted-foreground text-center py-3">
                    Exibindo 20 de {registros.length} registros
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
