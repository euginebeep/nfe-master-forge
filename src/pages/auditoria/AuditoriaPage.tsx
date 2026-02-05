import { useState } from "react";
import { Shield, Search, Filter, User, Calendar, FileText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";

export default function AuditoriaPage() {
  // Placeholder data - audit log
  const logs = [
    { id: "1", usuario: "admin", acao: "CREATE", entidade: "Produto", detalhes: "Criado produto 'Vitamina D3'", data: "2024-01-15 14:32:00" },
    { id: "2", usuario: "producao", acao: "UPDATE", entidade: "OP", detalhes: "Atualizado status OP-2024-001", data: "2024-01-15 14:25:00" },
    { id: "3", usuario: "fiscal", acao: "IMPORT", entidade: "NF-e", detalhes: "Importada NF 12345", data: "2024-01-15 14:10:00" },
    { id: "4", usuario: "admin", acao: "DELETE", entidade: "Contato", detalhes: "Removido contato de Cliente XYZ", data: "2024-01-15 13:55:00" },
    { id: "5", usuario: "financeiro", acao: "UPDATE", entidade: "Conta", detalhes: "Baixa de conta a pagar #123", data: "2024-01-15 13:40:00" },
  ];

  const getAcaoVariant = (acao: string) => {
    switch (acao) {
      case "CREATE": return "success";
      case "UPDATE": return "info";
      case "DELETE": return "error";
      case "IMPORT": return "warning";
      default: return "muted";
    }
  };

  const columns = [
    { key: "data", header: "Data/Hora", sortable: true },
    { key: "usuario", header: "Usuario" },
    { 
      key: "acao", 
      header: "Acao", 
      render: (item: any) => (
        <StatusBadge variant={getAcaoVariant(item.acao) as any}>
          {item.acao}
        </StatusBadge>
      )
    },
    { key: "entidade", header: "Modulo" },
    { key: "detalhes", header: "Detalhes" },
  ];

  return (
    <div>
      <PageHeader
        title="Auditoria"
        description="Log de acoes e rastreabilidade do sistema"
        icon={Shield}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Acoes Hoje</p>
            <p className="text-2xl font-bold">{logs.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Usuarios Ativos</p>
            <p className="text-2xl font-bold">4</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Alteracoes</p>
            <p className="text-2xl font-bold text-info">
              {logs.filter(l => l.acao === "UPDATE").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase mb-1">Exclusoes</p>
            <p className="text-2xl font-bold text-destructive">
              {logs.filter(l => l.acao === "DELETE").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <DataTable
        data={logs}
        columns={columns}
        searchable
        searchPlaceholder="Buscar no log..."
        searchKeys={["usuario", "entidade", "detalhes"]}
        emptyMessage="Nenhum registro de auditoria"
      />
    </div>
  );
}
