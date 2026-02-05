import { ShoppingCart, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";

export default function PedidosPage() {
  // Placeholder data
  const pedidos = [
    { id: "PED-2024-001", cliente: "Cliente Premium", data: "2024-01-15", valor: 8500, status: "APROVADO", itens: 5 },
    { id: "PED-2024-002", cliente: "Loja Natural", data: "2024-01-16", valor: 4200, status: "PENDENTE", itens: 3 },
    { id: "PED-2024-003", cliente: "Farmacia Saude", data: "2024-01-14", valor: 15000, status: "ENVIADO", itens: 12 },
    { id: "PED-2024-004", cliente: "Academia Fitness", data: "2024-01-13", valor: 2800, status: "ENTREGUE", itens: 2 },
  ];

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "APROVADO": return "info";
      case "PENDENTE": return "warning";
      case "ENVIADO": return "default";
      case "ENTREGUE": return "success";
      default: return "muted";
    }
  };

  const columns = [
    { key: "id", header: "Pedido", sortable: true },
    { key: "cliente", header: "Cliente", sortable: true },
    { key: "data", header: "Data", sortable: true },
    { key: "itens", header: "Itens" },
    { 
      key: "valor", 
      header: "Valor", 
      render: (item: any) => `R$ ${item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
    },
    { 
      key: "status", 
      header: "Status", 
      render: (item: any) => (
        <StatusBadge variant={getStatusVariant(item.status) as any}>
          {item.status}
        </StatusBadge>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Pedidos de Venda"
        description="Gestao de pedidos e entregas"
        icon={ShoppingCart}
        actions={
          <Button className="bg-secondary hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Pedido
          </Button>
        }
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Pendentes</p>
            <p className="text-2xl font-bold text-warning">
              {pedidos.filter(p => p.status === "PENDENTE").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Aprovados</p>
            <p className="text-2xl font-bold text-info">
              {pedidos.filter(p => p.status === "APROVADO").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Enviados</p>
            <p className="text-2xl font-bold">
              {pedidos.filter(p => p.status === "ENVIADO").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Entregues (Mes)</p>
            <p className="text-2xl font-bold text-success">
              {pedidos.filter(p => p.status === "ENTREGUE").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={pedidos}
        columns={columns}
        searchable
        searchPlaceholder="Buscar pedido..."
        searchKeys={["id", "cliente"]}
        emptyMessage="Nenhum pedido cadastrado"
      />
    </div>
  );
}
