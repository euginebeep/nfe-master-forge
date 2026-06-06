import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Boxes, Filter, Eye, CheckCircle, AlertCircle, FileText, Calendar, Building2, X, Package } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLotes } from "@/hooks/use-lotes";
import { AtribuirClienteWhiteLabelDialog } from "@/components/producao/AtribuirClienteWhiteLabelDialog";
import { useQueryClient } from "@tanstack/react-query";
import { formatDate, formatNumber, formatCurrency } from "@/lib/formatters";
import { differenceInDays, parseISO } from "date-fns";

type StatusLote = 'QUARENTENA' | 'DISPONIVEL' | 'BLOQUEADO' | 'VENCIDO' | 'APROVADO';

const STATUS_VARIANTS: Record<string, "success" | "warning" | "error" | "muted"> = {
  QUARENTENA: "warning",
  DISPONIVEL: "success",
  APROVADO: "success",
  BLOQUEADO: "error",
  VENCIDO: "error",
};

export default function LotesListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [notaFilter, setNotaFilter] = useState<string>("");
  const [fornecedorFilter, setFornecedorFilter] = useState<string>("all");
  const [validadeFilter, setValidadeFilter] = useState<string>("all");
  const [whiteLabelLote, setWhiteLabelLote] = useState<{loteId: string, loteNumero?: string, produtoNome?: string} | null>(null);

  const { data: allLotes, isLoading } = useLotes();

  // Extract unique fornecedores from lotes
  const fornecedores = useMemo(() => {
    if (!allLotes) return [];
    const map = new Map<string, { id: string; nome: string }>();
    allLotes.forEach(l => {
      if (l.fornecedor) {
        map.set(l.fornecedor.id, { id: l.fornecedor.id, nome: l.fornecedor.razao_social });
      }
    });
    return Array.from(map.values());
  }, [allLotes]);

  // Filter lotes
  const lotes = useMemo(() => {
    if (!allLotes) return [];
    let filtered = [...allLotes];

    if (statusFilter !== "all") {
      filtered = filtered.filter(l => l.status === statusFilter);
    }

    if (notaFilter.trim()) {
      const search = notaFilter.toLowerCase().trim();
      filtered = filtered.filter(l =>
        (l as any).nota_numero?.toLowerCase().includes(search) ||
        (l as any).nota_chave?.toLowerCase().includes(search)
      );
    }

    if (fornecedorFilter !== "all") {
      filtered = filtered.filter(l => l.fornecedor?.id === fornecedorFilter);
    }

    if (validadeFilter !== "all") {
      const today = new Date();
      filtered = filtered.filter(l => {
        if (!(l as any).data_val) return validadeFilter === "sem_validade";
        const dataVal = parseISO((l as any).data_val);
        const dias = differenceInDays(dataVal, today);
        switch (validadeFilter) {
          case "vencido": return dias < 0;
          case "30dias": return dias >= 0 && dias <= 30;
          case "60dias": return dias >= 0 && dias <= 60;
          case "90dias": return dias >= 0 && dias <= 90;
          case "ok": return dias > 90;
          case "sem_validade": return false;
          default: return true;
        }
      });
    }

    return filtered;
  }, [allLotes, statusFilter, notaFilter, fornecedorFilter, validadeFilter]);

  // Counts
  const counts = useMemo(() => {
    if (!allLotes) return { total: 0, quarentena: 0, disponivel: 0, bloqueado: 0, vencendo30: 0 };
    const today = new Date();
    return {
      total: allLotes.length,
      quarentena: allLotes.filter(l => l.status === 'QUARENTENA').length,
      disponivel: allLotes.filter(l => l.status === 'DISPONIVEL' || (l.status as string) === 'APROVADO').length,
      bloqueado: allLotes.filter(l => l.status === 'BLOQUEADO').length,
      vencendo30: allLotes.filter(l => {
        if (!(l as any).data_val) return false;
        const dias = differenceInDays(parseISO((l as any).data_val), today);
        return dias >= 0 && dias <= 30;
      }).length,
    };
  }, [allLotes]);

  const hasActiveFilters = statusFilter !== "all" || notaFilter.trim() || fornecedorFilter !== "all" || validadeFilter !== "all";

  const clearFilters = () => {
    setStatusFilter("all");
    setNotaFilter("");
    setFornecedorFilter("all");
    setValidadeFilter("all");
  };

  const columns = [
    {
      key: "numero_lote",
      header: "Lote",
      sortable: true,
      render: (item: any) => (
        <div className="flex flex-col gap-1">
          <span className="font-mono font-medium">{item.numero_lote}</span>
          {item.white_label === true && !item.white_label_cliente_id && (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] py-0 h-4">
              White Label — sem cliente
            </Badge>
          )}
          {item.white_label === true && item.white_label_cliente_id && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0 h-4">
              White Label — atribuído
            </Badge>
          )}
        </div>
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
      key: "fornecedor",
      header: "Fornecedor",
      render: (item: any) => item.fornecedor ? (
        <div className="flex items-center gap-1">
          <Building2 className="h-3 w-3 text-muted-foreground" />
          <span className="text-sm truncate max-w-[150px]">{item.fornecedor.razao_social}</span>
        </div>
      ) : <span className="text-muted-foreground">-</span>,
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
        if (!item.data_val) return <span className="text-muted-foreground">-</span>;

        const today = new Date();
        const dataVal = parseISO(item.data_val);
        const dias = differenceInDays(dataVal, today);

        let colorClass = "";
        let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline";

        if (dias < 0) {
          colorClass = "text-destructive";
          badgeVariant = "destructive";
        } else if (dias <= 30) {
          colorClass = "text-destructive";
          badgeVariant = "destructive";
        } else if (dias <= 60) {
          colorClass = "text-warning";
        } else if (dias <= 90) {
          colorClass = "text-amber-600";
        }

        return (
          <div className="flex items-center gap-2">
            <span className={colorClass}>
              {formatDate(item.data_val)}
            </span>
            {dias <= 30 && dias >= 0 && (
              <Badge variant={badgeVariant} className="text-xs">
                {dias}d
              </Badge>
            )}
            {dias < 0 && (
              <Badge variant="destructive" className="text-xs">
                Vencido
              </Badge>
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      render: (item: any) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status] || "muted"}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "coa",
      header: "COA",
      render: (item: any) => {
        const docs = item.lote_documentos || [];
        const hasCOA = docs.some((d: any) => d.tipo_documento === "COA");
        const coaValidado = docs.some(
          (d: any) => d.tipo_documento === "COA" && d.status_validacao === "VALIDADO"
        );
        if (coaValidado) {
          return <CheckCircle className="h-4 w-4 text-emerald-500" />;
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
        <div className="flex items-center gap-1">
          {item.white_label === true && !item.white_label_cliente_id && (
            <Button
              variant="ghost"
              size="icon"
              title="Atribuir Cliente"
              onClick={(e) => {
                e.stopPropagation();
                setWhiteLabelLote({
                  loteId: item.id,
                  loteNumero: item.numero_lote,
                  produtoNome: item.item?.descricao_interna
                });
              }}
            >
              <Package className="h-4 w-4 text-primary" />
            </Button>
          )}
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
        </div>
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

      {/* Quick Stats */}
      <div className="grid grid-cols-5 gap-3 mb-6">
        <button
          onClick={() => { clearFilters(); }}
          className={`p-3 rounded-lg border text-center transition-colors ${!hasActiveFilters ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
        >
          <p className="text-2xl font-bold">{counts.total}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </button>
        <button
          onClick={() => { setStatusFilter('DISPONIVEL'); setValidadeFilter('all'); }}
          className={`p-3 rounded-lg border text-center transition-colors ${statusFilter === 'DISPONIVEL' ? 'border-emerald-500 bg-emerald-500/5' : 'hover:bg-muted/50'}`}
        >
          <p className="text-2xl font-bold text-emerald-600">{counts.disponivel}</p>
          <p className="text-xs text-muted-foreground">Disponível</p>
        </button>
        <button
          onClick={() => { setStatusFilter('QUARENTENA'); setValidadeFilter('all'); }}
          className={`p-3 rounded-lg border text-center transition-colors ${statusFilter === 'QUARENTENA' ? 'border-amber-500 bg-amber-500/5' : 'hover:bg-muted/50'}`}
        >
          <p className="text-2xl font-bold text-amber-600">{counts.quarentena}</p>
          <p className="text-xs text-muted-foreground">Quarentena</p>
        </button>
        <button
          onClick={() => { setStatusFilter('BLOQUEADO'); setValidadeFilter('all'); }}
          className={`p-3 rounded-lg border text-center transition-colors ${statusFilter === 'BLOQUEADO' ? 'border-destructive bg-destructive/5' : 'hover:bg-muted/50'}`}
        >
          <p className="text-2xl font-bold text-destructive">{counts.bloqueado}</p>
          <p className="text-xs text-muted-foreground">Bloqueado</p>
        </button>
        <button
          onClick={() => { setStatusFilter('all'); setValidadeFilter('30dias'); }}
          className={`p-3 rounded-lg border text-center transition-colors ${validadeFilter === '30dias' ? 'border-destructive bg-destructive/5' : 'hover:bg-muted/50'}`}
        >
          <p className="text-2xl font-bold text-destructive">{counts.vencendo30}</p>
          <p className="text-xs text-muted-foreground">Vence ≤30d</p>
        </button>
      </div>

      <DataTable
        data={lotes}
        columns={columns}
        loading={isLoading}
        searchable
        searchPlaceholder="Buscar por lote ou item..."
        searchKeys={["numero_lote"]}
        onRowClick={(item) => navigate(`/estoque/lotes/${item.id}`)}
        emptyMessage="Nenhum lote encontrado"
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filtrar por nota..."
                value={notaFilter}
                onChange={(e) => setNotaFilter(e.target.value)}
                className="w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="QUARENTENA">Quarentena</SelectItem>
                  <SelectItem value="DISPONIVEL">Disponível</SelectItem>
                  <SelectItem value="APROVADO">Aprovado</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                  <SelectItem value="VENCIDO">Vencido</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Fornecedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {fornecedores.map(f => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={validadeFilter} onValueChange={setValidadeFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Validade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="vencido">Vencidos</SelectItem>
                  <SelectItem value="30dias">≤ 30 dias</SelectItem>
                  <SelectItem value="60dias">≤ 60 dias</SelectItem>
                  <SelectItem value="90dias">≤ 90 dias</SelectItem>
                  <SelectItem value="ok">&gt; 90 dias</SelectItem>
                  <SelectItem value="sem_validade">Sem validade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        }
      />

      <AtribuirClienteWhiteLabelDialog 
        open={!!whiteLabelLote} 
        onOpenChange={(v) => !v && setWhiteLabelLote(null)} 
        loteId={whiteLabelLote?.loteId || ''} 
        loteNumero={whiteLabelLote?.loteNumero} 
        produtoNome={whiteLabelLote?.produtoNome} 
        onSuccess={() => { 
          setWhiteLabelLote(null); 
          queryClient.invalidateQueries({ queryKey: ['lotes'] }); 
        }} 
      />
    </div>
  );
}
