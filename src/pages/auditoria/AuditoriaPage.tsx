import { useState } from "react";
import { Shield, Search, Filter, Hash, Clock, User, FileText, Link2 } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuditTrail } from "@/hooks/use-responsaveis-tecnicos";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const TIPO_EVENTO_LABELS: Record<string, { label: string; variant: 'success' | 'info' | 'warning' | 'error' | 'muted' }> = {
  FORMULA_CRIADA: { label: 'Fórmula Criada', variant: 'success' },
  FORMULA_APROVADA: { label: 'Fórmula Aprovada', variant: 'success' },
  FORMULA_ALTERADA: { label: 'Fórmula Alterada', variant: 'info' },
  OP_CRIADA: { label: 'OP Criada', variant: 'success' },
  OP_INICIADA: { label: 'OP Iniciada', variant: 'info' },
  OP_ALTERADA: { label: 'OP Alterada', variant: 'warning' },
  OP_FINALIZADA: { label: 'OP Finalizada', variant: 'success' },
  OP_BLOQUEADA: { label: 'OP Bloqueada', variant: 'error' },
  RT_ASSINATURA: { label: 'Assinatura RT', variant: 'success' },
  LOTE_LIBERADO: { label: 'Lote Liberado', variant: 'success' },
  LOTE_BLOQUEADO: { label: 'Lote Bloqueado', variant: 'error' },
  QC_APROVADO: { label: 'QC Aprovado', variant: 'success' },
  QC_REPROVADO: { label: 'QC Reprovado', variant: 'error' },
  PESAGEM_REGISTRADA: { label: 'Pesagem', variant: 'info' },
  CHECKLIST_VERIFICADO: { label: 'Checklist', variant: 'info' },
};

export default function AuditoriaPage() {
  const { data: eventos, isLoading } = useAuditTrail();
  const [search, setSearch] = useState("");
  const [selectedEvento, setSelectedEvento] = useState<any>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filteredEventos = (eventos || []).filter(e =>
    e.descricao.toLowerCase().includes(search.toLowerCase()) ||
    e.entidade_codigo?.toLowerCase().includes(search.toLowerCase()) ||
    e.tipo_evento.toLowerCase().includes(search.toLowerCase())
  );

  // Estatísticas
  const stats = {
    total: eventos?.length || 0,
    hoje: eventos?.filter(e => {
      const hoje = new Date().toDateString();
      return new Date(e.created_at).toDateString() === hoje;
    }).length || 0,
    assinaturasRT: eventos?.filter(e => e.tipo_evento === 'RT_ASSINATURA').length || 0,
    alertas: eventos?.filter(e => 
      e.tipo_evento === 'OP_BLOQUEADA' || 
      e.tipo_evento === 'LOTE_BLOQUEADO' ||
      e.tipo_evento === 'QC_REPROVADO'
    ).length || 0,
  };

  const handleViewDetails = (evento: any) => {
    setSelectedEvento(evento);
    setDetailsOpen(true);
  };

  const columns = [
    { 
      key: "sequencia", 
      header: "#",
      render: (e: any) => (
        <span className="font-mono text-xs text-muted-foreground">
          {e.sequencia}
        </span>
      )
    },
    { 
      key: "created_at", 
      header: "Data/Hora",
      render: (e: any) => (
        <div className="text-sm">
          <p>{format(new Date(e.created_at), "dd/MM/yyyy", { locale: ptBR })}</p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(e.created_at), "HH:mm:ss")}
          </p>
        </div>
      )
    },
    { 
      key: "tipo_evento", 
      header: "Evento",
      render: (e: any) => {
        const config = TIPO_EVENTO_LABELS[e.tipo_evento] || { label: e.tipo_evento, variant: 'muted' as const };
        return (
          <StatusBadge variant={config.variant}>
            {config.label}
          </StatusBadge>
        );
      }
    },
    { 
      key: "entidade", 
      header: "Entidade",
      render: (e: any) => (
        <div>
          <p className="text-sm font-medium">{e.entidade_tipo}</p>
          {e.entidade_codigo && (
            <p className="text-xs text-muted-foreground font-mono">{e.entidade_codigo}</p>
          )}
        </div>
      )
    },
    { 
      key: "descricao", 
      header: "Descrição",
      render: (e: any) => (
        <p className="text-sm max-w-xs truncate">{e.descricao}</p>
      )
    },
    { 
      key: "usuario", 
      header: "Usuário",
      render: (e: any) => (
        <span className="text-sm">{e.usuario_nome || '-'}</span>
      )
    },
    { 
      key: "hash", 
      header: "Hash",
      render: (e: any) => (
        <Button 
          variant="ghost" 
          size="sm"
          className="font-mono text-xs"
          onClick={() => handleViewDetails(e)}
        >
          {e.hash_atual?.substring(0, 8)}...
        </Button>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Trilha de Auditoria"
        description="Registro imutável de todas as ações do sistema (ANVISA Compliance)"
        icon={Shield}
      />

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Hash className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase">Total Registros</p>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase">Hoje</p>
            </div>
            <p className="text-2xl font-bold text-info">{stats.hoje}</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="w-4 h-4 text-primary" />
              <p className="text-xs text-muted-foreground uppercase">Assinaturas RT</p>
            </div>
            <p className="text-2xl font-bold text-primary">{stats.assinaturasRT}</p>
          </CardContent>
        </Card>
        <Card className={stats.alertas > 0 ? "border-destructive" : ""}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-4 h-4 text-destructive" />
              <p className="text-xs text-muted-foreground uppercase">Bloqueios/Alertas</p>
            </div>
            <p className="text-2xl font-bold text-destructive">{stats.alertas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Informação de Imutabilidade */}
      <div className="bg-muted/50 border rounded-lg p-4 mb-6">
        <div className="flex items-start gap-3">
          <Link2 className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <p className="font-semibold">Trilha Imutável (Blockchain-like)</p>
            <p className="text-sm text-muted-foreground">
              Cada registro contém um hash SHA-256 que referencia o registro anterior, 
              formando uma cadeia inviolável. Nenhum evento pode ser alterado ou excluído após o registro.
            </p>
          </div>
        </div>
      </div>

      {/* Busca */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição, código ou tipo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabela */}
      <DataTable
        data={filteredEventos}
        columns={columns}
        emptyMessage="Nenhum registro de auditoria"
      />

      {/* Dialog de Detalhes */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Detalhes do Evento de Auditoria
            </DialogTitle>
          </DialogHeader>
          
          {selectedEvento && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Sequência</p>
                  <p className="font-mono">{selectedEvento.sequencia}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Data/Hora</p>
                  <p>{format(new Date(selectedEvento.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Tipo de Evento</p>
                  <StatusBadge variant={TIPO_EVENTO_LABELS[selectedEvento.tipo_evento]?.variant || 'muted'}>
                    {TIPO_EVENTO_LABELS[selectedEvento.tipo_evento]?.label || selectedEvento.tipo_evento}
                  </StatusBadge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase mb-1">Entidade</p>
                  <p>{selectedEvento.entidade_tipo} {selectedEvento.entidade_codigo && `(${selectedEvento.entidade_codigo})`}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase mb-1">Descrição</p>
                <p>{selectedEvento.descricao}</p>
              </div>

              {selectedEvento.usuario_nome && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">Usuário</p>
                    <p>{selectedEvento.usuario_nome}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase mb-1">IP</p>
                    <p className="font-mono text-sm">{selectedEvento.ip_address || '-'}</p>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground uppercase">Hash Atual (SHA-256)</p>
                <div className="bg-muted p-2 rounded font-mono text-xs break-all">
                  {selectedEvento.hash_atual}
                </div>
              </div>

              {selectedEvento.hash_anterior && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase">Hash Anterior</p>
                  <div className="bg-muted p-2 rounded font-mono text-xs break-all">
                    {selectedEvento.hash_anterior}
                  </div>
                </div>
              )}

              {selectedEvento.dados_evento && Object.keys(selectedEvento.dados_evento).length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground uppercase">Dados do Evento</p>
                  <ScrollArea className="h-32">
                    <pre className="bg-muted p-2 rounded text-xs overflow-auto">
                      {JSON.stringify(selectedEvento.dados_evento, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
