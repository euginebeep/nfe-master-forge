import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Truck, Plus, Eye, Trash2, Filter, Download, AlertTriangle } from "lucide-react";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { downloadCSV } from "@/lib/export-utils";
import { toast } from "sonner";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "error"> = {
  ATIVO: "success",
  BLOQUEADO: "error",
  INATIVO: "warning",
  HOMOLOGACAO: "warning",
};

const CLASSIFICACAO_VARIANTS: Record<string, "success" | "info" | "error" | "warning" | "muted"> = {
  VIP: "info",
  REGULAR: "muted",
  RISCO: "warning",
  RESTRITO: "error",
  PROBLEMA: "error",
};

export default function FornecedoresListPage() {
  const navigate = useNavigate();
  const { canCreate, canDelete, role } = useAuth();
  const isAdmin = role === 'admin';
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showExportWarning, setShowExportWarning] = useState(false);

  const { data: entidades = [], isLoading, refetch } = useHybridEntidades({
    papel: "FORNECEDOR",
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

  const handleExport = () => {
    if (!isAdmin) {
      setShowExportWarning(true);
      return;
    }
    doExport();
  };

  const doExport = () => {
    const headers = ["Código", "CNPJ/CPF", "Razão Social", "Nome Fantasia", "Status", "Classificação"];
    const rows = entidades.map(e => [
      (e as any).codigo_interno || '',
      formatDocument(e.documento),
      e.razao_social,
      e.nome_fantasia || "",
      e.status,
      e.classificacao || "REGULAR",
    ]);
    downloadCSV("fornecedores", headers, rows);
    toast.success("Exportação concluída. Esta ação foi registrada no log de auditoria.");
  };

  const columns = [
    {
      key: "codigo_interno",
      header: "Código",
      sortable: true,
      render: (item: HybridEntidade) => (
        <span className="font-mono text-sm">{(item as any).codigo_interno || '-'}</span>
      ),
    },
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
      key: "classificacao",
      header: "Classificação",
      render: (item: HybridEntidade) => (
        <StatusBadge variant={CLASSIFICACAO_VARIANTS[item.classificacao || "REGULAR"] || "muted"}>
          {item.classificacao || "REGULAR"}
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
      key: "tags",
      header: "Tags",
      render: (item: HybridEntidade) => {
        const tags = (item.tags as string[]) || [];
        return (
          <div className="flex flex-wrap gap-1">
            {tags.slice(0, 3).map((tag, i) => (
              <StatusBadge key={i} variant="muted">{tag}</StatusBadge>
            ))}
            {tags.length > 3 && (
              <StatusBadge variant="muted">+{tags.length - 3}</StatusBadge>
            )}
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
    <ModuleGuard modulo="entidades" moduloLabel="Fornecedores">
      <div>
        {showExportWarning && (
          <Alert variant="destructive" className="mb-4 border-destructive bg-destructive/10">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <AlertTitle className="text-destructive font-bold text-base">
              ⚠️ Advertência de Segurança — Exportação de Dados Sigilosos
            </AlertTitle>
            <AlertDescription className="space-y-2 mt-1">
              <p className="text-destructive/90">
                Você está prestes a exportar a <strong>lista completa de fornecedores</strong>. Esta ação <strong>não é permitida</strong> para usuários sem perfil de Administrador.
              </p>
              <p className="text-destructive/80 text-sm font-semibold">
                🔴 Todo acesso e tentativa de exportação fica gravado permanentemente no log de auditoria do sistema com seu usuário, IP e horário exato.
              </p>
              <p className="text-destructive/70 text-sm">
                Caso precise desta informação, solicite ao Administrador do sistema.
              </p>
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  onClick={() => setShowExportWarning(false)}
                >
                  Entendido, cancelar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        <PageHeader
          title="Fornecedores"
          description="Gestão de fornecedores e parceiros de compra"
          icon={Truck}
          actions={
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              {canCreate('entidades') && (
                <Button onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Fornecedor
                </Button>
              )}
            </div>
          }
        />

        <DataTable
          data={entidades}
          columns={columns}
          loading={isLoading}
          searchable
          searchPlaceholder="Buscar por documento ou razão social..."
          searchKeys={["codigo_interno", "documento", "razao_social", "nome_fantasia"]}
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
                  <SelectItem value="HOMOLOGACAO">Homologação</SelectItem>
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
                Tem certeza que deseja excluir este fornecedor? Esta ação não pode ser desfeita.
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
          initialPapel="FORNECEDOR"
          onSuccess={() => refetch()}
        />
      </div>
    </ModuleGuard>
  );
}
