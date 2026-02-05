import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Filter, Eye, CheckCircle, AlertCircle, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { LocalDb } from "@/lib/local-db";
import { formatDate, formatNumber, formatCurrency } from "@/lib/formatters";
import type { LocalEstoqueLote, LocalItem } from "@/hooks/use-local-itens";

type StatusLote = 'QUARENTENA' | 'DISPONIVEL' | 'BLOQUEADO' | 'VENCIDO';

const STATUS_VARIANTS: Record<StatusLote, "success" | "warning" | "error" | "muted"> = {
  QUARENTENA: "warning",
  DISPONIVEL: "success",
  BLOQUEADO: "error",
  VENCIDO: "error",
};

export default function LotesListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notaFilter, setNotaFilter] = useState<string>("");
  const [lotes, setLotes] = useState<(LocalEstoqueLote & { item?: LocalItem })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadLotes = () => {
      setLoading(true);
      let data = LocalDb.getCollection<LocalEstoqueLote>('estoque_lotes');
      const itens = LocalDb.getCollection<LocalItem>('itens');
      
      // Enrich with item data
      const enriched = data.map(lote => ({
        ...lote,
        item: itens.find(i => i.id === lote.item_id),
      }));

      // Apply filters
      let filtered = enriched;
      
      if (statusFilter !== "all") {
        filtered = filtered.filter(l => l.status === statusFilter);
      }
      
      if (notaFilter.trim()) {
        const search = notaFilter.toLowerCase().trim();
        filtered = filtered.filter(l => 
          l.nota_numero?.toLowerCase().includes(search) ||
          l.nota_chave?.toLowerCase().includes(search)
        );
      }

      setLotes(filtered);
      setLoading(false);
    };

    loadLotes();

    const handler = () => loadLotes();
    window.addEventListener('localdb:change', handler);
    return () => window.removeEventListener('localdb:change', handler);
  }, [statusFilter, notaFilter]);

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
        <span>
          {formatNumber(item.quantidade_interna, 2)} {item.item?.unidade_interna || item.unidade_original}
        </span>
      ),
    },
    {
      key: "custo_unitario_original",
      header: "Preço Unit.",
      render: (item: any) => item.custo_unitario_original ? 
        formatCurrency(item.custo_unitario_original) : "-",
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
      key: "coa",
      header: "COA",
      render: (item: any) => {
        const docs = LocalDb.query<any>('lote_documentos', d => d.lote_id === item.id);
        const hasCOA = docs.some((d: any) => d.tipo_documento === "COA");
        const coaValidado = docs.some(
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
        loading={loading}
        searchable
        searchPlaceholder="Buscar por lote ou item..."
        searchKeys={["numero_lote"]}
        onRowClick={(item) => navigate(`/estoque/lotes/${item.id}`)}
        emptyMessage="Nenhum lote encontrado"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nota..."
                value={notaFilter}
                onChange={(e) => setNotaFilter(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="QUARENTENA">Quarentena</SelectItem>
                  <SelectItem value="DISPONIVEL">Disponível</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                  <SelectItem value="VENCIDO">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        }
      />
    </div>
  );
}
