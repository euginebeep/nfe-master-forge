import { useMemo, useState } from "react";
import { ClipboardList, Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw, Filter, Search, Activity } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useEstoqueMovimentacoes } from "@/hooks/use-estoque-movimentacoes";
import { NovaMovimentacaoDialog } from "@/components/estoque/NovaMovimentacaoDialog";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export default function MovimentacoesPage() {
  const { movimentacoes, isLoading } = useEstoqueMovimentacoes();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [filtroPeriodo, setFiltroPeriodo] = useState<string>("30");
  const [busca, setBusca] = useState("");

  const filtered = useMemo(() => {
    const agora = new Date();
    const dias = filtroPeriodo === "0" ? null : Number(filtroPeriodo);
    const limite = dias !== null ? new Date(agora.getTime() - dias * 86400000) : null;
    const q = busca.trim().toLowerCase();
    return movimentacoes.filter((m) => {
      if (filtroTipo !== "TODOS" && m.tipo !== filtroTipo) return false;
      if (limite && new Date(m.created_at) < limite) return false;
      if (filtroPeriodo === "0") {
        // Hoje
        const d = new Date(m.created_at);
        if (d.toDateString() !== agora.toDateString()) return false;
      }
      if (q) {
        const hay = `${m.item?.descricao_interna || ""} ${m.item?.sku_interno || ""} ${m.lote?.numero_lote || ""} ${m.motivo || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movimentacoes, filtroTipo, filtroPeriodo, busca]);

  const getTipoVariant = (tipo: string) => {
    switch (tipo) {
      case 'ENTRADA': return 'success';
      case 'SAIDA': case 'CONSUMO_OP': return 'error';
      case 'AJUSTE': return 'warning';
      case 'TRANSFERENCIA': return 'info';
      default: return 'muted';
    }
  };

  const getTipoIcon = (tipo: string) => {
    if (tipo === 'ENTRADA' || tipo === 'DEVOLUCAO') return <ArrowUpCircle className="h-4 w-4 text-emerald-500" />;
    if (tipo === 'SAIDA' || tipo === 'CONSUMO_OP') return <ArrowDownCircle className="h-4 w-4 text-red-500" />;
    return <RefreshCw className="h-4 w-4 text-amber-500" />;
  };

  const totais = useMemo(() => {
    const inicioMes = new Date();
    inicioMes.setDate(1);
    inicioMes.setHours(0, 0, 0, 0);
    const doMes = movimentacoes.filter((m) => new Date(m.created_at) >= inicioMes);
    return {
      entradas: doMes.filter((m) => m.tipo === "ENTRADA" || m.tipo === "DEVOLUCAO").length,
      saidas: doMes.filter((m) => m.tipo === "SAIDA" || m.tipo === "CONSUMO_OP").length,
      ajustes: doMes.filter((m) => m.tipo === "AJUSTE" || m.tipo === "TRANSFERENCIA").length,
      total: movimentacoes.length,
    };
  }, [movimentacoes]);

  const columns = [
    {
      key: "tipo",
      header: "Tipo",
      render: (item: typeof movimentacoes[0]) => (
        <div className="flex items-center gap-2">
          {getTipoIcon(item.tipo)}
          <StatusBadge variant={getTipoVariant(item.tipo)}>{item.tipo}</StatusBadge>
        </div>
      ),
    },
    {
      key: "item",
      header: "Item",
      render: (item: typeof movimentacoes[0]) => (
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{item.item?.descricao_interna || '-'}</p>
          <p className="text-xs text-muted-foreground">{item.item?.sku_interno || ''}</p>
        </div>
      ),
    },
    {
      key: "lote",
      header: "Lote",
      render: (item: typeof movimentacoes[0]) => (
        <span className="text-sm font-mono">{item.lote?.numero_lote || '-'}</span>
      ),
    },
    {
      key: "quantidade",
      header: "Quantidade",
      render: (item: typeof movimentacoes[0]) => (
        <span className={`text-sm font-semibold ${item.tipo === 'SAIDA' || item.tipo === 'CONSUMO_OP' ? 'text-destructive' : 'text-emerald-600'}`}>
          {item.tipo === 'SAIDA' || item.tipo === 'CONSUMO_OP' ? '-' : '+'}
          {Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {item.unidade}
        </span>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      render: (item: typeof movimentacoes[0]) => (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">{item.motivo}</span>
      ),
    },
    {
      key: "origem",
      header: "Origem",
      render: (item: typeof movimentacoes[0]) => (
        <StatusBadge variant={item.origem === 'NFE' ? 'info' : item.origem === 'OP' ? 'warning' : 'muted'}>
          {item.origem || 'MANUAL'}
        </StatusBadge>
      ),
    },
    {
      key: "created_at",
      header: "Data",
      render: (item: typeof movimentacoes[0]) => (
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </span>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Movimentações de Estoque" description="Histórico de entradas, saídas e transferências" icon={ClipboardList} />
        <SkeletonTable rows={8} columns={6} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Movimentações de Estoque"
        description="Histórico completo de entradas, saídas, ajustes e consumo em OPs"
        icon={ClipboardList}
        actions={
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            Nova Movimentação
          </Button>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Entradas (mês)</p>
            </div>
            <p className="text-2xl font-bold">{totais.entradas}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Saídas (mês)</p>
            </div>
            <p className="text-2xl font-bold">{totais.saidas}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ajustes (mês)</p>
            </div>
            <p className="text-2xl font-bold">{totais.ajustes}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
            </div>
            <p className="text-2xl font-bold">{totais.total}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar item, lote ou motivo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODOS">Todos os tipos</SelectItem>
              <SelectItem value="ENTRADA">Entrada</SelectItem>
              <SelectItem value="SAIDA">Saída</SelectItem>
              <SelectItem value="CONSUMO_OP">Consumo OP</SelectItem>
              <SelectItem value="AJUSTE">Ajuste</SelectItem>
              <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
              <SelectItem value="DEVOLUCAO">Devolução</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={filtroPeriodo} onValueChange={setFiltroPeriodo}>
          <SelectTrigger className="w-[150px] h-9">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">Hoje</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="365">Último ano</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground ml-auto">
          {filtered.length} movimentação(ões) encontrada(s)
        </p>
      </div>

      {movimentacoes.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma movimentação registrada"
          description="As movimentações são registradas automaticamente ao importar NF-e ou consumir em OPs. Você também pode registrar manualmente."
          actionLabel="Registrar Movimentação"
          onAction={() => setDialogOpen(true)}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              Movimentações ({filtered.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={filtered}
              columns={columns}
              searchable
              searchPlaceholder="Buscar por item, motivo..."
              searchKeys={["motivo", "origem"]}
              emptyMessage="Nenhuma movimentação encontrada com este filtro"
            />
          </CardContent>
        </Card>
      )}

      <NovaMovimentacaoDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
