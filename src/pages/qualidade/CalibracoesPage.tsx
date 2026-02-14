import { useState } from "react";
import { Settings, Plus, Search, AlertTriangle, CheckCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQCCalibracoes } from "@/hooks/use-qc";
import { format, differenceInDays } from "date-fns";

export default function CalibracoesPage() {
  const { data: calibracoes, isLoading, criar } = useQCCalibracoes();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    equipamento: "",
    codigo_equipamento: "",
    tipo_calibracao: "INTERNA",
    data_calibracao: format(new Date(), "yyyy-MM-dd"),
    proxima_calibracao: "",
    responsavel: "",
    status: "CALIBRADO",
  });

  const handleSave = () => {
    if (!form.equipamento || !form.proxima_calibracao) return;
    criar.mutate(form as any);
    setDialogOpen(false);
    setForm({ equipamento: "", codigo_equipamento: "", tipo_calibracao: "INTERNA", data_calibracao: format(new Date(), "yyyy-MM-dd"), proxima_calibracao: "", responsavel: "", status: "CALIBRADO" });
  };

  const filtered = (calibracoes || []).filter(c =>
    c.equipamento.toLowerCase().includes(search.toLowerCase()) ||
    c.codigo_equipamento.toLowerCase().includes(search.toLowerCase())
  );

  const hoje = new Date();
  const stats = {
    total: calibracoes?.length || 0,
    vencidas: calibracoes?.filter(c => new Date(c.proxima_calibracao) < hoje).length || 0,
    vencer30d: calibracoes?.filter(c => {
      const d = differenceInDays(new Date(c.proxima_calibracao), hoje);
      return d >= 0 && d <= 30;
    }).length || 0,
    ok: calibracoes?.filter(c => differenceInDays(new Date(c.proxima_calibracao), hoje) > 30).length || 0,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calibrações de Equipamentos"
        description="Gestão de calibrações e manutenção preventiva"
        icon={Settings}
        actions={<Button onClick={() => setDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Nova Calibração</Button>}
      />

      <div className="grid grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 text-center"><div className="text-2xl font-bold">{stats.total}</div><p className="text-xs text-muted-foreground">Equipamentos</p></CardContent></Card>
        <Card className="border-success/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-success">{stats.ok}</div><p className="text-xs text-muted-foreground">Em Dia</p></CardContent></Card>
        <Card className="border-warning/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-warning">{stats.vencer30d}</div><p className="text-xs text-muted-foreground">Vence em 30d</p></CardContent></Card>
        <Card className="border-destructive/30"><CardContent className="pt-4 text-center"><div className="text-2xl font-bold text-destructive">{stats.vencidas}</div><p className="text-xs text-muted-foreground">Vencidas</p></CardContent></Card>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar equipamento..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipamento</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Última Calibração</TableHead>
              <TableHead>Próxima</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Responsável</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma calibração encontrada</TableCell></TableRow>
            ) : filtered.map(c => {
              const diasRestantes = differenceInDays(new Date(c.proxima_calibracao), hoje);
              const vencida = diasRestantes < 0;
              const alerta = diasRestantes >= 0 && diasRestantes <= 30;
              return (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.equipamento}</TableCell>
                  <TableCell className="font-mono">{c.codigo_equipamento}</TableCell>
                  <TableCell>{c.tipo_calibracao}</TableCell>
                  <TableCell>{format(new Date(c.data_calibracao), "dd/MM/yyyy")}</TableCell>
                  <TableCell>
                    <span className={vencida ? "text-destructive font-medium" : alerta ? "text-warning font-medium" : ""}>
                      {format(new Date(c.proxima_calibracao), "dd/MM/yyyy")}
                      {vencida && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={vencida ? "error" : alerta ? "warning" : "success"}>
                      {vencida ? "VENCIDA" : alerta ? "ALERTA" : "OK"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{c.responsavel || "-"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Calibração</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Equipamento *</Label><Input value={form.equipamento} onChange={e => setForm(f => ({ ...f, equipamento: e.target.value }))} placeholder="ex: Balança Analítica" /></div>
              <div><Label>Código *</Label><Input value={form.codigo_equipamento} onChange={e => setForm(f => ({ ...f, codigo_equipamento: e.target.value }))} placeholder="ex: BAL-001" /></div>
            </div>
            <div><Label>Tipo</Label>
              <Select value={form.tipo_calibracao} onValueChange={v => setForm(f => ({ ...f, tipo_calibracao: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INTERNA">Interna</SelectItem>
                  <SelectItem value="EXTERNA">Externa (Laboratório)</SelectItem>
                  <SelectItem value="VERIFICACAO">Verificação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Data Calibração</Label><Input type="date" value={form.data_calibracao} onChange={e => setForm(f => ({ ...f, data_calibracao: e.target.value }))} /></div>
              <div><Label>Próxima Calibração *</Label><Input type="date" value={form.proxima_calibracao} onChange={e => setForm(f => ({ ...f, proxima_calibracao: e.target.value }))} /></div>
            </div>
            <div><Label>Responsável</Label><Input value={form.responsavel} onChange={e => setForm(f => ({ ...f, responsavel: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.equipamento || !form.proxima_calibracao}>Registrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
