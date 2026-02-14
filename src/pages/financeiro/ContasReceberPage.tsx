import { DollarSign, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useContasReceber } from "@/hooks/use-contas-receber";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ContasReceberPage() {
  const { contas, isLoading } = useContasReceber();

  const fmtMoeda = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const totais = {
    pendente: contas.filter(c => c.status === "PENDENTE").reduce((a, c) => a + Number(c.valor), 0),
    vencido: contas.filter(c => c.status === "VENCIDO" || (c.status === "PENDENTE" && new Date(c.data_vencimento) < new Date())).reduce((a, c) => a + Number(c.valor) - Number(c.valor_pago), 0),
    pago: contas.filter(c => c.status === "PAGO").reduce((a, c) => a + Number(c.valor_pago), 0),
  };

  const getStatusVariant = (status: string, vencimento: string) => {
    if (status === "PAGO") return "success";
    if (status === "VENCIDO" || (status === "PENDENTE" && new Date(vencimento) < new Date())) return "error";
    if (status === "PARCIAL") return "warning";
    return "info";
  };

  const columns = [
    {
      key: "cliente", header: "Cliente", sortable: true,
      render: (item: typeof contas[0]) => <span className="font-medium text-sm">{item.cliente?.razao_social || '-'}</span>
    },
    { key: "descricao", header: "Descrição" },
    {
      key: "valor", header: "Valor",
      render: (item: typeof contas[0]) => <span className="font-medium">{fmtMoeda(item.valor)}</span>
    },
    {
      key: "valor_pago", header: "Pago",
      render: (item: typeof contas[0]) => <span className="text-sm text-muted-foreground">{fmtMoeda(item.valor_pago)}</span>
    },
    {
      key: "data_vencimento", header: "Vencimento", sortable: true,
      render: (item: typeof contas[0]) => (
        <span className="text-sm">{format(new Date(item.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}</span>
      )
    },
    {
      key: "status", header: "Status",
      render: (item: typeof contas[0]) => (
        <StatusBadge variant={getStatusVariant(item.status, item.data_vencimento)}>
          {item.status === "PENDENTE" && new Date(item.data_vencimento) < new Date() ? "VENCIDO" : item.status}
        </StatusBadge>
      )
    },
  ];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Contas a Receber" description="Gestão de recebíveis e cobranças" icon={DollarSign} />
        <SkeletonTable rows={6} columns={5} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Contas a Receber"
        description="Gestão de recebíveis e cobranças"
        icon={DollarSign}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">A Receber</p>
          <p className="text-2xl font-bold text-blue-600">{fmtMoeda(totais.pendente)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Em Atraso</p>
          <p className="text-2xl font-bold text-destructive">{fmtMoeda(totais.vencido)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Recebido</p>
          <p className="text-2xl font-bold text-emerald-600">{fmtMoeda(totais.pago)}</p>
        </CardContent></Card>
      </div>

      {contas.length === 0 ? (
        <EmptyState icon={DollarSign} title="Nenhuma conta a receber" description="Registre cobranças para acompanhar seus recebíveis." />
      ) : (
        <DataTable
          data={contas}
          columns={columns}
          searchable
          searchPlaceholder="Buscar conta..."
          searchKeys={["descricao"]}
          emptyMessage="Nenhuma conta encontrada"
        />
      )}
    </div>
  );
}
