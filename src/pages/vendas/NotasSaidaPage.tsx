import { useState, useMemo } from "react";
import { FileOutput, Search, Plus, Eye, FileText, DollarSign, CheckCircle, XCircle, Clock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  RASCUNHO: { label: "Rascunho", color: "bg-muted text-muted-foreground", icon: Clock },
  AUTORIZADA: { label: "Autorizada", color: "bg-success text-success-foreground", icon: CheckCircle },
  CANCELADA: { label: "Cancelada", color: "bg-destructive text-destructive-foreground", icon: XCircle },
  DENEGADA: { label: "Denegada", color: "bg-warning text-warning-foreground", icon: XCircle },
};

export default function NotasSaidaPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: notas, isLoading } = useQuery({
    queryKey: ["notas-saida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_saida")
        .select("*, entidades(razao_social, nome_fantasia)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["entidades-clientes-nfs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento")
        .eq("status", "ATIVO")
        .order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const criarNota = useMutation({
    mutationFn: async (formData: any) => {
      const { error } = await supabase.from("notas_saida").insert({
        cliente_id: formData.cliente_id,
        natureza_operacao: formData.natureza_operacao || "VENDA",
        valor_total: Number(formData.valor_total) || 0,
        status: "RASCUNHO",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("Nota de saída criada como rascunho");
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const filtered = useMemo(() => {
    if (!notas) return [];
    let result = notas;
    if (statusFilter !== "TODOS") {
      result = result.filter((n: any) => n.status === statusFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((n: any) =>
        n.entidades?.razao_social?.toLowerCase().includes(s) ||
        String(n.numero || "").includes(s) ||
        n.chave_acesso?.includes(s)
      );
    }
    return result;
  }, [notas, search, statusFilter]);

  const kpis = useMemo(() => {
    if (!notas) return { total: 0, rascunhos: 0, autorizadas: 0, valorTotal: 0 };
    return {
      total: notas.length,
      rascunhos: notas.filter((n: any) => n.status === "RASCUNHO").length,
      autorizadas: notas.filter((n: any) => n.status === "AUTORIZADA").length,
      valorTotal: notas.filter((n: any) => n.status === "AUTORIZADA").reduce((s: number, n: any) => s + Number(n.valor_total || 0), 0),
    };
  }, [notas]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    criarNota.mutate({
      cliente_id: fd.get("cliente_id"),
      natureza_operacao: fd.get("natureza_operacao"),
      valor_total: fd.get("valor_total"),
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas de Saída"
        description="Emissão e consulta de NF-e de saída (vendas)"
        icon={FileOutput}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{kpis.total}</p>
              <p className="text-xs text-muted-foreground">Total de Notas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{kpis.rascunhos}</p>
              <p className="text-xs text-muted-foreground">Rascunhos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold">{kpis.autorizadas}</p>
              <p className="text-xs text-muted-foreground">Autorizadas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-info" />
            <div>
              <p className="text-2xl font-bold">R$ {kpis.valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-muted-foreground">Faturado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por cliente, número ou chave..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os Status</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="AUTORIZADA">Autorizada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Nota
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileOutput className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma nota de saída encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emissão</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((nota: any) => {
                  const cfg = STATUS_CONFIG[nota.status] || STATUS_CONFIG.RASCUNHO;
                  return (
                    <TableRow key={nota.id}>
                      <TableCell className="font-mono">{nota.numero || "—"}</TableCell>
                      <TableCell className="font-medium">{nota.entidades?.razao_social || nota.entidades?.nome_fantasia || "—"}</TableCell>
                      <TableCell>{nota.natureza_operacao || "VENDA"}</TableCell>
                      <TableCell className="text-right font-mono">R$ {Number(nota.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge className={cfg.color}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {nota.data_emissao ? new Date(nota.data_emissao).toLocaleDateString("pt-BR") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Nota de Saída</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Cliente</Label>
              <Select name="cliente_id" required>
                <SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger>
                <SelectContent>
                  {clientes?.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.razao_social} — {c.documento}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Natureza da Operação</Label>
              <Select name="natureza_operacao" defaultValue="VENDA">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="VENDA">Venda</SelectItem>
                  <SelectItem value="DEVOLUCAO">Devolução</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                  <SelectItem value="REMESSA">Remessa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor Total (R$)</Label>
              <Input name="valor_total" type="number" step="0.01" required placeholder="0,00" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={criarNota.isPending}>Criar Rascunho</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}