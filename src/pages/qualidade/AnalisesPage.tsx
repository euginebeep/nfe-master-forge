import { useState } from "react";
import { FlaskConical, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQCAnalises } from "@/hooks/use-qc";
import { format } from "date-fns";

export default function AnalisesPage() {
  const { data: analises, isLoading, criar } = useQCAnalises();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    lote_id: "",
    tipo_analise: "FISICO_QUIMICA",
    parametro: "",
    especificacao: "",
    resultado: "",
    status: "PENDENTE",
    observacoes: "",
  });

  const handleSave = () => {
    if (!form.parametro || !form.especificacao) return;
    criar.mutate(form as any);
    setDialogOpen(false);
    setForm({ lote_id: "", tipo_analise: "FISICO_QUIMICA", parametro: "", especificacao: "", resultado: "", status: "PENDENTE", observacoes: "" });
  };

  const filtered = (analises || []).filter(a =>
    a.parametro.toLowerCase().includes(search.toLowerCase()) ||
    a.tipo_analise.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: analises?.length || 0,
    pendentes: analises?.filter(a => a.status === "PENDENTE").length || 0,
    aprovadas: analises?.filter(a => a.status === "APROVADO").length || 0,
    reprovadas: analises?.filter(a => a.status === "REPROVADO").length || 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Análises QC"
        description="Controle de análises físico-químicas e microbiológicas"
        icon={FlaskConical}
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Análise</Button>}
      />

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
        <Card className="border-warning/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-warning">{stats.pendentes}</div><p className="text-xs text-muted-foreground">Pendentes</p></CardContent></Card>
        <Card className="border-success/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-success">{stats.aprovadas}</div><p className="text-xs text-muted-foreground">Aprovadas</p></CardContent></Card>
        <Card className="border-destructive/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-destructive">{stats.reprovadas}</div><p className="text-xs text-muted-foreground">Reprovadas</p></CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar análise..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Parâmetro</TableHead>
              <TableHead>Especificação</TableHead>
              <TableHead>Resultado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma análise encontrada</TableCell></TableRow>
            ) : filtered.map(a => (
              <TableRow key={a.id}>
                <TableCell>{a.tipo_analise.replace(/_/g, " ")}</TableCell>
                <TableCell className="font-medium">{a.parametro}</TableCell>
                <TableCell>{a.especificacao}</TableCell>
                <TableCell>{a.resultado || "-"}</TableCell>
                <TableCell>
                  <StatusBadge variant={a.status === "APROVADO" ? "success" : a.status === "REPROVADO" ? "error" : "warning"}>
                    {a.status}
                  </StatusBadge>
                </TableCell>
                <TableCell>{format(new Date(a.created_at), "dd/MM/yyyy")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Análise</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div><Label>Tipo</Label>
              <Select value={form.tipo_analise} onValueChange={v => setForm(f => ({ ...f, tipo_analise: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FISICO_QUIMICA">Físico-Química</SelectItem>
                  <SelectItem value="MICROBIOLOGICA">Microbiológica</SelectItem>
                  <SelectItem value="IDENTIFICACAO">Identificação</SelectItem>
                  <SelectItem value="ESTABILIDADE">Estabilidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Parâmetro *</Label><Input value={form.parametro} onChange={e => setForm(f => ({ ...f, parametro: e.target.value }))} placeholder="ex: Teor de Vitamina C" /></div>
            <div><Label>Especificação *</Label><Input value={form.especificacao} onChange={e => setForm(f => ({ ...f, especificacao: e.target.value }))} placeholder="ex: 90-110% do declarado" /></div>
            <div><Label>Resultado</Label><Input value={form.resultado} onChange={e => setForm(f => ({ ...f, resultado: e.target.value }))} placeholder="ex: 102%" /></div>
            <div><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.parametro || !form.especificacao}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
