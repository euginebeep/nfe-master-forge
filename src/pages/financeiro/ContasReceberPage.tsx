import { useState } from "react";
import { DollarSign, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";

export default function ContasReceberPage() {
  // Placeholder data
  const contas = [
    { id: "1", cliente: "Cliente Premium", descricao: "Pedido #1234", valor: 8500, vencimento: "2024-01-25", status: "PENDENTE" },
    { id: "2", cliente: "Loja Natural", descricao: "Pedido #1235", valor: 4200, vencimento: "2024-01-18", status: "RECEBIDA" },
    { id: "3", cliente: "Farmacia Saude", descricao: "Pedido #1230", valor: 15000, vencimento: "2024-01-12", status: "ATRASADA" },
  ];

  const totais = {
    pendente: contas.filter(c => c.status === "PENDENTE").reduce((acc, c) => acc + c.valor, 0),
    atrasada: contas.filter(c => c.status === "ATRASADA").reduce((acc, c) => acc + c.valor, 0),
    recebida: contas.filter(c => c.status === "RECEBIDA").reduce((acc, c) => acc + c.valor, 0),
  };

  const columns = [
    { key: "cliente", header: "Cliente", sortable: true },
    { key: "descricao", header: "Descricao" },
    { 
      key: "valor", 
      header: "Valor", 
      render: (item: any) => `R$ ${item.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` 
    },
    { key: "vencimento", header: "Vencimento", sortable: true },
    { 
      key: "status", 
      header: "Status", 
      render: (item: any) => (
        <StatusBadge variant={
          item.status === "RECEBIDA" ? "success" : 
          item.status === "ATRASADA" ? "error" : "warning"
        }>
          {item.status}
        </StatusBadge>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Contas a Receber"
        description="Gestao de recebiveis e cobrancas"
        icon={DollarSign}
        actions={
          <Button className="bg-secondary hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">A Receber</p>
            <p className="text-2xl font-bold text-info">
              R$ {totais.pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Em Atraso</p>
            <p className="text-2xl font-bold text-destructive">
              R$ {totais.atrasada.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Recebido (Mes)</p>
            <p className="text-2xl font-bold text-success">
              R$ {totais.recebida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={contas}
        columns={columns}
        searchable
        searchPlaceholder="Buscar conta..."
        searchKeys={["cliente", "descricao"]}
        emptyMessage="Nenhuma conta a receber cadastrada"
      />
    </div>
  );
}
