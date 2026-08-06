import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Scale, Search } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { fmtBRL, fmtDataHora } from "@/lib/fiscal-format";

type MultaRow = {
  id: string;
  company_id: string | null;
  nota: string | null;
  destinatario: string | null;
  valor_operacao: number | null;
  data_autorizacao: string | null;
  data_cancelamento: string | null;
  horas_decorridas: number | null;
  percentual_multa: number | null;
  multa_estimada: number | null;
  status_recolhimento: string | null;
  data_recolhimento: string | null;
  valor_recolhido: number | null;
  base_legal: string | null;
  justificativa: string | null;
  autorizado_por_nome: string | null;
  dias_desde_cancelamento: number | null;
  chave_acesso: string | null;
};

const STATUS = ["PENDENTE", "EM_ANALISE", "RECOLHIDO", "DISPENSADO"] as const;

const statusBadge = (s: string | null | undefined) => {
  const v = String(s || "PENDENTE").toUpperCase();
  if (v === "RECOLHIDO") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (v === "DISPENSADO") return "bg-slate-100 text-slate-700 border-slate-200";
  if (v === "EM_ANALISE") return "bg-blue-100 text-blue-800 border-blue-200";
  return "bg-amber-100 text-amber-900 border-amber-200";
};

export default function MultasFiscaisPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("PENDENTE");
  const [selected, setSelected] = useState<MultaRow | null>(null);
  const [novoStatus, setNovoStatus] = useState<string>("RECOLHIDO");
  const [dataRecolhimento, setDataRecolhimento] = useState(
    () => format(new Date(), "yyyy-MM-dd"),
  );
  const [valorRecolhido, setValorRecolhido] = useState("");
  const [obs, setObs] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["multas-cancelamento"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_multas_cancelamento_pendentes")
        .select("*")
        .order("data_cancelamento", { ascending: false });
      if (error) throw error;
      return (data || []) as MultaRow[];
    },
  });

  const filtradas = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      const st = String(r.status_recolhimento || "PENDENTE").toUpperCase();
      if (statusFilter !== "TODOS" && st !== statusFilter) return false;
      if (!q) return true;
      return [r.nota, r.destinatario, r.chave_acesso, r.autorizado_por_nome]
        .some((v) => String(v || "").toLowerCase().includes(q));
    });
  }, [rows, search, statusFilter]);

  const alerta30 = useMemo(
    () =>
      rows.filter(
        (r) =>
          String(r.status_recolhimento || "PENDENTE").toUpperCase() === "PENDENTE" &&
          Number(r.dias_desde_cancelamento || 0) > 30,
      ).length,
    [rows],
  );

  const atualizar = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Selecione um registro");
      if (novoStatus === "DISPENSADO" && obs.trim().length < 10) {
        throw new Error("Informe justificativa (mín. 10 caracteres) para DISPENSADO.");
      }
      const patch: Record<string, unknown> = {
        status_recolhimento: novoStatus,
        observacoes_financeiro: obs.trim() || null,
      };
      if (novoStatus === "RECOLHIDO") {
        patch.data_recolhimento = dataRecolhimento
          ? new Date(`${dataRecolhimento}T12:00:00`).toISOString()
          : new Date().toISOString();
        patch.valor_recolhido = Number(
          String(valorRecolhido).replace(",", ".") || selected.multa_estimada || 0,
        );
      }
      const { error } = await (supabase as any)
        .from("nfe_cancelamentos_extemporaneos")
        .update(patch)
        .eq("id", selected.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Registro fiscal atualizado");
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["multas-cancelamento"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Multas fiscais"
        description="Cancelamentos extemporâneos de NF-e — recolhimento e acompanhamento"
        icon={Scale}
      />

      {alerta30 > 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50/50">
          <CardContent className="py-3 flex items-start gap-3 text-sm">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <b>{alerta30}</b> multa(s) pendente(s) há mais de 30 dias desde o cancelamento.
              Verifique o recolhimento com o financeiro.
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Cancelamentos extemporâneos</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar nota, destinatário…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                {STATUS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Carregando…</p>
          ) : filtradas.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum registro neste filtro.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nota</TableHead>
                  <TableHead>Destinatário</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Cancelada</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead className="text-right">Multa</TableHead>
                  <TableHead>Autorizado por</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtradas.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.nota || "—"}</TableCell>
                    <TableCell>{r.destinatario || "—"}</TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtBRL(r.valor_operacao)}
                    </TableCell>
                    <TableCell>{fmtDataHora(r.data_cancelamento)}</TableCell>
                    <TableCell className="text-right">
                      {r.horas_decorridas != null ? `${Math.round(Number(r.horas_decorridas))}h` : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-amber-800">
                      {fmtBRL(r.multa_estimada)}
                    </TableCell>
                    <TableCell>{r.autorizado_por_nome || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadge(r.status_recolhimento)}>
                        {r.status_recolhimento || "PENDENTE"}
                      </Badge>
                      {Number(r.dias_desde_cancelamento || 0) > 30 &&
                        String(r.status_recolhimento || "PENDENTE") === "PENDENTE" && (
                          <span className="ml-1 text-[10px] text-amber-700 inline-flex items-center gap-0.5">
                            <Clock className="h-3 w-3" /> {r.dias_desde_cancelamento}d
                          </span>
                        )}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelected(r);
                          setNovoStatus(
                            String(r.status_recolhimento || "PENDENTE") === "PENDENTE"
                              ? "RECOLHIDO"
                              : String(r.status_recolhimento),
                          );
                          setValorRecolhido(
                            String(r.valor_recolhido ?? r.multa_estimada ?? ""),
                          );
                          setObs("");
                          setDataRecolhimento(
                            r.data_recolhimento
                              ? format(new Date(r.data_recolhimento), "yyyy-MM-dd")
                              : format(new Date(), "yyyy-MM-dd"),
                          );
                        }}
                      >
                        Atualizar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Registro fiscal não se apaga (DELETE revogado). Use DISPENSADO com justificativa
            quando couber.
          </p>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atualizar recolhimento — NF-e {selected?.nota}</DialogTitle>
            <DialogDescription>
              Multa estimada {fmtBRL(selected?.multa_estimada)}
              {selected?.base_legal ? ` · ${selected.base_legal}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={novoStatus} onValueChange={setNovoStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {novoStatus === "RECOLHIDO" && (
              <>
                <div>
                  <Label>Data do recolhimento</Label>
                  <Input
                    type="date"
                    value={dataRecolhimento}
                    onChange={(e) => setDataRecolhimento(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Valor recolhido (R$)</Label>
                  <Input
                    value={valorRecolhido}
                    onChange={(e) => setValorRecolhido(e.target.value)}
                  />
                </div>
              </>
            )}
            <div>
              <Label>
                Observações
                {novoStatus === "DISPENSADO" ? " (obrigatória)" : ""}
              </Label>
              <Textarea
                value={obs}
                onChange={(e) => setObs(e.target.value)}
                rows={3}
                placeholder={
                  novoStatus === "DISPENSADO"
                    ? "Justificativa da dispensa…"
                    : "Opcional"
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Fechar
            </Button>
            <Button
              disabled={atualizar.isPending}
              onClick={() => atualizar.mutate()}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {atualizar.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
