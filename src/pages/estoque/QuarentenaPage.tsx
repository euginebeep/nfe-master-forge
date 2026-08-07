import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert, Eye, CheckCircle, Trash2, FileText, AlertTriangle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate, formatCurrency, formatQtdLote, diasAteValidade } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function QuarentenaPage() {
  const navigate = useNavigate();
  const { data: companyId } = useUserCompanyId();
  const queryClient = useQueryClient();
  const [selectedLote, setSelectedLote] = useState<any>(null);
  const [actionType, setActionType] = useState<'liberar' | 'descartar' | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: lotes = [], isLoading } = useQuery({
    queryKey: ['quarentena-lotes', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estoque_lotes')
        .select(`
          *,
          item:itens(descricao_interna, sku_interno, unidade_interna),
          fornecedor:entidades(razao_social),
          nota_item:notas_entrada_itens (
            nota:notas_entrada (numero, serie, dh_emissao)
          ),
          lote_documentos(tipo_documento, status_validacao)
        `)
        .eq('company_id', companyId!)
        .in('status', ['QUARENTENA', 'BLOQUEADO'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).map((l: any) => ({
        ...l,
        nota_numero: l.nota_item?.nota?.numero ?? null,
        nota_serie: l.nota_item?.nota?.serie ?? null,
        nota_data: l.nota_item?.nota?.dh_emissao ?? null,
      }));
    },
  });

  const liberarLote = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from('estoque_lotes')
        .update({ status: 'DISPONIVEL', observacoes_qc: motivo } as any)
        .eq('id', id).eq('company_id', companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarentena-lotes'] });
      toast.success('Lote liberado para uso');
      closeDialog();
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const descartarLote = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase
        .from('estoque_lotes')
        .update({ status: 'BLOQUEADO', observacoes_qc: `DESCARTE: ${motivo}` } as any)
        .eq('id', id).eq('company_id', companyId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quarentena-lotes'] });
      toast.success('Lote bloqueado para descarte');
      closeDialog();
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });

  const closeDialog = () => {
    setSelectedLote(null);
    setActionType(null);
    setMotivo("");
  };

  const handleAction = (lote: any, type: 'liberar' | 'descartar') => {
    setSelectedLote(lote);
    setActionType(type);
    setMotivo("");
  };

  const confirmAction = () => {
    if (!selectedLote || !actionType) return;
    if (!motivo.trim()) {
      toast.error('Motivo é obrigatório');
      return;
    }
    const fn = actionType === 'liberar' ? liberarLote : descartarLote;
    fn.mutate({ id: selectedLote.id, motivo: motivo.trim() });
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
        <span>{formatQtdLote(item.quantidade_interna, item.unidade_interna)} {item.unidade_interna || "—"}</span>
      ),
    },
    {
      key: "custo_unitario_interno",
      header: "Preço Unit.",
      render: (item: any) => item.custo_unitario_interno ? (
        <span>
          {formatCurrency(item.custo_unitario_interno)}
          {item.unidade_interna && (
            <span className="text-xs text-muted-foreground">/{item.unidade_interna}</span>
          )}
        </span>
      ) : <span className="text-muted-foreground">-</span>,
    },
    {
      key: "data_val",
      header: "Validade",
      sortable: true,
      render: (item: any) => {
        if (!item.data_val) return "-";
        const dias = diasAteValidade(item.data_val);
        const isExpired = dias != null && dias < 0;
        const isNearExpiry = dias != null && dias >= 0 && dias <= 30;
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
            onClick={(e) => { e.stopPropagation(); handleAction(item, 'descartar'); }} title="Descartar Lote">
            <Trash2 className="h-4 w-4" />
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

      {!isLoading && lotes.length === 0 ? (
        <EmptyState
          icon={CheckCircle}
          title="Nenhum lote em quarentena"
          description="Todos os lotes estão disponíveis ou descartados."
        />
      ) : (
        <DataTable data={lotes} columns={columns} loading={isLoading} searchable
          searchPlaceholder="Buscar por lote, produto ou nota..."
          searchKeys={["numero_lote", "nota_numero"]}
          onRowClick={(item) => navigate(`/estoque/lotes/${item.id}`)}
          emptyMessage="Nenhum lote encontrado" />
      )}

      <Dialog open={!!selectedLote && !!actionType} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionType === 'liberar' ? 'Liberar Lote para Estoque' : 'Descartar Lote'}</DialogTitle>
            <DialogDescription>
              {actionType === 'liberar' ? 'Este lote será movido para o estoque oficial e ficará disponível para uso.' : 'Este lote será marcado como descartado e removido da quarentena.'}
            </DialogDescription>
          </DialogHeader>
          {selectedLote && (
            <div className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Lote:</span><span className="font-mono font-medium">{selectedLote.numero_lote}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Produto:</span><span className="font-medium">{selectedLote.item?.descricao_interna}</span></div>
                <div className="flex justify-between"><span className="text-sm text-muted-foreground">Quantidade:</span><span>{formatQtdLote(selectedLote.quantidade_interna, selectedLote.item?.unidade_interna || selectedLote.unidade_original)} {selectedLote.item?.unidade_interna || selectedLote.unidade_original}</span></div>
                {!hasValidatedCOA(selectedLote) && actionType === 'liberar' && (
                  <div className="flex items-center gap-2 text-warning mt-2 p-2 bg-warning/10 rounded">
                    <AlertTriangle className="h-4 w-4" /><span className="text-sm">Este lote não possui COA validado</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Motivo <span className="text-destructive">*</span></label>
                <Textarea placeholder={actionType === 'liberar' ? 'Ex: COA validado, conforme especificação' : 'Ex: Fora de especificação, vencido, contaminação'}
                  value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} required />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button variant={actionType === 'liberar' ? 'default' : 'destructive'} onClick={confirmAction}
              disabled={liberarLote.isPending || descartarLote.isPending || !motivo.trim()}>
              {actionType === 'liberar' ? 'Confirmar Liberação' : 'Confirmar Descarte'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
