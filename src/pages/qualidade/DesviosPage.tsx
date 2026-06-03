import { useEffect, useState } from "react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useQCDesvios } from "@/hooks/use-qc";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FASES_LABELS } from "@/hooks/use-desvio-detail";
import { format } from "date-fns";

export default function DesviosPage() {
  const { data: desvios, isLoading } = useQCDesvios();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: companyId } = useUserCompanyId();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [novoDesvioOpen, setNovoDesvioOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [opsAtivas, setOpsAtivas] = useState<Array<{ id: string; codigo: string; produto_nome: string | null }>>([]);
  const [form, setForm] = useState({
    tipo: "PROCESSO",
    severidade: "MEDIA",
    descricao: "",
    fase_detectada: "PRODUCAO",
    produto_afetado: "",
    lote_afetado: "",
    op_id: "",
  });

  const resetForm = () => setForm({
    tipo: "PROCESSO",
    severidade: "MEDIA",
    descricao: "",
    fase_detectada: "PRODUCAO",
    produto_afetado: "",
    lote_afetado: "",
    op_id: "",
  });

  useEffect(() => {
    if (!novoDesvioOpen || !companyId) return;
    (async () => {
      const { data } = await supabase
        .from("ordens_producao_industrial")
        .select("id, codigo, produto_nome")
        .eq("company_id", companyId)
        .in("status", ["PLANEJADA", "EM_PRODUCAO"])
        .order("codigo", { ascending: false });
      setOpsAtivas((data || []) as any);
    })();
  }, [novoDesvioOpen, companyId]);

  const gerarCodigo = () => {
    const d = new Date();
    const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    const seq = String(Math.floor(Math.random() * 1000)).padStart(3, "0");
    return `DEV-${ymd}-${seq}`;
  };

  const handleSalvar = async () => {
    if (!form.descricao.trim()) {
      toast.error("Descrição é obrigatória");
      return;
    }
    if (!companyId) {
      toast.error("Empresa não identificada");
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        codigo: gerarCodigo(),
        tipo: form.tipo,
        severidade: form.severidade,
        descricao: form.descricao,
        status: "ABERTO",
        fase_atual: "IDENTIFICACAO",
        company_id: companyId,
        produto_afetado: form.produto_afetado || null,
        lote_afetado: form.lote_afetado || null,
        fase_detectada: form.fase_detectada,
        op_id: form.op_id || null,
      };
      const { error } = await supabase.from("qc_desvios").insert(payload);
      if (error) throw error;
      toast.success("Desvio registrado");

      if (form.severidade === "CRITICA" && form.op_id) {
        await supabase
          .from("ordens_producao_industrial")
          .update({ status: "BLOQUEADA", updated_at: new Date().toISOString() })
          .eq("id", form.op_id)
          .in("status", ["PLANEJADA", "EM_PRODUCAO", "FINALIZADA"]);
        toast.warning("OP bloqueada automaticamente por desvio CRÍTICO.");
      }

      queryClient.invalidateQueries({ queryKey: ["qc-desvios"] });
      setNovoDesvioOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Erro ao registrar desvio");
    } finally {
      setSaving(false);
    }
  };

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
        actions={<Button onClick={() => setNovoDesvioOpen(true)}><Plus className="h-4 w-4 mr-2" />Novo Desvio</Button>}
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

      <Dialog open={novoDesvioOpen} onOpenChange={setNovoDesvioOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Desvio</DialogTitle>
            <DialogDescription>Registrar nova não-conformidade</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROCESSO">Processo</SelectItem>
                  <SelectItem value="PRODUTO">Produto</SelectItem>
                  <SelectItem value="EQUIPAMENTO">Equipamento</SelectItem>
                  <SelectItem value="AMBIENTAL">Ambiental</SelectItem>
                  <SelectItem value="FORNECEDOR">Fornecedor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Severidade</Label>
              <Select value={form.severidade} onValueChange={(v) => setForm({ ...form, severidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CRITICA">Crítica</SelectItem>
                  <SelectItem value="ALTA">Alta</SelectItem>
                  <SelectItem value="MEDIA">Média</SelectItem>
                  <SelectItem value="BAIXA">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descrição *</Label>
              <Textarea
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Descreva o desvio observado..."
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>Fase Detectada</Label>
              <Select value={form.fase_detectada} onValueChange={(v) => setForm({ ...form, fase_detectada: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="RECEBIMENTO">Recebimento</SelectItem>
                  <SelectItem value="PESAGEM">Pesagem</SelectItem>
                  <SelectItem value="PRODUCAO">Produção</SelectItem>
                  <SelectItem value="EMBALAGEM">Embalagem</SelectItem>
                  <SelectItem value="EXPEDICAO">Expedição</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Produto Afetado</Label>
              <Input
                value={form.produto_afetado}
                onChange={(e) => setForm({ ...form, produto_afetado: e.target.value })}
                placeholder="Nome ou SKU"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Lote Afetado</Label>
              <Input
                value={form.lote_afetado}
                onChange={(e) => setForm({ ...form, lote_afetado: e.target.value })}
                placeholder="Número do lote"
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Ordem de Produção (opcional)</Label>
              <Select
                value={form.op_id || "none"}
                onValueChange={(v) => setForm({ ...form, op_id: v === "none" ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Vincular a uma OP ativa..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  {opsAtivas.map((op) => (
                    <SelectItem key={op.id} value={op.id}>
                      {op.codigo} — {op.produto_nome || "Sem produto"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.severidade === "CRITICA" && form.op_id && (
                <p className="text-xs text-destructive">
                  ⚠ Esta OP será BLOQUEADA automaticamente ao registrar o desvio.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoDesvioOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving}>{saving ? "Salvando..." : "Registrar Desvio"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
