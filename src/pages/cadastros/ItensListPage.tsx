import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, Plus, Eye, Filter } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useItens } from "@/hooks/use-itens";
import type { Item, TipoItem, CriticidadeItem } from "@/types/erp";

const TIPO_LABELS: Record<TipoItem, string> = {
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

const CRITICIDADE_VARIANTS: Record<CriticidadeItem, "success" | "warning" | "error" | "muted"> = {
  NORMAL: "muted",
  ATENCAO: "warning",
  CRITICO: "error",
  ULTRA: "error",
};

export default function ItensListPage() {
  const navigate = useNavigate();
  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [ativoFilter, setAtivoFilter] = useState<string>("all");

  const { data: itens = [], isLoading } = useItens({
    tipo_item: tipoFilter !== "all" ? (tipoFilter as TipoItem) : undefined,
    ativo: ativoFilter !== "all" ? ativoFilter === "true" : undefined,
  });

  const columns = [
    {
      key: "sku_interno",
      header: "SKU",
      sortable: true,
      render: (item: Item) => (
        <span className="font-mono text-sm">{item.sku_interno || "-"}</span>
      ),
    },
    {
      key: "descricao_interna",
      header: "Descricao",
      sortable: true,
      render: (item: Item) => (
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
      render: (item: Item) => (
        <StatusBadge variant="default">
          {TIPO_LABELS[item.tipo_item] || item.tipo_item}
        </StatusBadge>
      ),
    },
    {
      key: "ncm",
      header: "NCM",
      render: (item: Item) => (
        <span className="font-mono text-sm">{item.ncm || "-"}</span>
      ),
    },
    {
      key: "unidade_interna",
      header: "Unidade",
      render: (item: Item) => item.unidade_interna,
    },
    {
      key: "criticidade",
      header: "Criticidade",
      render: (item: Item) => (
        <StatusBadge variant={CRITICIDADE_VARIANTS[item.criticidade]}>
          {item.criticidade}
        </StatusBadge>
      ),
    },
    {
      key: "controla_lote",
      header: "Lote",
      render: (item: Item) => (
        <StatusBadge variant={item.controla_lote ? "success" : "muted"}>
          {item.controla_lote ? "Sim" : "Nao"}
        </StatusBadge>
      ),
    },
    {
      key: "ativo",
      header: "Status",
      render: (item: Item) => (
        <StatusBadge variant={item.ativo ? "success" : "error"}>
          {item.ativo ? "Ativo" : "Inativo"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (item: Item) => (
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/cadastros/itens/${item.id}`);
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
        title="Itens"
        description="Materias primas, embalagens e produtos acabados"
        icon={Package}
        actions={
          <Button onClick={() => navigate("/cadastros/itens/novo")}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Item
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
        onRowClick={(item) => navigate(`/cadastros/itens/${item.id}`)}
        emptyMessage="Nenhum item cadastrado"
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
    </div>
  );
}
