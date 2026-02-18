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
import { useLocalEntidades, useDeleteEntidade, LocalEntidade } from "@/hooks/use-local-entidades";
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
import { EntidadeWizardDialog } from "@/components/entidades/EntidadeWizardDialog";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "error"> = {
  ATIVO: "success",
  BLOQUEADO: "error",
  HOMOLOGACAO: "warning",
};

const CLASSIFICACAO_VARIANTS: Record<string, "info" | "muted" | "error"> = {
  VIP: "info",
  REGULAR: "muted",
  PROBLEMA: "error",
};

export default function FornecedoresListPage() {
  const navigate = useNavigate();
  const { canCreate, canDelete } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: entidades, isLoading, refresh } = useLocalEntidades({
    papel: "FORNECEDOR",
    status: statusFilter !== "all" ? statusFilter : undefined,
  });

  const { deleteEntidade } = useDeleteEntidade();

  const handleDelete = () => {
    if (deleteId) {
      deleteEntidade(deleteId);
      setDeleteId(null);
      refresh();
    }
  };

  const columns = [
    {
      key: "documento",
      header: "CNPJ/CPF",
      sortable: true,
      render: (item: LocalEntidade) => (
        <span className="font-mono text-sm">{formatDocument(item.documento)}</span>
      ),
    },
    {
      key: "razao_social",
      header: "Razao Social",
      sortable: true,
      render: (item: LocalEntidade) => (
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
      render: (item: LocalEntidade) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status]}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "classificacao",
      header: "Classificacao",
      render: (item: LocalEntidade) => (
        <StatusBadge variant={CLASSIFICACAO_VARIANTS[item.classificacao || "REGULAR"]}>
          {item.classificacao || "REGULAR"}
        </StatusBadge>
      ),
    },
    {
      key: "contato",
      header: "Contato Principal",
      render: (item: LocalEntidade) => {
        const contact = (item as any)._primaryContact;
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
      key: "tags",
      header: "Tags",
      render: (item: LocalEntidade) => (
        <div className="flex flex-wrap gap-1">
          {item.tags?.slice(0, 3).map((tag, i) => (
            <StatusBadge key={i} variant="muted">{tag}</StatusBadge>
          ))}
          {item.tags?.length > 3 && (
            <StatusBadge variant="muted">+{item.tags.length - 3}</StatusBadge>
          )}
        </div>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (item: LocalEntidade) => (
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
    <ModuleGuard modulo="entidades" moduloLabel="Fornecedores">
      <div>
      <PageHeader
        title="Fornecedores"
        description="Gestao de fornecedores e parceiros de compra"
        icon={Truck}
        actions={
          canCreate('entidades') ? (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Fornecedor
            </Button>
          ) : undefined
        }
      />

      <DataTable
        data={entidades}
        columns={columns}
        loading={isLoading}
        searchable
        searchPlaceholder="Buscar por documento ou razao social..."
        searchKeys={["documento", "razao_social", "nome_fantasia"]}
        onRowClick={(item) => navigate(`/cadastros/entidades/${item.id}`)}
        emptyMessage="Nenhum fornecedor cadastrado"
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
                <SelectItem value="HOMOLOGACAO">Homologacao</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este fornecedor? Esta acao nao pode ser desfeita.
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

      <EntidadeWizardDialog
        open={showForm}
        onOpenChange={setShowForm}
        initialPapel="FORNECEDOR"
        onSuccess={() => {
          setShowForm(false);
          refresh();
        }}
      />
      </div>
    </ModuleGuard>
  );
}
