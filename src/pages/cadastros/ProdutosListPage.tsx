import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Plus, Eye, Trash2, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocalItens, useDeleteItem, LocalItem } from "@/hooks/use-local-itens";
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
import { ItemFormDialog } from "@/components/itens/ItemFormDialog";

const TIPO_LABELS: Record<string, string> = {
  MP: "Materia Prima",
  EMBALAGEM: "Embalagem",
  ROTULO: "Rotulo",
  TAMPA: "Tampa",
  POTE: "Pote",
  SILICA: "Silica",
  CAPSULA_VAZIA: "Capsula Vazia",
  PA: "Produto Acabado",
  OUTRO: "Outro",
};

const CRITICIDADE_VARIANTS: Record<string, "success" | "warning" | "error" | "muted"> = {
  NORMAL: "muted",
  ATENCAO: "warning",
  CRITICO: "error",
  ULTRA: "error",
};

export default function ProdutosListPage() {
  const navigate = useNavigate();
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [ativoFilter, setAtivoFilter] = useState<string>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const { data: itens, isLoading, refresh } = useLocalItens({
    tipo_item: tipoFilter !== "all" ? tipoFilter : undefined,
    ativo: ativoFilter !== "all" ? ativoFilter === "true" : undefined,
  });

  const { deleteItem } = useDeleteItem();

  const handleDelete = () => {
    if (deleteId) {
      deleteItem(deleteId);
      setDeleteId(null);
      refresh();
    }
  };

  const columns = [
    {
      key: "sku_interno",
      header: "SKU",
      sortable: true,
      render: (item: LocalItem) => (
        <span className="font-mono text-sm">{item.sku_interno || "-"}</span>
      ),
    },
    {
      key: "descricao_interna",
      header: "Descricao",
      sortable: true,
      render: (item: LocalItem) => (
        <div>
          <p className="font-medium">{item.descricao_interna}</p>
          {item.descricao_comercial && item.descricao_comercial !== item.descricao_interna && (
            <p className="text-sm text-muted-foreground">{item.descricao_comercial}</p>
          )}
        </div>
      ),
    },
    {
      key: "tipo_item",
      header: "Tipo",
      render: (item: LocalItem) => (
        <StatusBadge variant="default">
          {TIPO_LABELS[item.tipo_item] || item.tipo_item}
        </StatusBadge>
      ),
    },
    {
      key: "ncm",
      header: "NCM",
      render: (item: LocalItem) => (
        <span className="font-mono text-sm">{item.ncm || "-"}</span>
      ),
    },
    {
      key: "unidade_interna",
      header: "Unidade",
      render: (item: LocalItem) => item.unidade_interna,
    },
    {
      key: "criticidade",
      header: "Criticidade",
      render: (item: LocalItem) => (
        <StatusBadge variant={CRITICIDADE_VARIANTS[item.criticidade]}>
          {item.criticidade}
        </StatusBadge>
      ),
    },
    {
      key: "controla_lote",
      header: "Lote",
      render: (item: LocalItem) => (
        <StatusBadge variant={item.controla_lote ? "success" : "muted"}>
          {item.controla_lote ? "Sim" : "Nao"}
        </StatusBadge>
      ),
    },
    {
      key: "ativo",
      header: "Status",
      render: (item: LocalItem) => (
        <StatusBadge variant={item.ativo ? "success" : "error"}>
          {item.ativo ? "Ativo" : "Inativo"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-24",
      render: (item: LocalItem) => (
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/cadastros/produtos/${item.id}`);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
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
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Produtos"
        description="Materias primas, embalagens e produtos acabados"
        icon={Package}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Produto
          </Button>
        }
      />

      <DataTable
        data={itens}
        columns={columns}
        loading={isLoading}
        searchable
        searchPlaceholder="Buscar por SKU, descricao ou NCM..."
        searchKeys={["sku_interno", "descricao_interna", "descricao_comercial", "ncm", "ean"]}
        onRowClick={(item) => navigate(`/cadastros/produtos/${item.id}`)}
        emptyMessage="Nenhum produto cadastrado"
        actions={
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={tipoFilter} onValueChange={setTipoFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="MP">Materia Prima</SelectItem>
                <SelectItem value="EMBALAGEM">Embalagem</SelectItem>
                <SelectItem value="ROTULO">Rotulo</SelectItem>
                <SelectItem value="PA">Produto Acabado</SelectItem>
                <SelectItem value="CAPSULA_VAZIA">Capsula Vazia</SelectItem>
                <SelectItem value="OUTRO">Outro</SelectItem>
              </SelectContent>
            </Select>
            <Select value={ativoFilter} onValueChange={setAtivoFilter}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Ativos</SelectItem>
                <SelectItem value="false">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta acao nao pode ser desfeita.
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

      <ItemFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSuccess={() => {
          setShowForm(false);
          refresh();
        }}
      />
    </div>
  );
}
