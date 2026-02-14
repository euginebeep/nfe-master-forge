import { useState } from "react";
import { ClipboardList, Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useEstoqueMovimentacoes } from "@/hooks/use-estoque-movimentacoes";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function MovimentacoesPage() {
  const { movimentacoes, isLoading } = useEstoqueMovimentacoes();

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

  const totais = {
    entradas: movimentacoes.filter(m => m.tipo === 'ENTRADA' || m.tipo === 'DEVOLUCAO').length,
    saidas: movimentacoes.filter(m => m.tipo === 'SAIDA' || m.tipo === 'CONSUMO_OP').length,
    ajustes: movimentacoes.filter(m => m.tipo === 'AJUSTE' || m.tipo === 'TRANSFERENCIA').length,
  };

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
        <div>
          <p className="font-medium text-sm">{item.item?.descricao_interna || '-'}</p>
          <p className="text-xs text-muted-foreground">{item.item?.sku_interno || ''}</p>
        </div>
      ),
    },
    {
      key: "lote",
      header: "Lote",
      render: (item: typeof movimentacoes[0]) => (
        <span className="text-sm">{item.lote?.numero_lote || '-'}</span>
      ),
    },
    {
      key: "quantidade",
      header: "Quantidade",
      render: (item: typeof movimentacoes[0]) => (
        <span className={`text-sm font-medium ${item.tipo === 'SAIDA' || item.tipo === 'CONSUMO_OP' ? 'text-destructive' : 'text-emerald-600'}`}>
          {item.tipo === 'SAIDA' || item.tipo === 'CONSUMO_OP' ? '-' : '+'}
          {Number(item.quantidade).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} {item.unidade}
        </span>
      ),
    },
    {
      key: "motivo",
      header: "Motivo",
      render: (item: typeof movimentacoes[0]) => (
        <span className="text-sm">{item.motivo}</span>
      ),
    },
    {
      key: "origem",
      header: "Origem",
      render: (item: typeof movimentacoes[0]) => (
        <StatusBadge variant="muted">{item.origem || 'MANUAL'}</StatusBadge>
      ),
    },
    {
      key: "created_at",
      header: "Data",
      render: (item: typeof movimentacoes[0]) => (
        <span className="text-sm text-muted-foreground">
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
        description="Histórico de entradas, saídas e transferências"
        icon={ClipboardList}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowUpCircle className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground uppercase">Entradas</p>
            </div>
            <p className="text-2xl font-bold">{totais.entradas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <ArrowDownCircle className="h-4 w-4 text-red-500" />
              <p className="text-xs text-muted-foreground uppercase">Saídas</p>
            </div>
            <p className="text-2xl font-bold">{totais.saidas}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-1">
              <RefreshCw className="h-4 w-4 text-amber-500" />
              <p className="text-xs text-muted-foreground uppercase">Ajustes</p>
            </div>
            <p className="text-2xl font-bold">{totais.ajustes}</p>
          </CardContent>
        </Card>
      </div>

      {movimentacoes.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhuma movimentação registrada"
          description="As movimentações serão registradas automaticamente ao importar NF-e ou consumir em OPs."
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Movimentações ({movimentacoes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              data={movimentacoes}
              columns={columns}
              searchable
              searchPlaceholder="Buscar movimentação..."
              searchKeys={["motivo", "origem"]}
              emptyMessage="Nenhuma movimentação encontrada"
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
