import { useState } from "react";
import { Tag, Lock, Copy, CheckCircle2, XCircle, AlertTriangle, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  useLotesReservados, useReservarLote, useCancelarLoteReservado,
  useRegularizarLoteReservado, anoMesAtual, type LoteReservado,
} from "@/hooks/use-lotes-reservados";

export default function LotesReservadosPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    codigo_curto: "",
    ano_mes: anoMesAtual(),
    data_fabricacao: new Date().toISOString().slice(0, 10),
    descricao_produto: "",
    observacao: "",
    permitir_paralelo: false,
  });

  const { data: lotes = [], isLoading } = useLotesReservados();
  const reservar = useReservarLote();
  const cancelar = useCancelarLoteReservado();
  const regularizar = useRegularizarLoteReservado();

  const pendentes = lotes.filter(l => l.status === "PENDENTE_REGULARIZACAO");
  const consumidos = lotes.filter(l => l.status === "CONSUMIDO");
  const cancelados = lotes.filter(l => l.status === "CANCELADO");

  const handleReservar = async () => {
    const codigo = form.codigo_curto.trim().toUpperCase();
    if (!/^[A-Z0-9]{2,8}$/.test(codigo)) {
      toast.error("Código curto deve ter 2 a 8 caracteres (A-Z, 0-9)");
      return;
    }
    if (!/^\d{4}$/.test(form.ano_mes)) {
      toast.error("Ano/mês deve estar no formato AAMM (ex: 2606)");
      return;
    }
    await reservar.mutateAsync({
      codigo_curto: codigo,
      ano_mes: form.ano_mes,
      data_fabricacao: form.data_fabricacao || null,
      descricao_produto: form.descricao_produto.trim() || null,
      observacao: form.observacao.trim() || null,
      permitir_paralelo: form.permitir_paralelo,
    });
    setOpen(false);
    setForm({ ...form, codigo_curto: "", descricao_produto: "", observacao: "", permitir_paralelo: false });
  };

  const copy = (txt: string) => {
    navigator.clipboard.writeText(txt);
    toast.success("Copiado: " + txt);
  };

  const askCancelar = async (l: LoteReservado) => {
    const motivo = window.prompt(`Motivo do cancelamento de ${l.numero_completo} (mín. 5 caracteres):`);
    if (!motivo) return;
    if (motivo.trim().length < 5) { toast.error("Motivo muito curto"); return; }
    await cancelar.mutateAsync({ id: l.id, motivo: motivo.trim() });
  };

  const askRegularizar = async (l: LoteReservado) => {
    if (!window.confirm(`Marcar ${l.numero_completo} como regularizado/consumido?\n\nVocê poderá vincular ao SKU, OP ou lote definitivo depois pelo backend.`)) return;
    await regularizar.mutateAsync({ id: l.id });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lotes Reservados"
        description="Reserve números de lote oficiais (formato SKU-AAMM-NNNN-D) antes do cadastro completo do produto."
        icon={Tag}
        actions={
          <Button onClick={() => setOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Reservar lote
          </Button>
        }
      />

      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="py-4 flex items-start gap-3 text-sm">
          <Lock className="h-5 w-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Trava de regularização ativa</p>
            <p className="text-muted-foreground">
              Enquanto houver um lote <strong>pendente de regularização</strong> para o mesmo SKU+mês,
              o sistema impede a geração de um novo número. Regularize ou cancele o anterior antes de reservar outro.
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({pendentes.length})</TabsTrigger>
          <TabsTrigger value="consumidos">Regularizados ({consumidos.length})</TabsTrigger>
          <TabsTrigger value="cancelados">Cancelados ({cancelados.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="mt-4">
          <LoteList loading={isLoading} lotes={pendentes} onCopy={copy} onCancelar={askCancelar} onRegularizar={askRegularizar} />
        </TabsContent>
        <TabsContent value="consumidos" className="mt-4">
          <LoteList loading={isLoading} lotes={consumidos} onCopy={copy} />
        </TabsContent>
        <TabsContent value="cancelados" className="mt-4">
          <LoteList loading={isLoading} lotes={cancelados} onCopy={copy} />
        </TabsContent>
      </Tabs>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reservar número de lote</DialogTitle>
            <DialogDescription>
              Formato: <code>SKU-AAMM-NNNN-D</code> — ex: <code>FGAR-2606-0001-9</code>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Código curto do SKU</Label>
                <Input
                  value={form.codigo_curto}
                  onChange={(e) => setForm({ ...form, codigo_curto: e.target.value.toUpperCase().slice(0, 8) })}
                  placeholder="FGAR"
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground mt-1">2 a 8 caracteres alfanuméricos</p>
              </div>
              <div>
                <Label>Ano/Mês (AAMM)</Label>
                <Input
                  value={form.ano_mes}
                  onChange={(e) => setForm({ ...form, ano_mes: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  placeholder="2606"
                  maxLength={4}
                />
              </div>
            </div>

            <div>
              <Label>Data de fabricação</Label>
              <Input
                type="date"
                value={form.data_fabricacao}
                onChange={(e) => setForm({ ...form, data_fabricacao: e.target.value })}
              />
            </div>

            <div>
              <Label>Descrição do produto</Label>
              <Input
                value={form.descricao_produto}
                onChange={(e) => setForm({ ...form, descricao_produto: e.target.value })}
                placeholder="Feno-Grego + Arginina"
              />
            </div>

            <div>
              <Label>Observação</Label>
              <Textarea
                value={form.observacao}
                onChange={(e) => setForm({ ...form, observacao: e.target.value })}
                placeholder="Ex: produção retroativa, aguardando cadastro do SKU"
                rows={2}
              />
            </div>

            <label className="flex items-start gap-2 text-sm">
              <Checkbox
                checked={form.permitir_paralelo}
                onCheckedChange={(v) => setForm({ ...form, permitir_paralelo: !!v })}
              />
              <span>
                <strong>Forçar reserva paralela</strong> (ignora a trava de regularização)
                <span className="block text-xs text-muted-foreground">
                  Use apenas se duas bateladas distintas do mesmo SKU estiverem realmente em produção simultânea no mesmo mês.
                </span>
              </span>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleReservar} disabled={reservar.isPending}>
              {reservar.isPending ? "Reservando..." : "Reservar lote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LoteList({
  loading, lotes, onCopy, onCancelar, onRegularizar,
}: {
  loading: boolean;
  lotes: LoteReservado[];
  onCopy: (s: string) => void;
  onCancelar?: (l: LoteReservado) => void;
  onRegularizar?: (l: LoteReservado) => void;
}) {
  if (loading) return <p className="text-sm text-muted-foreground">Carregando...</p>;
  if (lotes.length === 0)
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Nenhum lote nesta categoria.
      </CardContent></Card>
    );

  return (
    <div className="grid gap-3">
      {lotes.map((l) => (
        <Card key={l.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  {l.numero_completo}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onCopy(l.numero_completo)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </CardTitle>
                <CardDescription>
                  {l.descricao_produto || <span className="italic">Sem descrição</span>}
                </CardDescription>
              </div>
              <StatusBadge status={l.status} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <Field label="SKU" value={l.codigo_curto} />
              <Field label="Safra" value={l.ano_mes} />
              <Field label="Sequência" value={String(l.sequencia).padStart(4, "0")} />
              <Field label="DV (módulo 11)" value={String(l.digito_verificador)} />
              <Field label="Data fabricação" value={l.data_fabricacao ? new Date(l.data_fabricacao + "T00:00").toLocaleDateString("pt-BR") : "—"} />
              <Field label="Reservado em" value={new Date(l.created_at).toLocaleString("pt-BR")} />
              {l.regularizado_em && <Field label="Regularizado em" value={new Date(l.regularizado_em).toLocaleString("pt-BR")} />}
              {l.cancelado_em && <Field label="Cancelado em" value={new Date(l.cancelado_em).toLocaleString("pt-BR")} />}
            </div>
            {l.observacao && <p className="text-xs text-muted-foreground italic">"{l.observacao}"</p>}
            {l.cancelado_motivo && (
              <p className="text-xs flex items-start gap-1 text-destructive">
                <AlertTriangle className="h-3 w-3 mt-0.5" /> Motivo do cancelamento: {l.cancelado_motivo}
              </p>
            )}

            {(onCancelar || onRegularizar) && (
              <div className="flex gap-2 pt-2">
                {onRegularizar && (
                  <Button size="sm" variant="default" className="gap-1" onClick={() => onRegularizar(l)}>
                    <CheckCircle2 className="h-4 w-4" /> Regularizar
                  </Button>
                )}
                {onCancelar && (
                  <Button size="sm" variant="outline" className="gap-1" onClick={() => onCancelar(l)}>
                    <XCircle className="h-4 w-4" /> Cancelar reserva
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: LoteReservado["status"] }) {
  if (status === "PENDENTE_REGULARIZACAO")
    return <Badge variant="outline" className="border-warning text-warning gap-1"><Lock className="h-3 w-3" /> Pendente</Badge>;
  if (status === "CONSUMIDO")
    return <Badge variant="outline" className="border-success text-success gap-1"><CheckCircle2 className="h-3 w-3" /> Regularizado</Badge>;
  return <Badge variant="outline" className="border-destructive text-destructive gap-1"><XCircle className="h-3 w-3" /> Cancelado</Badge>;
}