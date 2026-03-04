import { useState, useEffect } from "react";
import { ScrollText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StatusBadge } from "@/components/ui/status-badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AuditEntry {
  id: string;
  tipo_evento: string;
  descricao: string;
  entidade_tipo: string;
  entidade_codigo: string | null;
  created_at: string;
  ip_address: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
}

const eventVariant = (tipo: string): "default" | "success" | "warning" | "error" | "info" | "muted" => {
  if (tipo.includes("EXCLUSAO") || tipo.includes("DELETE")) return "error";
  if (tipo.includes("CRIACAO") || tipo.includes("INSERT")) return "success";
  if (tipo.includes("EDICAO") || tipo.includes("UPDATE")) return "warning";
  if (tipo.includes("LOGIN") || tipo.includes("ACESSO")) return "info";
  return "muted";
};

export function UserActivityLogDialog({ open, onOpenChange, userId, userName }: Props) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);
    supabase
      .from("audit_trail_imutavel")
      .select("id, tipo_evento, descricao, entidade_tipo, entidade_codigo, created_at, ip_address")
      .eq("usuario_id", userId)
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setLogs((data as AuditEntry[]) || []);
        setLoading(false);
      });
  }, [open, userId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Log de Atividades — {userName}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Nenhuma atividade registrada.</p>
        ) : (
          <ScrollArea className="h-[55vh]">
            <div className="space-y-2 pr-4">
              {logs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <StatusBadge variant={eventVariant(log.tipo_evento)}>
                        {log.tipo_evento.replace(/_/g, " ")}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {log.entidade_tipo}
                        {log.entidade_codigo && ` · ${log.entidade_codigo}`}
                      </span>
                    </div>
                    <p className="text-sm truncate">{log.descricao}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
                      </span>
                      {log.ip_address && (
                        <span className="text-xs text-muted-foreground">IP: {log.ip_address}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
