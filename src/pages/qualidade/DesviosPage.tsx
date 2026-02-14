import { useState } from "react";
import { ShieldAlert, Plus, Search, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useQCDesvios, type QCDesvio } from "@/hooks/use-qc";
import { format } from "date-fns";

export default function DesviosPage() {
  const { data: desvios, isLoading, criar, atualizar } = useQCDesvios();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDesvio, setEditDesvio] = useState<QCDesvio | null>(null);

  // Form state
  const [form, setForm] = useState({
    codigo: "",
    tipo: "NAO_CONFORMIDADE",
    severidade: "MEDIA",
    descricao: "",
    causa_raiz: "",
    acao_corretiva: "",
    acao_preventiva: "",
    prazo: "",
    status: "ABERTO",
  });

  const resetForm = () => {
    setForm({ codigo: "", tipo: "NAO_CONFORMIDADE", severidade: "MEDIA", descricao: "", causa_raiz: "", acao_corretiva: "", acao_preventiva: "", prazo: "", status: "ABERTO" });
    setEditDesvio(null);
  };

  const openNew = () => {
    resetForm();
    const seq = (desvios?.length || 0) + 1;
    setForm(f => ({ ...f, codigo: `DEV-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}` }));
    setDialogOpen(true);
  };

  const openEdit = (d: QCDesvio) => {
    setEditDesvio(d);
    setForm({
      codigo: d.codigo,
      tipo: d.tipo,
      severidade: d.severidade,
      descricao: d.descricao,
      causa_raiz: d.causa_raiz || "",
      acao_corretiva: d.acao_corretiva || "",
      acao_preventiva: d.acao_preventiva || "",
      prazo: d.prazo || "",
      status: d.status,
    });
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!form.descricao) return;
    if (editDesvio) {
      atualizar.mutate({ id: editDesvio.id, ...form });
    } else {
      criar.mutate(form as any);
    }
    setDialogOpen(false);
    resetForm();
  };

  const filtered = (desvios || []).filter(d => {
    const matchSearch = d.codigo.toLowerCase().includes(search.toLowerCase()) || d.descricao.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || d.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: desvios?.length || 0,
    abertos: desvios?.filter(d => d.status === "ABERTO").length || 0,
    emAnalise: desvios?.filter(d => d.status === "EM_ANALISE").length || 0,
    resolvidos: desvios?.filter(d => d.status === "RESOLVIDO").length || 0,
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
    if (s === "EM_ANALISE") return "warning";
    if (s === "RESOLVIDO") return "success";
    if (s === "FECHADO") return "info";
    return "muted";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Desvios / CAPA"
        description="Gestão de não-conformidades, ações corretivas e preventivas"
        icon={ShieldAlert}
        actions={<Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />Novo Desvio</Button>}
      />

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-destructive/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-destructive">{stats.abertos}</div><p className="text-xs text-muted-foreground">Abertos</p></CardContent></Card>
        <Card className="border-warning/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-warning">{stats.emAnalise}</div><p className="text-xs text-muted-foreground">Em Análise</p></CardContent></Card>
        <Card className="border-success/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-success">{stats.resolvidos}</div><p className="text-xs text-muted-foreground">Resolvidos</p></CardContent></Card>
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
            <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
            <SelectItem value="RESOLVIDO">Resolvido</SelectItem>
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
              <TableHead>Status</TableHead>
              <TableHead>Prazo</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum desvio encontrado</TableCell></TableRow>
            ) : filtered.map(d => (
              <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(d)}>
                <TableCell className="font-mono font-medium">{d.codigo}</TableCell>
                <TableCell><Badge variant="outline">{d.tipo.replace(/_/g, " ")}</Badge></TableCell>
                <TableCell><StatusBadge variant={getSeveridadeVariant(d.severidade)}>{d.severidade}</StatusBadge></TableCell>
                <TableCell className="max-w-[300px] truncate">{d.descricao}</TableCell>
                <TableCell><StatusBadge variant={getStatusVariant(d.status)}>{d.status.replace(/_/g, " ")}</StatusBadge></TableCell>
                <TableCell>{d.prazo ? format(new Date(d.prazo), "dd/MM/yyyy") : "-"}</TableCell>
                <TableCell>{format(new Date(d.created_at), "dd/MM/yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editDesvio ? "Editar Desvio" : "Novo Desvio"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-3 gap-4">
              <div><Label>Código</Label><Input value={form.codigo} onChange={e => setForm(f => ({ ...f, codigo: e.target.value }))} /></div>
              <div><Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NAO_CONFORMIDADE">Não Conformidade</SelectItem>
                    <SelectItem value="DESVIO_PROCESSO">Desvio de Processo</SelectItem>
                    <SelectItem value="RECLAMACAO">Reclamação</SelectItem>
                    <SelectItem value="AUDITORIA">Auditoria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Severidade</Label>
                <Select value={form.severidade} onValueChange={v => setForm(f => ({ ...f, severidade: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BAIXA">Baixa</SelectItem>
                    <SelectItem value="MEDIA">Média</SelectItem>
                    <SelectItem value="ALTA">Alta</SelectItem>
                    <SelectItem value="CRITICA">Crítica</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>Descrição *</Label><Textarea value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} rows={2} /></div>
            <div><Label>Causa Raiz</Label><Textarea value={form.causa_raiz} onChange={e => setForm(f => ({ ...f, causa_raiz: e.target.value }))} rows={2} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Ação Corretiva</Label><Textarea value={form.acao_corretiva} onChange={e => setForm(f => ({ ...f, acao_corretiva: e.target.value }))} rows={2} /></div>
              <div><Label>Ação Preventiva</Label><Textarea value={form.acao_preventiva} onChange={e => setForm(f => ({ ...f, acao_preventiva: e.target.value }))} rows={2} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Prazo</Label><Input type="date" value={form.prazo} onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))} /></div>
              {editDesvio && (
                <div><Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ABERTO">Aberto</SelectItem>
                      <SelectItem value="EM_ANALISE">Em Análise</SelectItem>
                      <SelectItem value="RESOLVIDO">Resolvido</SelectItem>
                      <SelectItem value="FECHADO">Fechado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.descricao}>{editDesvio ? "Salvar" : "Registrar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
