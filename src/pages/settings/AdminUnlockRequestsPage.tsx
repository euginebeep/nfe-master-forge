import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, RefreshCw, ShieldAlert, History, KeyRound, ScrollText,
  Search, ChevronLeft, ChevronRight, Check, X, CheckCheck, Copy, Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/edge-invoke";
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

const PAGE_SIZE = 25;

const STATUS_MAP_FILTER: Record<string, string[]> = {
  PENDENTE: ["AGUARDANDO_ADMIN"],
  APROVADA: ["LIBERADO"],
  CONSUMIDA: ["CONSUMIDO"],
  EXPIRADA: ["EXPIRADO", "CANCELADO"],
};

export default function AdminUnlockRequestsPage() {
  const [items, setItems] = useState<Challenge[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("TODOS");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [auditOpen, setAuditOpen] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFor, setAuditFor] = useState<Challenge | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  // Action dialogs
  const [approving, setApproving] = useState<Challenge | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<Challenge | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [marking, setMarking] = useState<Challenge | null>(null);
  const [markLoading, setMarkLoading] = useState(false);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput.trim()); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => { setPage(1); }, [filter]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    let q = supabase
      .from("unlock_challenges")
      .select(
        "id, challenge_code, requested_by_nome, motivo, escopo, status, aprovado_por_nome, aprovado_em, consumido_em, desbloqueio_expira_em, expira_em, created_at",
        { count: "exact" }
      )
      .order("created_at", { ascending: false });

    const statuses = STATUS_MAP_FILTER[filter];
    if (statuses) q = q.in("status", statuses);

    if (search) {
      const s = search.replace(/[%,()]/g, "");
      q = q.or(
        `challenge_code.ilike.%${s}%,requested_by_nome.ilike.%${s}%,motivo.ilike.%${s}%`
      );
    }

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const { data, error, count } = await q.range(from, to);
    if (error) {
      setError(error.message);
      toast.error("Falha ao carregar solicitações: " + error.message);
    } else {
      setItems((data as Challenge[]) || []);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [filter, search, page]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

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

  const handleApprove = async () => {
    if (!approving) return;
    setApproveLoading(true);
    setTempPassword(null);
    try {
      const { data, error } = await invokeEdge<{ temp_password: string }>("unlock-approve", {
        challenge_code: approving.challenge_code,
      });
      if (error || !data) { toast.error(error || "Falha ao aprovar"); return; }
      setTempPassword(data.temp_password);
      toast.success("Senha temporária gerada");
      fetchData();
    } finally {
      setApproveLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejecting) return;
    setRejectLoading(true);
    try {
      const { error } = await supabase
        .from("unlock_challenges")
        .update({ status: "CANCELADO" })
        .eq("id", rejecting.id)
        .in("status", ["AGUARDANDO_ADMIN", "LIBERADO"]);
      if (error) { toast.error("Falha ao rejeitar: " + error.message); return; }
      try {
        await supabase.rpc("registrar_evento_auditoria", {
          p_tipo_evento: "ACAO_UI",
          p_descricao: `Solicitação de desbloqueio rejeitada: ${rejecting.challenge_code}`,
          p_entidade_tipo: "unlock_challenge",
          p_entidade_id: rejecting.id,
          p_entidade_codigo: rejecting.challenge_code,
        });
      } catch {}
      toast.success("Solicitação rejeitada");
      setRejecting(null);
      fetchData();
    } finally {
      setRejectLoading(false);
    }
  };

  const handleMarkConsumed = async () => {
    if (!marking) return;
    setMarkLoading(true);
    try {
      const now = new Date();
      const expira = new Date(now.getTime() + 30 * 60 * 1000);
      const { error } = await supabase
        .from("unlock_challenges")
        .update({
          status: "CONSUMIDO",
          consumido_em: now.toISOString(),
          desbloqueio_expira_em: expira.toISOString(),
        })
        .eq("id", marking.id)
        .eq("status", "LIBERADO");
      if (error) { toast.error("Falha: " + error.message); return; }
      try {
        await supabase.rpc("registrar_evento_auditoria", {
          p_tipo_evento: "ACAO_UI",
          p_descricao: `Solicitação marcada como consumida manualmente: ${marking.challenge_code}`,
          p_entidade_tipo: "unlock_challenge",
          p_entidade_id: marking.id,
          p_entidade_codigo: marking.challenge_code,
        });
      } catch {}
      toast.success("Marcada como consumida");
      setMarking(null);
      fetchData();
    } finally {
      setMarkLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <PageHeader
        title="Solicitações de Desbloqueio"
        description="Histórico de pedidos de liberação para operações críticas e respectivos eventos de auditoria"
        icon={ShieldAlert}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base">Pedidos</CardTitle>
              <CardDescription>
                {total} {total === 1 ? "solicitação" : "solicitações"} — página {page} de {totalPages}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar código, solicitante, motivo…"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-8 pl-7 w-64 text-xs"
                />
              </div>
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
          ) : items.length === 0 ? (
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
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((c) => (
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
                        <div className="flex items-center justify-end gap-1">
                          {c.status === "AGUARDANDO_ADMIN" && (
                            <>
                              <Button size="sm" variant="default" className="h-7 px-2"
                                onClick={() => { setApproving(c); setTempPassword(null); }}>
                                <Check className="h-3.5 w-3.5 mr-1" /> Aprovar
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => setRejecting(c)}>
                                <X className="h-3.5 w-3.5 mr-1" /> Rejeitar
                              </Button>
                            </>
                          )}
                          {c.status === "LIBERADO" && (
                            <>
                              <Button size="sm" variant="outline" className="h-7 px-2"
                                onClick={() => setMarking(c)}>
                                <CheckCheck className="h-3.5 w-3.5 mr-1" /> Marcar usada
                              </Button>
                              <Button size="sm" variant="outline" className="h-7 px-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                                onClick={() => setRejecting(c)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => openAudit(c)}>
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {!loading && !error && items.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t text-xs">
              <span className="text-muted-foreground">
                Mostrando {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} de {total}
              </span>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" className="h-7" disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span className="px-2">{page} / {totalPages}</span>
                <Button size="sm" variant="outline" className="h-7" disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
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

      {/* Approve dialog */}
      <Dialog open={!!approving} onOpenChange={(v) => { if (!v) { setApproving(null); setTempPassword(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-warning" /> Aprovar Desbloqueio
            </DialogTitle>
            <DialogDescription>
              Gerar a senha temporária. Ela só pode ser visualizada uma vez.
            </DialogDescription>
          </DialogHeader>
          {approving && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Código</p>
                <p className="font-mono font-bold text-lg">{approving.challenge_code}</p>
              </div>
              {approving.requested_by_nome && (
                <div><span className="text-muted-foreground">Operador:</span> <strong>{approving.requested_by_nome}</strong></div>
              )}
              {approving.motivo && (
                <div><span className="text-muted-foreground">Motivo:</span> {approving.motivo}</div>
              )}
              {tempPassword ? (
                <div className="rounded-lg border-2 border-warning bg-warning/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-warning font-semibold mb-2 flex items-center justify-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Senha Temporária
                  </p>
                  <p className="text-4xl font-mono font-bold tracking-widest">{tempPassword}</p>
                  <Button variant="outline" size="sm" className="mt-3"
                    onClick={() => { navigator.clipboard.writeText(tempPassword); toast.success("Senha copiada"); }}>
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg bg-destructive/5 border border-destructive/30 p-3 text-xs text-destructive">
                  <strong>Atenção:</strong> ao confirmar, uma senha de 8 dígitos será gerada e mostrada UMA vez.
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setApproving(null); setTempPassword(null); }}>
                  {tempPassword ? "Fechar" : "Cancelar"}
                </Button>
                {!tempPassword && (
                  <Button onClick={handleApprove} disabled={approveLoading}>
                    {approveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                    Gerar senha
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejecting} onOpenChange={(v) => { if (!v) setRejecting(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <X className="h-5 w-5" /> Rejeitar solicitação
            </DialogTitle>
            <DialogDescription>
              A solicitação <strong className="font-mono">{rejecting?.challenge_code}</strong> será marcada como cancelada e não poderá mais ser usada.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={rejectLoading}>
              {rejectLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <X className="h-4 w-4 mr-2" />}
              Rejeitar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Mark consumed dialog */}
      <Dialog open={!!marking} onOpenChange={(v) => { if (!v) setMarking(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCheck className="h-5 w-5 text-success" /> Marcar como consumida
            </DialogTitle>
            <DialogDescription>
              Forçar o consumo de <strong className="font-mono">{marking?.challenge_code}</strong>. A janela de desbloqueio (30 min) será iniciada agora.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setMarking(null)}>Cancelar</Button>
            <Button onClick={handleMarkConsumed} disabled={markLoading}>
              {markLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCheck className="h-4 w-4 mr-2" />}
              Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}