import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Eye, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEntidades } from "@/hooks/use-entidades";
import { formatDocument } from "@/lib/formatters";
import { EntidadeWizardDialog } from "@/components/entidades/EntidadeWizardDialog";
import type { Entidade, EntidadePapel, StatusEntidade, PapelEntidade } from "@/types/erp";

const STATUS_VARIANTS: Record<StatusEntidade, "success" | "warning" | "error"> = {
  ATIVO: "success",
  BLOQUEADO: "error",
  HOMOLOGACAO: "warning",
};

const PAPEL_LABELS: Record<PapelEntidade, string> = {
  FORNECEDOR: "Fornecedor",
  CLIENTE: "Cliente",
  TRANSPORTADORA: "Transportadora",
  AFILIADO: "Afiliado",
  VENDEDOR: "Vendedor",
  OUTRO: "Outro",
};

export default function EntidadesListPage() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [papelFilter, setPapelFilter] = useState<string>("all");
  const [showWizard, setShowWizard] = useState(false);

  const { data: entidades = [], isLoading } = useEntidades({
    status: statusFilter !== "all" ? statusFilter : undefined,
    papel: papelFilter !== "all" ? papelFilter : undefined,
  });

  const columns = [
    {
      key: "documento",
      header: "Documento",
      sortable: true,
      render: (item: Entidade & { entidade_papeis: EntidadePapel[] }) => (
        <span className="font-mono text-sm">{formatDocument(item.documento)}</span>
      ),
    },
    {
      key: "razao_social",
      header: "Razao Social",
      sortable: true,
      render: (item: Entidade) => (
        <div>
          <p className="font-medium">{item.razao_social}</p>
          {item.nome_fantasia && (
            <p className="text-sm text-muted-foreground">{item.nome_fantasia}</p>
          )}
        </div>
      ),
    },
    {
      key: "papeis",
      header: "Papeis",
      render: (item: Entidade & { entidade_papeis: EntidadePapel[] }) => (
        <div className="flex flex-wrap gap-1">
          {item.entidade_papeis?.map((p) => (
            <StatusBadge key={p.id} variant="muted">
              {PAPEL_LABELS[p.papel as PapelEntidade] || p.papel}
            </StatusBadge>
          ))}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item: Entidade) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status]}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "classificacao",
      header: "Classificacao",
      render: (item: Entidade) => (
        <StatusBadge
          variant={
            item.classificacao === "VIP"
              ? "info"
              : item.classificacao === "PROBLEMA"
              ? "error"
              : "muted"
          }
        >
          {item.classificacao || "REGULAR"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (item: Entidade) => (
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
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Entidades"
        description="Fornecedores, clientes, transportadoras e parceiros"
        icon={Users}
        actions={
          <Button onClick={() => setShowWizard(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Entidade
          </Button>
        }
      />

      <EntidadeWizardDialog
        open={showWizard}
        onOpenChange={setShowWizard}
        onSuccess={() => setShowWizard(false)}
      />

      <DataTable
        data={entidades}
        columns={columns}
        loading={isLoading}
        searchable
        searchPlaceholder="Buscar por documento ou razao social..."
        searchKeys={["documento", "razao_social", "nome_fantasia"]}
        onRowClick={(item) => navigate(`/cadastros/entidades/${item.id}`)}
        emptyMessage="Nenhuma entidade cadastrada"
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
            <Select value={papelFilter} onValueChange={setPapelFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="FORNECEDOR">Fornecedor</SelectItem>
                <SelectItem value="CLIENTE">Cliente</SelectItem>
                <SelectItem value="TRANSPORTADORA">Transportadora</SelectItem>
                <SelectItem value="AFILIADO">Afiliado</SelectItem>
                <SelectItem value="VENDEDOR">Vendedor</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />
    </div>
  );
}
