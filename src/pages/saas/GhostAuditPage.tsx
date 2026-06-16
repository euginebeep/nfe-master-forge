import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ghost, RefreshCw, AlertTriangle } from "lucide-react";
import { isSuperDev, readGhostAudit } from "@/lib/ghost-mode";
import { format } from "date-fns";

interface GhostRow {
  id: string;
  user_id: string;
  target_company_id: string | null;
  acao: string;
  payload: any;
  created_at: string;
}

export default function GhostAuditPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<GhostRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { isSuperDev().then(setAllowed); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const data = await readGhostAudit({ limit: 500 });
      setRows(data as GhostRow[]);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (allowed) load(); }, [allowed]);

  if (allowed === null) return <div className="p-6 text-sm text-muted-foreground">Verificando…</div>;
  if (!allowed) return (
    <div className="p-6 flex items-center gap-2 text-destructive">
      <AlertTriangle className="h-4 w-4" /> Acesso restrito.
    </div>
  );

  return (
    <div className="p-6 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2"><Ghost className="h-5 w-5" /> Log oculto — modo fantasma</CardTitle>
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Recarregar
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Quando</TableHead>
                <TableHead className="text-xs">Ação</TableHead>
                <TableHead className="text-xs">Tenant alvo</TableHead>
                <TableHead className="text-xs">Payload</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs whitespace-nowrap">{format(new Date(r.created_at), "dd/MM/yy HH:mm:ss")}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{r.acao}</Badge></TableCell>
                  <TableCell className="text-[10px] font-mono">{r.target_company_id?.slice(0, 8) || "—"}</TableCell>
                  <TableCell><pre className="text-[10px] max-w-md overflow-auto bg-muted/30 p-1 rounded">{JSON.stringify(r.payload, null, 0)}</pre></TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-8">Nenhum registro.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}