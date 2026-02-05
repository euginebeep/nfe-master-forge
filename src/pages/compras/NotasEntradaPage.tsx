import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Eye, Package, Calendar, Building2, DollarSign, ChevronDown, ChevronUp } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNotasEntrada, NotaEntrada, useNotaEntradaItems } from "@/hooks/use-notas-entrada";
import { formatCurrency, formatDate } from "@/lib/nfe-parser";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "muted"> = {
  IMPORTADA: "success",
  PROCESSADA: "success",
  CANCELADA: "muted",
};

export default function NotasEntradaPage() {
  const navigate = useNavigate();
  const { data: notas, isLoading } = useNotasEntrada();
  const [selectedNota, setSelectedNota] = useState<NotaEntrada | null>(null);

  const columns = [
    {
      key: "numero",
      header: "Número",
      sortable: true,
      render: (item: NotaEntrada) => (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-medium">{item.numero}</span>
          <span className="text-muted-foreground text-sm">Série {item.serie}</span>
        </div>
      ),
    },
    {
      key: "dh_emissao",
      header: "Emissão",
      sortable: true,
      render: (item: NotaEntrada) => (
        <div className="flex items-center gap-2 text-sm">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {formatDate(item.dh_emissao)}
        </div>
      ),
    },
    {
      key: "fornecedor_razao",
      header: "Fornecedor",
      render: (item: NotaEntrada) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="font-medium text-sm">{item.fornecedor_razao || "-"}</p>
            <p className="text-xs text-muted-foreground font-mono">{item.fornecedor_cnpj}</p>
          </div>
        </div>
      ),
    },
    {
      key: "total_nota",
      header: "Total",
      render: (item: NotaEntrada) => (
        <div className="flex items-center gap-2">
          <DollarSign className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{formatCurrency(item.total_nota)}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: NotaEntrada) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status]}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-20",
      render: (item: NotaEntrada) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNota(item);
          }}
        >
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Notas de Entrada"
        description="Histórico de notas fiscais importadas"
        icon={FileText}
        actions={
          <Button onClick={() => navigate("/compras/importar-nfe")}>
            Importar NF-e
          </Button>
        }
      />

      {notas.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma Nota Importada</h3>
            <p className="text-muted-foreground mb-4">
              Importe notas fiscais XML na seção "Importar NF-e" para visualizá-las aqui.
            </p>
            <Button onClick={() => navigate("/compras/importar-nfe")}>
              Importar NF-e
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable
          data={notas}
          columns={columns}
          loading={isLoading}
          searchable
          searchPlaceholder="Buscar por número, fornecedor ou chave..."
          searchKeys={["numero", "fornecedor_razao", "fornecedor_cnpj", "chave_nfe"]}
          onRowClick={(item) => setSelectedNota(item)}
          emptyMessage="Nenhuma nota encontrada"
        />
      )}

      {/* Detail Dialog */}
      <NotaDetailDialog
        nota={selectedNota}
        open={!!selectedNota}
        onOpenChange={(open) => !open && setSelectedNota(null)}
      />
    </div>
  );
}

function NotaDetailDialog({
  nota,
  open,
  onOpenChange,
}: {
  nota: NotaEntrada | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { items } = useNotaEntradaItems(nota?.id);
  const [showChave, setShowChave] = useState(false);

  if (!nota) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            NF-e {nota.numero} - Série {nota.serie}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Modelo</p>
              <p className="font-medium">{nota.modelo}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Emissão</p>
              <p className="font-medium">{formatDate(nota.dh_emissao)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total Produtos</p>
              <p className="font-medium">{formatCurrency(nota.total_produtos)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Total NF-e</p>
              <p className="font-semibold text-primary">{formatCurrency(nota.total_nota)}</p>
            </div>
          </div>

          {/* Chave Collapsible */}
          <Collapsible open={showChave} onOpenChange={setShowChave}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-between">
                <span className="text-muted-foreground">Chave de Acesso</span>
                {showChave ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="font-mono text-xs bg-muted p-2 rounded break-all">
                {nota.chave_nfe}
              </p>
            </CollapsibleContent>
          </Collapsible>

          {/* Fornecedor */}
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Fornecedor</span>
            </div>
            <p className="font-medium">{nota.fornecedor_razao}</p>
            <p className="text-sm text-muted-foreground font-mono">{nota.fornecedor_cnpj}</p>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">Itens ({items.length})</span>
            </div>
            
            {items.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-4">
                Nenhum item registrado para esta nota
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={item.id} className="p-3 border rounded-lg text-sm">
                    <div className="flex justify-between items-start mb-1">
                      <span className="text-muted-foreground">#{idx + 1}</span>
                      <span className="font-medium">{formatCurrency(item.vprod)}</span>
                    </div>
                    <p className="font-medium mb-1">{item.descricao}</p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>Cód: {item.codigo_fornecedor}</span>
                      <span>Qtd: {item.qcom} {item.ucom}</span>
                      <span>Unit: {formatCurrency(item.vuncom)}</span>
                      {item.ncm && <span>NCM: {item.ncm}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Status */}
          <div className="flex justify-between items-center pt-4 border-t">
            <StatusBadge variant={STATUS_VARIANTS[nota.status]}>
              {nota.status}
            </StatusBadge>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
