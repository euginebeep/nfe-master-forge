import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ScrollText, Download, RefreshCw, Filter, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  useNfeAuditoria,
  useNfeAuditoriaResumo,
  type NfeAuditoriaRow,
  type EventoNfe,
} from "@/hooks/use-nfe-auditoria";

const EVENTO_LABELS: Record<EventoNfe, string> = {
  RESERVA_NUMERO: "Reserva de número",
  EMISSAO: "Emissão",
  PROTOCOLO: "Protocolo SEFAZ",
  REJEICAO: "Rejeição",
  CANCELAMENTO: "Cancelamento",
  CC_E: "Carta de correção",
  INUTILIZACAO: "Inutilização",
  REIMPRESSAO: "Reimpressão",
  PREVIEW: "Prévia",
  XML_DOWNLOAD: "Download XML",
};

const EVENTO_VARIANT: Record<EventoNfe, "default" | "secondary" | "destructive" | "outline"> = {
  RESERVA_NUMERO: "outline",
  EMISSAO: "default",
  PROTOCOLO: "default",
  REJEICAO: "destructive",
  CANCELAMENTO: "destructive",
  CC_E: "secondary",
  INUTILIZACAO: "destructive",
  REIMPRESSAO: "secondary",
  PREVIEW: "outline",
  XML_DOWNLOAD: "outline",
};

function toCsv(rows: NfeAuditoriaRow[]) {
  const header = [
    "data",
    "evento",
    "modelo",
    "serie",
    "numero",
    "chave_acesso",
    "protocolo",
    "status",
    "usuario",
    "observacao",
  ];
  const lines = rows.map((r) =>
    [
      r.created_at,
      r.evento,
      r.modelo || "",
      r.serie ?? "",
      r.numero ?? "",
      r.chave_acesso || "",
      r.protocolo || "",
      r.status || "",
      r.usuario_nome || r.usuario_id || "",
      (r.observacao || "").replace(/"/g, '""'),
    ]
      .map((v) => `"${String(v)}"`)
      .join(","),
  );
  return [header.join(","), ...lines].join("\n");
}

export default function AuditoriaFiscalPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const voltarPara = (location.state as { voltarPara?: string } | null)?.voltarPara;
  const [evento, setEvento] = useState<EventoNfe | "ALL">("ALL");
  const [modelo, setModelo] = useState<"55" | "65" | "ALL">("ALL");
  const [chave, setChave] = useState("");
  const [desde, setDesde] = useState("");
  const [detail, setDetail] = useState<NfeAuditoriaRow | null>(null);

  const { data: rows, isLoading, refetch } = useNfeAuditoria({
    evento,
    modelo,
    chave: chave || undefined,
    desde: desde || undefined,
    limit: 500,
  });
  const { data: resumo } = useNfeAuditoriaResumo();

  const items = rows || [];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of items) c[r.evento] = (c[r.evento] || 0) + 1;
    return c;
  }, [items]);

  const exportCsv = () => {
    const csv = toCsv(items);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `auditoria-fiscal-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Auditoria Fiscal"
        description="Trilha de todos os eventos fiscais: emissão, protocolo, cancelamento, CC-e, inutilização, reimpressão e prévia"
        icon={ScrollText}
        actions={
          <div className="flex gap-2">
            {voltarPara && (
              <Button variant="ghost" onClick={() => navigate(voltarPara)}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
              </Button>
            )}
            <Button variant="outline" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="h-4 w-4 mr-2" /> Exportar CSV
            </Button>
          </div>
        }
      />

      {/* Resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(Object.keys(EVENTO_LABELS) as EventoNfe[]).slice(0, 10).map((ev) => (
          <Card key={ev}>
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{EVENTO_LABELS[ev]}</p>
              <p className="text-2xl font-bold">{(resumo as any)?.[ev] ?? 0}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-end gap-2">
          <Filter className="h-4 w-4 text-muted-foreground mt-2" />
          <div className="w-44">
            <label className="text-xs text-muted-foreground">Evento</label>
            <Select value={evento} onValueChange={(v) => setEvento(v as EventoNfe | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                {(Object.keys(EVENTO_LABELS) as EventoNfe[]).map((ev) => (
                  <SelectItem key={ev} value={ev}>{EVENTO_LABELS[ev]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-32">
            <label className="text-xs text-muted-foreground">Modelo</label>
            <Select value={modelo} onValueChange={(v) => setModelo(v as "55" | "65" | "ALL")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Todos</SelectItem>
                <SelectItem value="55">NF-e (55)</SelectItem>
                <SelectItem value="65">NFC-e (65)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <label className="text-xs text-muted-foreground">Desde</label>
            <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Chave de acesso</label>
            <Input
              placeholder="44 dígitos..."
              value={chave}
              onChange={(e) => setChave(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b">
                <tr className="text-left">
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Evento</th>
                  <th className="px-3 py-2">Modelo/Série/Nº</th>
                  <th className="px-3 py-2">Chave / Protocolo</th>
                  <th className="px-3 py-2">Usuário</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      Carregando...
                    </td>
                  </tr>
                )}
                {!isLoading && items.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                      Nenhum evento encontrado com os filtros atuais.
                    </td>
                  </tr>
                )}
                {items.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/20">
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-xs">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant={EVENTO_VARIANT[r.evento]}>{EVENTO_LABELS[r.evento]}</Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {r.modelo || "—"}/{r.serie ?? "—"}/{r.numero ?? "—"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <div className="truncate max-w-[260px]">{r.chave_acesso || "—"}</div>
                      <div className="truncate max-w-[260px] text-muted-foreground">
                        {r.protocolo || ""}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">{r.usuario_nome || "—"}</td>
                    <td className="px-3 py-2 text-xs">{r.status || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                        Detalhes
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-2 text-xs text-muted-foreground border-t flex justify-between">
            <span>{items.length} evento(s)</span>
            <span>
              {Object.entries(counts)
                .map(([k, v]) => `${EVENTO_LABELS[k as EventoNfe] || k}: ${v}`)
                .join(" · ")}
            </span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalhe do evento</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><strong>Evento:</strong> {EVENTO_LABELS[detail.evento]}</div>
                <div><strong>Data:</strong> {new Date(detail.created_at).toLocaleString("pt-BR")}</div>
                <div><strong>Modelo/Série/Nº:</strong> {detail.modelo}/{detail.serie ?? "—"}/{detail.numero ?? "—"}</div>
                <div><strong>Status:</strong> {detail.status || "—"}</div>
                <div className="col-span-2"><strong>Chave:</strong> <span className="font-mono">{detail.chave_acesso || "—"}</span></div>
                <div className="col-span-2"><strong>Protocolo:</strong> {detail.protocolo || "—"}</div>
                <div><strong>Usuário:</strong> {detail.usuario_nome || "—"}</div>
                <div><strong>IP:</strong> {detail.ip_address || "—"}</div>
              </div>
              {detail.observacao && (
                <div>
                  <strong>Observação:</strong>
                  <p className="mt-1">{detail.observacao}</p>
                </div>
              )}
              <div>
                <strong>Payload:</strong>
                <pre className="mt-1 bg-muted/40 rounded p-3 text-xs overflow-auto max-h-96">
                  {JSON.stringify(detail.payload, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}