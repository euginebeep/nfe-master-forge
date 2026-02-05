import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Filter, Eye, Upload, CheckCircle, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLotes } from "@/hooks/use-lotes";
import { formatDate, formatNumber } from "@/lib/formatters";
import type { StatusLote } from "@/types/erp";

const STATUS_VARIANTS: Record<StatusLote, "success" | "warning" | "error" | "muted"> = {
  QUARENTENA: "warning",
  DISPONIVEL: "success",
  BLOQUEADO: "error",
  VENCIDO: "error",
};

export default function LotesListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: lotes = [], isLoading } = useLotes({
    status: statusFilter !== "all" ? (statusFilter as StatusLote) : undefined,
  });

  const columns = [
    {
      key: "numero_lote",
      header: "Lote",
      sortable: true,
      render: (item: any) => (
        <span className="font-mono font-medium">{item.numero_lote}</span>
      ),
    },
    {
      key: "item",
      header: "Item",
      render: (item: any) => (
        <div>
          <p className="font-medium">{item.item?.descricao_interna}</p>
          <p className="text-sm text-muted-foreground font-mono">{item.item?.sku_interno}</p>
        </div>
      ),
    },
    {
      key: "fornecedor",
      header: "Fornecedor",
      render: (item: any) => item.fornecedor?.razao_social || "-",
    },
    {
      key: "quantidade_interna",
      header: "Quantidade",
      render: (item: any) => (
        <span>
          {formatNumber(item.quantidade_interna, 2)} {item.item?.unidade_interna || item.unidade_original}
        </span>
      ),
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
      key: "status",
      header: "Status",
      render: (item: any) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status as StatusLote]}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "documentos",
      header: "COA",
      render: (item: any) => {
        const hasCOA = item.lote_documentos?.some((d: any) => d.tipo_documento === "COA");
        const coaValidado = item.lote_documentos?.some(
          (d: any) => d.tipo_documento === "COA" && d.status_validacao === "VALIDADO"
        );
        if (coaValidado) {
          return <CheckCircle className="h-4 w-4 text-success" />;
        }
        if (hasCOA) {
          return <AlertCircle className="h-4 w-4 text-warning" />;
        }
        return <span className="text-muted-foreground">-</span>;
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (item: any) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/estoque/lotes/${item.id}`);
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
        title="Lotes de Estoque"
        description="Controle de lotes, validade e documentos de qualidade"
        icon={Boxes}
      />

      <DataTable
        data={lotes}
        columns={columns}
        loading={isLoading}
        searchable
        searchPlaceholder="Buscar por lote, item ou fornecedor..."
        searchKeys={["numero_lote"]}
        onRowClick={(item) => navigate(`/estoque/lotes/${item.id}`)}
        emptyMessage="Nenhum lote encontrado"
        actions={
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="QUARENTENA">Quarentena</SelectItem>
                <SelectItem value="DISPONIVEL">Disponivel</SelectItem>
                <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                <SelectItem value="VENCIDO">Vencido</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
