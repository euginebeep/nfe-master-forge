import { useState } from "react";
import { Shield, Plus, Edit, Key, UserCog } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserFormDialog } from "@/components/usuarios/UserFormDialog";
import { useUsers, FACTORY_ROLES, type UserWithProfile, type ModulePermission, type CreateUserData, type UpdateUserData } from "@/hooks/use-users";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function UsuariosPage() {
  const { users, isLoading, createUser, updateUser, fetchUserPermissions } = useUsers();
  const { hasRole } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithProfile | null>(null);
  const [selectedUserPermissions, setSelectedUserPermissions] = useState<ModulePermission[]>([]);

  const isAdmin = hasRole('admin');

  const handleNewUser = () => {
    setSelectedUser(null);
    setSelectedUserPermissions([]);
    setDialogOpen(true);
  };

  const handleEditUser = async (user: UserWithProfile) => {
    setSelectedUser(user);
    const perms = await fetchUserPermissions(user.id);
    setSelectedUserPermissions(perms);
    setDialogOpen(true);
  };

  const handleSave = async (data: CreateUserData | UpdateUserData) => {
    if ('user_id' in data) {
      return updateUser(data);
    } else {
      return createUser(data);
    }
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin': return 'default';
      case 'gerente': return 'success';
      case 'supervisor': return 'warning';
      case 'operador': return 'info';
      default: return 'muted';
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'ATIVO': return 'success';
      case 'INATIVO': return 'muted';
      case 'BLOQUEADO': return 'error';
      default: return 'muted';
    }
  };

  const columns = [
    { 
      key: "nome", 
      header: "Usuário",
      render: (item: UserWithProfile) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {item.avatar_url ? (
              <AvatarImage src={item.avatar_url} alt={item.nome_completo} />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                {item.nome_completo.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
              </AvatarFallback>
            )}
          </Avatar>
          <div>
            <p className="font-medium">{item.nome_completo}</p>
            <p className="text-xs text-muted-foreground">{item.cargo || 'Sem cargo'}</p>
          </div>
        </div>
      )
    },
    { 
      key: "departamento", 
      header: "Departamento",
      render: (item: UserWithProfile) => (
        <span className="text-sm">{item.departamento || '-'}</span>
      )
    },
    { 
      key: "role", 
      header: "Perfil",
      render: (item: UserWithProfile) => (
        <StatusBadge variant={getRoleBadgeVariant(item.role)}>
          {FACTORY_ROLES[item.role]?.label || item.role}
        </StatusBadge>
      )
    },
    { 
      key: "status", 
      header: "Status",
      render: (item: UserWithProfile) => (
        <StatusBadge variant={getStatusBadgeVariant(item.status)}>
          {item.status}
        </StatusBadge>
      )
    },
    { 
      key: "ultimo_acesso", 
      header: "Último Acesso",
      render: (item: UserWithProfile) => (
        <span className="text-sm text-muted-foreground">
          {item.ultimo_acesso 
            ? format(new Date(item.ultimo_acesso), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : 'Nunca acessou'
          }
        </span>
      )
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (item: UserWithProfile) => (
        <div className="flex gap-1">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleEditUser(item)}
            disabled={!isAdmin}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => handleEditUser(item)}
            disabled={!isAdmin}
          >
            <Key className="h-4 w-4" />
          </Button>
        </div>
      )
    }
  ];

  // Count users per role
  const roleStats = Object.entries(FACTORY_ROLES).map(([key, config]) => ({
    role: key,
    label: config.label,
    description: config.description,
    count: users.filter(u => u.role === key).length,
  }));

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Usuários e Permissões"
          description="Gestão de acesso e perfis de usuário"
          icon={Shield}
        />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Usuários e Permissões"
        description="Gestão de acesso e perfis de usuário"
        icon={Shield}
        actions={
          isAdmin && (
            <Button className="bg-secondary hover:bg-secondary/90" onClick={handleNewUser}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Usuário
            </Button>
          )
        }
      />

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCog className="h-5 w-5" />
                Usuários ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                data={users}
                columns={columns}
                searchable
                searchPlaceholder="Buscar usuário..."
                searchKeys={["nome_completo", "cargo", "departamento"]}
                emptyMessage="Nenhum usuário cadastrado"
              />
            </CardContent>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Perfis de Acesso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {roleStats.map((stat) => (
                <div 
                  key={stat.role} 
                  className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium">{stat.label}</p>
                    <StatusBadge variant={getRoleBadgeVariant(stat.role)}>
                      {stat.count} {stat.count === 1 ? 'usuário' : 'usuários'}
                    </StatusBadge>
                  </div>
                  <p className="text-xs text-muted-foreground">{stat.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {!isAdmin && (
            <Card className="mt-4">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Shield className="h-6 w-6" />
                  <div>
                    <p className="font-medium text-foreground">Acesso Restrito</p>
                    <p className="text-sm">
                      Apenas administradores podem gerenciar usuários.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <UserFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={selectedUser}
        existingPermissions={selectedUserPermissions}
        onSave={handleSave}
      />
    </div>
  );
}
