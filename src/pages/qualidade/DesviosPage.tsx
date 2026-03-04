import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQCDesvios } from "@/hooks/use-qc";
import { FASES_LABELS } from "@/hooks/use-desvio-detail";
import { format } from "date-fns";

export default function DesviosPage() {
  const { data: desvios, isLoading } = useQCDesvios();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (desvios || []).filter(d => {
    const matchSearch = d.codigo.toLowerCase().includes(search.toLowerCase()) || d.descricao.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: desvios?.length || 0,
    abertos: desvios?.filter(d => d.status === "ABERTO").length || 0,
    emAnalise: desvios?.filter(d => ["EM_ANALISE", "EM_CONTENCAO", "EM_IMPLEMENTACAO", "EM_VERIFICACAO"].includes(d.status)).length || 0,
    resolvidos: desvios?.filter(d => d.status === "FECHADO").length || 0,
    criticos: desvios?.filter(d => d.severidade === "CRITICA").length || 0,
  };

  const getSeveridadeVariant = (s: string): "error" | "warning" | "info" | "muted" => {
    if (s === "CRITICA") return "error";
    if (s === "ALTA") return "warning";
    if (s === "MEDIA") return "info";
    return "muted";
  };

  const getStatusVariant = (s: string): "error" | "warning" | "success" | "info" | "muted" => {
    if (s === "ABERTO") return "error";
    if (["EM_ANALISE", "EM_CONTENCAO", "EM_IMPLEMENTACAO", "EM_VERIFICACAO"].includes(s)) return "warning";
    if (s === "FECHADO") return "success";
    if (s === "RESOLVIDO") return "success";
    return "muted";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Desvios / CAPA"
        description="Gestão de não-conformidades, ações corretivas e preventivas"
        icon={ShieldAlert}
        actions={<Button onClick={() => navigate("/qualidade/desvios/novo")}><Plus className="h-4 w-4 mr-2" />Novo Desvio</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-destructive/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-destructive">{stats.abertos}</div><p className="text-xs text-muted-foreground">Abertos</p></CardContent></Card>
        <Card className="border-warning/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-warning">{stats.emAnalise}</div><p className="text-xs text-muted-foreground">Em Tratamento</p></CardContent></Card>
        <Card className="border-success/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-success">{stats.resolvidos}</div><p className="text-xs text-muted-foreground">Fechados</p></CardContent></Card>
        <Card className="border-destructive/50"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-destructive">{stats.criticos}</div><p className="text-xs text-muted-foreground">Críticos</p></CardContent></Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar desvio..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ABERTO">Aberto</SelectItem>
            <SelectItem value="EM_CONTENCAO">Em Contenção</SelectItem>
            <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
            <SelectItem value="EM_IMPLEMENTACAO">Em Implementação</SelectItem>
            <SelectItem value="EM_VERIFICACAO">Em Verificação</SelectItem>
            <SelectItem value="FECHADO">Fechado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Severidade</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Fase</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum desvio encontrado</TableCell></TableRow>
            ) : filtered.map(d => (
              <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/qualidade/desvios/${d.id}`)}>
                <TableCell className="font-mono font-medium">{d.codigo}</TableCell>
                <TableCell><Badge variant="outline">{d.tipo.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell><StatusBadge variant={getSeveridadeVariant(d.severidade)}>{d.severidade}</StatusBadge></TableCell>
                <TableCell className="max-w-[300px] truncate">{d.descricao}</TableCell>
                <TableCell><Badge variant="secondary" className="text-xs">{FASES_LABELS[(d as any).fase_atual] || "Identificação"}</Badge></TableCell>
                <TableCell><StatusBadge variant={getStatusVariant(d.status)}>{d.status.replace(/_/g, " ")}</StatusBadge></TableCell>
                <TableCell>{format(new Date(d.created_at), "dd/MM/yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
