import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Eye, CheckCircle, XCircle, FileText, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useLotes, useUpdateLoteStatus } from "@/hooks/use-lotes";
import { formatDate, formatNumber, formatCurrency } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function QuarentenaPage() {
  const navigate = useNavigate();
  const { data: allLotes, isLoading } = useLotes({ status: "QUARENTENA" as any });
  const updateStatus = useUpdateLoteStatus();
  const [selectedLote, setSelectedLote] = useState<any>(null);
  const [actionType, setActionType] = useState<'liberar' | 'bloquear' | null>(null);
  const [observacoes, setObservacoes] = useState("");

  const lotes = allLotes || [];

  const handleAction = (lote: any, type: 'liberar' | 'bloquear') => {
    setSelectedLote(lote);
    setActionType(type);
    setObservacoes("");
  };

  const confirmAction = () => {
    if (!selectedLote || !actionType) return;
    const newStatus = actionType === 'liberar' ? 'DISPONIVEL' : 'BLOQUEADO';
    updateStatus.mutate(
      { id: selectedLote.id, status: newStatus as any, observacoes_qc: observacoes || undefined },
      {
        onSuccess: () => {
          toast.success(
            actionType === 'liberar'
              ? `Lote ${selectedLote.numero_lote} liberado para estoque!`
              : `Lote ${selectedLote.numero_lote} bloqueado.`
          );
          setSelectedLote(null);
          setActionType(null);
          setObservacoes("");
        },
      }
    );
  };

  const hasValidatedCOA = (lote: any) => {
    const docs = lote.lote_documentos || [];
    return docs.some((d: any) => d.tipo_documento === "COA" && d.status_validacao === "VALIDADO");
  };

  const totalLotes = lotes.length;
  const totalItens = new Set(lotes.map((l: any) => l.item_id)).size;
  const lotesComCOA = lotes.filter((l: any) => hasValidatedCOA(l)).length;
  const lotesSemCOA = totalLotes - lotesComCOA;

  const columns = [
    {
      key: "numero_lote",
      header: "Lote",
      sortable: true,
      render: (item: any) => <span className="font-mono font-medium">{item.numero_lote}</span>,
    },
    {
      key: "item",
      header: "Produto/Insumo",
      render: (item: any) => (
        <div>
          <p className="font-medium text-sm">{item.item?.descricao_interna || '-'}</p>
          <p className="text-xs text-muted-foreground font-mono">{item.item?.sku_interno}</p>
        </div>
      ),
    },
    {
      key: "nota_numero",
      header: "Nota Fiscal",
      render: (item: any) => item.nota_numero ? (
        <div className="flex items-center gap-1">
          <FileText className="h-3 w-3 text-muted-foreground" />
          <span className="font-mono text-sm">{item.nota_numero}</span>
          {item.nota_serie && <span className="text-xs text-muted-foreground">/{item.nota_serie}</span>}
        </div>
      ) : <span className="text-muted-foreground">-</span>,
    },
    {
      key: "nota_data",
      header: "Data Entrada",
      sortable: true,
      render: (item: any) => item.nota_data ? formatDate(item.nota_data) : "-",
    },
    {
      key: "quantidade_interna",
      header: "Quantidade",
      render: (item: any) => (
        <span>{formatNumber(item.quantidade_interna, 2)} {item.item?.unidade_interna || item.unidade_original}</span>
      ),
    },
    {
      key: "custo_unitario_original",
      header: "Preço Unit.",
      render: (item: any) => item.custo_unitario_original ? formatCurrency(item.custo_unitario_original) : "-",
    },
    {
      key: "data_val",
      header: "Validade",
      sortable: true,
      render: (item: any) => {
        if (!item.data_val) return "-";
        const isExpired = new Date(item.data_val) < new Date();
        const isNearExpiry = new Date(item.data_val) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        return (
          <span className={isExpired ? "text-destructive" : isNearExpiry ? "text-warning" : ""}>
            {formatDate(item.data_val)}
          </span>
        );
      },
    },
    {
      key: "coa_status",
      header: "COA",
      render: (item: any) => {
        const docs = item.lote_documentos || [];
        const hasCOA = docs.some((d: any) => d.tipo_documento === "COA");
        const coaValidado = docs.some((d: any) => d.tipo_documento === "COA" && d.status_validacao === "VALIDADO");
        if (coaValidado) return <StatusBadge variant="success"><CheckCircle className="h-3 w-3 mr-1" />Validado</StatusBadge>;
        if (hasCOA) return <StatusBadge variant="warning"><AlertTriangle className="h-3 w-3 mr-1" />Pendente</StatusBadge>;
        return <StatusBadge variant="muted">Sem COA</StatusBadge>;
      },
    },
    {
      key: "actions",
      header: "Ações",
      className: "w-32",
      render: (item: any) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); navigate(`/estoque/lotes/${item.id}`); }} title="Visualizar">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-success hover:text-success hover:bg-success/10"
            onClick={(e) => { e.stopPropagation(); handleAction(item, 'liberar'); }} title="Liberar para Estoque">
            <CheckCircle className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => { e.stopPropagation(); handleAction(item, 'bloquear'); }} title="Bloquear Lote">
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Quarentena" description="Lotes aguardando liberação para o estoque oficial" icon={ShieldAlert} />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total em Quarentena</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalLotes}</div><p className="text-xs text-muted-foreground">lotes</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Produtos Distintos</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{totalItens}</div><p className="text-xs text-muted-foreground">itens únicos</p></CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-success">Prontos p/ Liberar</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-success">{lotesComCOA}</div><p className="text-xs text-muted-foreground">com COA validado</p></CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-warning">Aguardando COA</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-warning">{lotesSemCOA}</div><p className="text-xs text-muted-foreground">sem documentação</p></CardContent>
        </Card>
      </div>

      <DataTable data={lotes} columns={columns} loading={isLoading} searchable searchPlaceholder="Buscar por lote, produto ou nota..."
        searchKeys={["numero_lote", "nota_numero"]} onRowClick={(item) => navigate(`/estoque/lotes/${item.id}`)} emptyMessage="Nenhum lote em quarentena" />

      <Dialog open={!!selectedLote && !!actionType} onOpenChange={() => { setSelectedLote(null); setActionType(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'liberar' ? 'Liberar Lote para Estoque' : 'Bloquear Lote'}</DialogTitle>
            <DialogDescription>
              {actionType === 'liberar' ? 'Este lote será movido para o estoque oficial e ficará disponível para uso.' : 'Este lote será bloqueado e não poderá ser utilizado.'}
            </DialogDescription>
          </DialogHeader>
          {selectedLote && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Lote:</span><span className="font-mono font-medium">{selectedLote.numero_lote}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Produto:</span><span className="font-medium">{selectedLote.item?.descricao_interna}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Quantidade:</span><span>{formatNumber(selectedLote.quantidade_interna, 2)} {selectedLote.item?.unidade_interna || selectedLote.unidade_original}</span></div>
                {!hasValidatedCOA(selectedLote) && actionType === 'liberar' && (
                  <div className="flex items-center gap-2 text-warning mt-2 p-2 bg-warning/10 rounded">
                    <AlertTriangle className="h-4 w-4" /><span className="text-sm">Este lote não possui COA validado</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Observações (opcional)</label>
                <Textarea placeholder="Motivo da liberação/bloqueio..." value={observacoes} onChange={(e) => setObservacoes(e.target.value)} rows={3} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSelectedLote(null); setActionType(null); }}>Cancelar</Button>
            <Button variant={actionType === 'liberar' ? 'default' : 'destructive'} onClick={confirmAction} disabled={updateStatus.isPending}>
              {actionType === 'liberar' ? 'Confirmar Liberação' : 'Confirmar Bloqueio'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
