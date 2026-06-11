import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, RefreshCw, Search, AlertTriangle, ShieldCheck, User, Database, Loader2, QrCode } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface AuditRow {
  id: string;
  acao: string;
  entidade: string | null;
  user_id: string | null;
  user_email: string | null;
  detalhes: any;
  severidade: string | null;
  created_at: string;
}

const SEV_META: Record<string, { cls: string; icon: any }> = {
  CRITICAL: { cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  ERROR: { cls: "bg-destructive/10 text-destructive border-destructive/30", icon: AlertTriangle },
  WARN: { cls: "bg-warning/10 text-warning border-warning/30", icon: AlertTriangle },
  INFO: { cls: "bg-info/10 text-info border-info/30", icon: ShieldCheck },
  DEFAULT: { cls: "bg-muted text-muted-foreground border-border", icon: Database },
};

export function LogsPanel() {
  const [search, setSearch] = useState("");
  const [sevFilter, setSevFilter] = useState("todos");
  const [qrSearch, setQrSearch] = useState("");

  const { data: qrLogs, isLoading: qrLoading } = useQuery({
    queryKey: ["qr-audit-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .eq("acao", "QR_CODE_NOT_FOUND")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    }
  });

  const exportQrLogs = () => {
    if (!qrLogs) return;
    const csv = [
      ["Data", "Tenant", "Hash", "Erro", "Plataforma", "UserAgent"],
      ...qrLogs.map(l => {
        const payload = l.payload as any;
        return [
          l.created_at,
          l.company_id,
          payload?.hash,
          payload?.error,
          payload?.platform,
          payload?.userAgent
        ];
      })
    ].map(e => e.join(",")).join("\n");

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qr_audit_logs_${new Date().toISOString()}.csv`;
    a.click();
  };

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["saas-audit-logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("audit_trail_imutavel")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.warn("Logs query error:", error.message);
        return [] as AuditRow[];
      }
      return (data || []) as AuditRow[];
    },
    refetchInterval: 30000,
  });

  const rows = (data || []).filter((r) => {
    if (sevFilter !== "todos" && (r.severidade || "INFO").toUpperCase() !== sevFilter) return false;
    if (search) {
      const hay = `${r.acao} ${r.entidade || ""} ${r.user_email || ""}`.toLowerCase();
      if (!hay.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const stats = {
    total: data?.length || 0,
    critical: data?.filter((r) => ["CRITICAL", "ERROR"].includes((r.severidade || "").toUpperCase())).length || 0,
    warn: data?.filter((r) => (r.severidade || "").toUpperCase() === "WARN").length || 0,
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="imutavel">
        <TabsList className="bg-white p-1 h-10 shadow-sm border border-border/50 mb-4">
          <TabsTrigger value="imutavel" className="gap-2"><Activity className="h-4 w-4" /> Auditoria Imutável</TabsTrigger>
          <TabsTrigger value="qr_codes" className="gap-2"><QrCode className="h-4 w-4" /> Falhas QR Code</TabsTrigger>
        </TabsList>

        <TabsContent value="imutavel">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Eventos (últimos 200)</p>
                  <p className="text-2xl font-black mt-1">{stats.total}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Críticos</p>
                  <p className="text-2xl font-black mt-1 text-destructive">{stats.critical}</p>
                </CardContent>
              </Card>
              <Card className="border-none shadow-sm">
                <CardContent className="pt-6">
                  <p className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Alertas</p>
                  <p className="text-2xl font-black mt-1 text-warning">{stats.warn}</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-sm">
              <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" /> Trilha de Auditoria Imutável
                </CardTitle>
                <div className="flex gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Ação, email, entidade..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 w-64 h-9"
                    />
                  </div>
                  <Select value={sevFilter} onValueChange={setSevFilter}>
                    <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todas severidades</SelectItem>
                      <SelectItem value="CRITICAL">Crítico</SelectItem>
                      <SelectItem value="ERROR">Erro</SelectItem>
                      <SelectItem value="WARN">Alerta</SelectItem>
                      <SelectItem value="INFO">Info</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
                ) : rows.length === 0 ? (
                  <div className="py-20 text-center text-muted-foreground">
                    <Activity className="mx-auto h-12 w-12 opacity-20 mb-4" />
                    <p className="text-sm">Nenhum evento registrado ainda.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-32">Quando</TableHead>
                        <TableHead className="w-24">Sev.</TableHead>
                        <TableHead>Ação</TableHead>
                        <TableHead>Entidade</TableHead>
                        <TableHead>Usuário</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((r) => {
                        const sev = (r.severidade || "INFO").toUpperCase();
                        const meta = SEV_META[sev] || SEV_META.DEFAULT;
                        const Icon = meta.icon;
                        return (
                          <TableRow key={r.id} className="hover:bg-muted/30">
                            <TableCell className="text-xs font-mono text-muted-foreground">
                              {format(new Date(r.created_at), "dd/MM HH:mm:ss")}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={cn("text-[10px] font-bold", meta.cls)}>
                                <Icon className="h-2.5 w-2.5 mr-1" /> {sev}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs font-bold">{r.acao}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.entidade || "—"}</TableCell>
                            <TableCell className="text-xs">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3 w-3 text-muted-foreground" />
                                {r.user_email || r.user_id?.slice(0, 8) || "sistema"}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="qr_codes">
          <Card className="border-none shadow-sm">
            <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" /> Falhas de Consulta de QR Code
              </CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por CID ou Lote..."
                    value={qrSearch}
                    onChange={(e) => setQrSearch(e.target.value)}
                    className="pl-9 w-64 h-9"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={exportQrLogs}>
                  Exportar CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {qrLoading ? (
                <div className="py-20 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" /></div>
              ) : (qrLogs || []).length === 0 ? (
                <div className="py-20 text-center text-muted-foreground">
                  <p>Nenhuma falha de QR Code registrada.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tenant (CID)</TableHead>
                      <TableHead>Lote/Hash</TableHead>
                      <TableHead>Erro</TableHead>
                      <TableHead>IP/UserAgent</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(qrLogs || [])
                      .filter(l => {
                        const payload = l.payload as any;
                        const match = `${l.company_id} ${payload?.hash}`.toLowerCase();
                        return match.includes(qrSearch.toLowerCase());
                      })
                      .map((l) => {
                        const payload = l.payload as any;
                        return (
                          <TableRow key={l.id}>
                            <TableCell className="text-xs">
                              {format(new Date(l.created_at), "dd/MM/yyyy HH:mm:ss")}
                            </TableCell>
                            <TableCell className="text-xs font-bold">{l.company_id || 'Global'}</TableCell>
                            <TableCell className="text-xs font-mono">{payload?.hash}</TableCell>
                            <TableCell className="text-xs text-destructive">{payload?.error}</TableCell>
                            <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={payload?.userAgent}>
                              {payload?.userAgent}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
