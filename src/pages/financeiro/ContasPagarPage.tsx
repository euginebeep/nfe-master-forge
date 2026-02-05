import { useState } from "react";
import { DollarSign, Plus, Search, Filter, Calendar } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";

export default function ContasPagarPage() {
  const [search, setSearch] = useState("");

  // Placeholder data
  const contas = [
    { id: "1", fornecedor: "Fornecedor ABC", descricao: "NF 12345", valor: 5000, vencimento: "2024-01-20", status: "PENDENTE" },
    { id: "2", fornecedor: "Distribuidora XYZ", descricao: "NF 67890", valor: 12500, vencimento: "2024-01-15", status: "VENCIDA" },
    { id: "3", fornecedor: "Industria 123", descricao: "NF 11111", valor: 3200, vencimento: "2024-01-10", status: "PAGA" },
  ];

  const totais = {
    pendente: contas.filter(c => c.status === "PENDENTE").reduce((acc, c) => acc + c.valor, 0),
    vencida: contas.filter(c => c.status === "VENCIDA").reduce((acc, c) => acc + c.valor, 0),
    paga: contas.filter(c => c.status === "PAGA").reduce((acc, c) => acc + c.valor, 0),
  };

  const columns = [
    { key: "fornecedor", header: "Fornecedor", sortable: true },
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
          item.status === "PAGA" ? "success" : 
          item.status === "VENCIDA" ? "error" : "warning"
        }>
          {item.status}
        </StatusBadge>
      )
    },
  ];

  return (
    <div>
      <PageHeader
        title="Contas a Pagar"
        description="Gestao de obrigacoes financeiras"
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
            <p className="text-xs text-muted-foreground uppercase mb-1">Pendente</p>
            <p className="text-2xl font-bold text-warning">
              R$ {totais.pendente.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Vencida</p>
            <p className="text-2xl font-bold text-destructive">
              R$ {totais.vencida.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Paga (Mes)</p>
            <p className="text-2xl font-bold text-success">
              R$ {totais.paga.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={contas}
        columns={columns}
        searchable
        searchPlaceholder="Buscar conta..."
        searchKeys={["fornecedor", "descricao"]}
        emptyMessage="Nenhuma conta a pagar cadastrada"
      />
    </div>
  );
}
