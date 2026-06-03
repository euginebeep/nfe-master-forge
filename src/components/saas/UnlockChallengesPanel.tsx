import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, KeyRound, Copy, RefreshCw, Loader2, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Challenge {
  id: string;
  company_id: string;
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

const STATUS_VARIANT: Record<string, string> = {
  AGUARDANDO_ADMIN: "bg-info/10 text-info border-info/20",
  LIBERADO: "bg-warning/10 text-warning border-warning/20",
  CONSUMIDO: "bg-success/10 text-success border-success/20",
  EXPIRADO: "bg-muted text-muted-foreground border-border",
  CANCELADO: "bg-muted text-muted-foreground border-border",
};

export function UnlockChallengesPanel() {
  const [items, setItems] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("ATIVOS");

  const [approving, setApproving] = useState<Challenge | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState("");

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from("unlock_challenges")
      .select("id, company_id, challenge_code, requested_by_nome, motivo, escopo, status, aprovado_por_nome, aprovado_em, consumido_em, desbloqueio_expira_em, expira_em, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    else setItems((data as Challenge[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (code: string) => {
    setApproveLoading(true);
    setTempPassword(null);
    try {
      const { data, error } = await supabase.functions.invoke("unlock-approve", {
        body: { challenge_code: code.toUpperCase() },
      });
      if (error || data?.error) {
        toast.error(data?.error || error?.message || "Erro ao liberar");
        return;
      }
      setTempPassword(data.temp_password);
      toast.success("Senha temporária gerada");
      fetchData();
    } finally {
      setApproveLoading(false);
    }
  };

  const filtered = items.filter((c) => {
    if (statusFilter === "TODOS") return true;
    if (statusFilter === "ATIVOS") return ["AGUARDANDO_ADMIN", "LIBERADO", "CONSUMIDO"].includes(c.status);
    return c.status === statusFilter;
  });

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-destructive" />
                Desbloqueios Críticos
              </CardTitle>
              <CardDescription>
                Códigos enviados pelos operadores para liberar operações destrutivas
              </CardDescription>
            </div>
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Colar código BRX-XXXX-XXXX"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                className="h-9 w-56 font-mono uppercase"
              />
              <Button
                size="sm"
                disabled={!/^BRX-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codeInput)}
                onClick={() => {
                  const found = items.find((c) => c.challenge_code === codeInput);
                  if (found) {
                    setApproving(found);
                  } else {
                    setApproving({ challenge_code: codeInput } as any);
                  }
                }}
              >
                <KeyRound className="h-4 w-4 mr-1" /> Liberar
              </Button>
              <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
                <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              </Button>
            </div>
          </div>
          <div className="flex gap-1 mt-3 flex-wrap">
            {["ATIVOS", "AGUARDANDO_ADMIN", "LIBERADO", "CONSUMIDO", "EXPIRADO", "TODOS"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                className="h-7 text-xs"
                onClick={() => setStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">Nenhum desafio</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>Motivo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-semibold text-xs">{c.challenge_code}</TableCell>
                      <TableCell className="text-sm">{c.requested_by_nome ?? "—"}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={c.motivo}>{c.motivo}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${STATUS_VARIANT[c.status] ?? ""}`}>{c.status}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        {c.status === "AGUARDANDO_ADMIN" && (
                          <Button size="sm" onClick={() => setApproving(c)}>
                            <KeyRound className="h-3.5 w-3.5 mr-1" /> Liberar
                          </Button>
                        )}
                        {c.status === "CONSUMIDO" && c.desbloqueio_expira_em && (
                          <span className="text-xs text-success flex items-center justify-end gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            até {format(new Date(c.desbloqueio_expira_em), "HH:mm")}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!approving} onOpenChange={(v) => {
        if (!v) { setApproving(null); setTempPassword(null); setCodeInput(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-warning" />
              Liberar Desbloqueio
            </DialogTitle>
            <DialogDescription>
              Confirme os dados e gere a senha temporária. Ela só pode ser visualizada uma vez.
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
              {approving.escopo?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {approving.escopo.map((e) => <Badge key={e} variant="secondary" className="text-xs">{e}</Badge>)}
                </div>
              )}

              {tempPassword ? (
                <div className="rounded-lg border-2 border-warning bg-warning/5 p-4 text-center">
                  <p className="text-xs uppercase tracking-wider text-warning font-semibold mb-2 flex items-center justify-center gap-1">
                    <Clock className="h-3.5 w-3.5" /> Senha Temporária (única visualização)
                  </p>
                  <p className="text-4xl font-mono font-bold tracking-widest">{tempPassword}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => {
                      navigator.clipboard.writeText(tempPassword);
                      toast.success("Senha copiada — envie ao operador");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5 mr-1" /> Copiar para enviar ao operador
                  </Button>
                </div>
              ) : (
                <div className="rounded-lg bg-destructive/5 border border-destructive/30 p-3 text-xs text-destructive">
                  <strong>Atenção:</strong> ao confirmar, uma senha de 8 dígitos será gerada e mostrada UMA vez. Envie ao operador imediatamente.
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setApproving(null); setTempPassword(null); setCodeInput(""); }}>
              {tempPassword ? "Fechar" : "Cancelar"}
            </Button>
            {!tempPassword && approving && (
              <Button
                onClick={() => handleApprove(approving.challenge_code)}
                disabled={approveLoading}
              >
                {approveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <KeyRound className="h-4 w-4 mr-2" />}
                Gerar senha temporária
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}