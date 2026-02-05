import { useState } from "react";
import { Shield, Plus, Search, Edit, Trash2, Key } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function UsuariosPage() {
  // Placeholder data
  const usuarios = [
    { id: "1", nome: "Administrador", email: "admin@legacy.com", perfil: "ADMIN", status: "ATIVO", ultimoAcesso: "2024-01-15 14:30" },
    { id: "2", nome: "Producao Operador", email: "producao@legacy.com", perfil: "PRODUCAO", status: "ATIVO", ultimoAcesso: "2024-01-15 13:45" },
    { id: "3", nome: "Fiscal Responsavel", email: "fiscal@legacy.com", perfil: "FISCAL", status: "ATIVO", ultimoAcesso: "2024-01-15 10:20" },
    { id: "4", nome: "Financeiro", email: "financeiro@legacy.com", perfil: "FINANCEIRO", status: "INATIVO", ultimoAcesso: "2024-01-10 09:00" },
  ];

  const perfis = [
    { nome: "Administrador", permissoes: "Acesso total ao sistema", usuarios: 1 },
    { nome: "Producao", permissoes: "Formulas, OPs, Estoque", usuarios: 1 },
    { nome: "Fiscal", permissoes: "NF-e, Relatorios Fiscais", usuarios: 1 },
    { nome: "Financeiro", permissoes: "Contas, Fluxo de Caixa", usuarios: 1 },
    { nome: "Vendas", permissoes: "CRM, Pedidos, Clientes", usuarios: 0 },
  ];

  const columns = [
    { 
      key: "nome", 
      header: "Usuario",
      render: (item: any) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {item.nome.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{item.nome}</p>
            <p className="text-xs text-muted-foreground">{item.email}</p>
          </div>
        </div>
      )
    },
    { 
      key: "perfil", 
      header: "Perfil",
      render: (item: any) => (
        <StatusBadge variant="default">{item.perfil}</StatusBadge>
      )
    },
    { 
      key: "status", 
      header: "Status",
      render: (item: any) => (
        <StatusBadge variant={item.status === "ATIVO" ? "success" : "muted"}>
          {item.status}
        </StatusBadge>
      )
    },
    { key: "ultimoAcesso", header: "Ultimo Acesso" },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (item: any) => (
        <div className="flex gap-1">
          <Button variant="ghost" size="icon">
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon">
            <Key className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div>
      <PageHeader
        title="Usuarios e Permissoes"
        description="Gestao de acesso e perfis de usuario"
        icon={Shield}
        actions={
          <Button className="bg-secondary hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuario
          </Button>
        }
      />

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Usuarios</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={usuarios}
                columns={columns}
                searchable
                searchPlaceholder="Buscar usuario..."
                searchKeys={["nome", "email"]}
                emptyMessage="Nenhum usuario cadastrado"
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Perfis de Acesso</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {perfis.map((perfil) => (
                <div key={perfil.nome} className="p-3 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">{perfil.nome}</p>
                    <span className="text-xs text-muted-foreground">{perfil.usuarios} usuarios</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{perfil.permissoes}</p>
                </div>
              ))}
              <Button variant="outline" className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Novo Perfil
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
