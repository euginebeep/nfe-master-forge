import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw, ShieldAlert, History, KeyRound, ScrollText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Challenge {
  id: string;
  challenge_code: string;
  requested_by_nome: string | null;
  motivo: string;
  escopo: string[];
  status: string;
  aprovado_por_nome: string | null;
  aprovado_em: string | null;
  consumido_em: string | null;
  desbloqueio_expira_em: string | null;
  expira_em: string;
  created_at: string;
}

interface AuditEvent {
  id: string;
  tipo_evento: string;
  descricao: string;
  usuario_nome: string | null;
  ip_address: string | null;
  dados_evento: any;
  created_at: string;
  sequencia: number;
}

const STATUS_STYLE: Record<string, string> = {
  AGUARDANDO_ADMIN: "bg-info/10 text-info border-info/20",
  LIBERADO: "bg-warning/10 text-warning border-warning/20",
  CONSUMIDO: "bg-success/10 text-success border-success/20",
  EXPIRADO: "bg-muted text-muted-foreground border-border",
  CANCELADO: "bg-muted text-muted-foreground border-border",
};

const STATUS_LABEL: Record<string, string> = {
  AGUARDANDO_ADMIN: "Pendente",
  LIBERADO: "Aprovada (aguardando uso)",
  CONSUMIDO: "Consumida",
  EXPIRADO: "Expirada",
  CANCELADO: "Cancelada",
};

export default function AdminUnlockRequestsPage() {
  const [items, setItems] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("TODOS");

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFor, setAuditFor] = useState<Challenge | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from("unlock_challenges")
      .select("id, challenge_code, requested_by_nome, motivo, escopo, status, aprovado_por_nome, aprovado_em, consumido_em, desbloqueio_expira_em, expira_em, created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      setError(error.message);
      toast.error("Falha ao carregar solicitações: " + error.message);
    } else {
      setItems((data as Challenge[]) || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openAudit = async (c: Challenge) => {
    setAuditFor(c);
    setAuditOpen(true);
    setAuditLoading(true);
    setAuditEvents([]);
    const { data, error } = await supabase
      .from("audit_trail_imutavel")
      .select("id, tipo_evento, descricao, usuario_nome, ip_address, dados_evento, created_at, sequencia")
      .eq("entidade_tipo", "unlock_challenge")
      .eq("entidade_id", c.id)
      .order("sequencia", { ascending: true });
    if (error) {
      toast.error("Falha ao carregar auditoria: " + error.message);
    } else {
      setAuditEvents((data as AuditEvent[]) || []);
    }
    setAuditLoading(false);
  };

  const filtered = items.filter((c) => {
    if (filter === "TODOS") return true;
    if (filter === "PENDENTE") return c.status === "AGUARDANDO_ADMIN";
    if (filter === "APROVADA") return c.status === "LIBERADO";
    if (filter === "CONSUMIDA") return c.status === "CONSUMIDO";
    if (filter === "EXPIRADA") return ["EXPIRADO", "CANCELADO"].includes(c.status);
    return true;
  });

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Solicitações de Desbloqueio"
        description="Histórico de pedidos de liberação para operações críticas e respectivos eventos de auditoria"
        icon={ShieldAlert}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Pedidos</CardTitle>
              <CardDescription>Tudo dentro deste tenant</CardDescription>
            </div>
            <div className="flex flex-wrap gap-1 items-center">
              {["TODOS", "PENDENTE", "APROVADA", "CONSUMIDA", "EXPIRADA"].map((s) => (
                <Button
                  key={s}
                  size="sm"
                  variant={filter === s ? "default" : "outline"}
                  className="h-7 text-xs"
                  onClick={() => setFilter(s)}
                >
                  {s}
                </Button>
              ))}
              <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="h-7">
                <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <div className="py-12 px-6 text-center space-y-3">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" variant="outline" onClick={fetchData}>
                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Tentar novamente
              </Button>
            </div>
          ) : loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma solicitação encontrada</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Escopo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criada</TableHead>
                    <TableHead>Aprovada</TableHead>
                    <TableHead>Consumida</TableHead>
                    <TableHead className="text-right">Auditoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono text-xs font-semibold">{c.challenge_code}</TableCell>
                      <TableCell className="text-sm">{c.requested_by_nome ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={c.motivo}>{c.motivo}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(c.escopo || []).map((e) => (
                            <Badge key={e} variant="secondary" className="text-[10px]">{e}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${STATUS_STYLE[c.status] ?? ""}`}>
                          {STATUS_LABEL[c.status] ?? c.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.aprovado_em ? (
                          <>
                            {format(new Date(c.aprovado_em), "dd/MM HH:mm", { locale: ptBR })}
                            {c.aprovado_por_nome && <div className="text-[10px]">por {c.aprovado_por_nome}</div>}
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.consumido_em ? format(new Date(c.consumido_em), "dd/MM HH:mm", { locale: ptBR }) : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => openAudit(c)}>
                          <History className="h-3.5 w-3.5 mr-1" /> Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="h-5 w-5" />
              Auditoria — {auditFor?.challenge_code}
            </DialogTitle>
            <DialogDescription>
              Eventos imutáveis registrados para esta solicitação (hash-chained)
            </DialogDescription>
          </DialogHeader>

          {auditLoading ? (
            <div className="py-8 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : auditEvents.length === 0 ? (
            <p className="py-6 text-sm text-center text-muted-foreground">
              Nenhum evento de auditoria registrado.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {auditEvents.map((e) => (
                <div key={e.id} className="border rounded-lg p-3 text-sm bg-muted/20">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">#{e.sequencia}</Badge>
                      <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-medium">{e.tipo_evento}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(e.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.descricao}</p>
                  <div className="text-[11px] text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                    {e.usuario_nome && <span>👤 {e.usuario_nome}</span>}
                    {e.ip_address && <span>🌐 {e.ip_address}</span>}
                  </div>
                  {e.dados_evento && Object.keys(e.dados_evento || {}).length > 0 && (
                    <pre className="mt-2 text-[10px] bg-background/60 p-2 rounded border overflow-x-auto">
                      {JSON.stringify(e.dados_evento, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}