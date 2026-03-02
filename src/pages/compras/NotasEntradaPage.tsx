import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Eye, Calendar, Building2, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNotasEntrada, type NotaEntrada } from "@/hooks/use-notas-entrada";
import { formatCurrency, formatDate } from "@/lib/nfe-parser";
import { NFeVisualizacaoDialog } from "@/components/nfe/NFeVisualizacaoDialog";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "muted"> = {
  IMPORTADA: "success",
  PROCESSADA: "success",
  CANCELADA: "muted",
};

export default function NotasEntradaPage() {
  const navigate = useNavigate();
  const { data: notas = [], isLoading } = useNotasEntrada();
  const [selectedChaveNfe, setSelectedChaveNfe] = useState<string>("");
  const [showNFeDialog, setShowNFeDialog] = useState(false);

  const handleViewNota = (nota: NotaEntrada) => {
    if (nota.chave_nfe) {
      setSelectedChaveNfe(nota.chave_nfe);
      setShowNFeDialog(true);
    }
  };

  const columns = [
    {
      key: "numero",
      header: "Número",
      sortable: true,
      render: (item: NotaEntrada) => (
        <button onClick={() => handleViewNota(item)} className="flex items-center gap-2 hover:text-primary transition-colors">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono font-medium hover:underline">{item.numero}</span>
          <span className="text-muted-foreground text-sm">Série {item.serie}</span>
        </button>
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
        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleViewNota(item); }}>
          <Eye className="h-4 w-4" />
        </Button>
      ),
    },
  ];

  return (
    <div>
      <PageHeader title="Notas de Entrada" description="Histórico de notas fiscais importadas" icon={FileText}
        actions={<Button onClick={() => navigate("/compras/importar-nfe")}>Importar NF-e</Button>} />

      {notas.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma Nota Importada</h3>
            <p className="text-muted-foreground mb-4">Importe notas fiscais XML na seção "Importar NF-e" para visualizá-las aqui.</p>
            <Button onClick={() => navigate("/compras/importar-nfe")}>Importar NF-e</Button>
          </CardContent>
        </Card>
      ) : (
        <DataTable data={notas} columns={columns} loading={isLoading} searchable
          searchPlaceholder="Buscar por número, fornecedor ou chave..."
          searchKeys={["numero", "fornecedor_razao", "fornecedor_cnpj", "chave_nfe"]}
          onRowClick={(item) => handleViewNota(item)} emptyMessage="Nenhuma nota encontrada" />
      )}

      <NFeVisualizacaoDialog open={showNFeDialog} onOpenChange={setShowNFeDialog} chaveNfe={selectedChaveNfe} />
    </div>
  );
}
