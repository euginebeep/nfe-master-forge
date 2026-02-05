import { format } from "date-fns";
import { History, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { AuditLog } from "@/types/erp";

interface AuditoriaTabProps {
  eventos: AuditLog[];
  isLoading?: boolean;
}

const ACAO_LABELS: Record<string, { label: string; variant: "success" | "warning" | "error" | "info" | "muted" }> = {
  CREATE: { label: 'Criação', variant: 'success' },
  UPDATE: { label: 'Alteração', variant: 'warning' },
  DELETE: { label: 'Exclusão', variant: 'error' },
  IMPORT_XML: { label: 'Importação XML', variant: 'info' },
  STATUS_CHANGE: { label: 'Mudança de Status', variant: 'muted' },
};

export function AuditoriaTab({ eventos, isLoading }: AuditoriaTabProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Carregando histórico...
      </div>
    );
  }

  if (!eventos || eventos.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground border rounded-md">
        <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
        <p>Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Histórico de Alterações</h3>
      
      <div className="space-y-2">
        {eventos.map((evento) => {
          const acaoInfo = ACAO_LABELS[evento.acao] || { label: evento.acao, variant: 'muted' as const };
          const isExpanded = expandedIds.has(evento.id);
          
          return (
            <Collapsible key={evento.id} open={isExpanded} onOpenChange={() => toggleExpand(evento.id)}>
              <div className="border rounded-md">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center justify-between p-3 hover:bg-muted/50">
                    <div className="flex items-center gap-3">
                      <StatusBadge variant={acaoInfo.variant}>
                        {acaoInfo.label}
                      </StatusBadge>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(evento.created_at), 'dd/MM/yyyy HH:mm:ss')}
                      </span>
                    </div>
                    {evento.payload && (
                      isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />
                    )}
                  </div>
                </CollapsibleTrigger>
                
                {evento.payload && (
                  <CollapsibleContent>
                    <div className="px-3 pb-3">
                      <pre className="bg-muted/50 p-3 rounded text-xs overflow-x-auto max-h-64">
                        {JSON.stringify(evento.payload, null, 2)}
                      </pre>
                    </div>
                  </CollapsibleContent>
                )}
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
