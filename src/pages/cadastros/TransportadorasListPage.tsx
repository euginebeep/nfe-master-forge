import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus, Eye, Trash2, Filter } from "lucide-react";
import { ModuleGuard } from "@/components/auth/ModuleGuard";
import { useAuth } from "@/hooks/use-auth";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHybridEntidades, type HybridEntidade } from "@/hooks/use-hybrid-data";
import { useDeleteEntidade } from "@/hooks/use-entidades";
import { formatDocument } from "@/lib/formatters";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EntidadeFormDialogComplete } from "@/components/entidades/EntidadeFormDialogComplete";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "error"> = {
  ATIVO: "success",
  BLOQUEADO: "error",
  INATIVO: "warning",
  HOMOLOGACAO: "warning",
};

export default function TransportadorasListPage() {
  const navigate = useNavigate();
  const { canDelete } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: entidades = [], isLoading, refetch } = useHybridEntidades({
    papel: "TRANSPORTADORA",
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const deleteEntidade = useDeleteEntidade();

  const handleDelete = () => {
    if (deleteId) {
      deleteEntidade.mutate(deleteId, {
        onSuccess: () => {
          setDeleteId(null);
          refetch();
        },
      });
    }
  };

  const columns = [
    {
      key: "documento",
      header: "CNPJ/CPF",
      sortable: true,
      render: (item: HybridEntidade) => (
        <span className="font-mono text-sm">{formatDocument(item.documento)}</span>
      ),
    },
    {
      key: "razao_social",
      header: "Razão Social",
      sortable: true,
      render: (item: HybridEntidade) => (
        <div>
          <p className="font-medium">{item.razao_social}</p>
          {item.nome_fantasia && (
            <p className="text-sm text-muted-foreground">{item.nome_fantasia}</p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: HybridEntidade) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status] || "muted"}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "contato",
      header: "Contato Principal",
      render: (item: HybridEntidade) => {
        const contact = item._primaryContact;
        if (!contact) return <span className="text-muted-foreground">-</span>;
        return (
          <div className="text-sm">
            <p>{contact.nome}</p>
            {contact.whatsapp && <p className="text-muted-foreground">{contact.whatsapp}</p>}
            {contact.email && <p className="text-muted-foreground">{contact.email}</p>}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (item: HybridEntidade) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/cadastros/entidades/${item.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {canDelete('entidades') && (
            <Button
              variant="ghost"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                setDeleteId(item.id);
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <ModuleGuard modulo="entidades" moduloLabel="Transportadoras">
      <div>
        <PageHeader
          title="Transportadoras"
          description="Gestão de transportadoras e parceiros logísticos"
          icon={Truck}
          actions={
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Transportadora
            </Button>
          }
        />

        <DataTable
          data={entidades}
          columns={columns}
          loading={isLoading}
          searchable
          searchPlaceholder="Buscar por documento ou razão social..."
          searchKeys={["documento", "razao_social", "nome_fantasia"]}
          onRowClick={(item) => navigate(`/cadastros/entidades/${item.id}`)}
          emptyMessage="Nenhuma transportadora cadastrada"
          actions={
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="BLOQUEADO">Bloqueado</SelectItem>
                  <SelectItem value="HOMOLOGACAO">Homologação</SelectItem>
                </SelectContent>
              </Select>
            </div>
          }
        />

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Transportadora</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir esta transportadora? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <EntidadeFormDialogComplete
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialPapel="TRANSPORTADORA"
          onSuccess={() => refetch()}
        />
      </div>
    </ModuleGuard>
  );
}
