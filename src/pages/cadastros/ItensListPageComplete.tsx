import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Package, Plus, Eye, Filter, Check } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useHybridItens, type HybridItem } from "@/hooks/use-hybrid-data";
import { ItemWizardDialog } from "@/components/itens/ItemWizardDialog";

type TipoItem = 'MP' | 'EMBALAGEM' | 'ROTULO' | 'TAMPA' | 'POTE' | 'SILICA' | 'CAPSULA_VAZIA' | 'PA' | 'OUTRO';
type CriticidadeItem = 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'ULTRA';

const TIPO_LABELS: Record<TipoItem, string> = {
  MP: "Matéria Prima",
  EMBALAGEM: "Embalagem",
  ROTULO: "Rótulo",
  TAMPA: "Tampa",
  POTE: "Pote",
  SILICA: "Sílica",
  CAPSULA_VAZIA: "Cápsula Vazia",
  PA: "Produto Acabado",
  OUTRO: "Outro",
};

const TIPO_ITEMS: TipoItem[] = ['MP', 'EMBALAGEM', 'ROTULO', 'TAMPA', 'POTE', 'SILICA', 'CAPSULA_VAZIA', 'PA', 'OUTRO'];

const CRITICIDADE_VARIANTS: Record<CriticidadeItem, "success" | "warning" | "error" | "muted"> = {
  NORMAL: "muted",
  ATENCAO: "warning",
  CRITICO: "error",
  ULTRA: "error",
};

export default function ItensListPageComplete() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTipos, setSelectedTipos] = useState<TipoItem[]>([]);
  const [ativoFilter, setAtivoFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: itensData, isLoading } = useHybridItens({
    tipo_item: undefined,
    ativo: ativoFilter !== "all" ? ativoFilter === "true" : undefined,
  });
  
  const itens = itensData || [];

  // Filter by selected tipos
  const filteredItens = selectedTipos.length > 0 
    ? itens.filter(item => selectedTipos.includes(item.tipo_item as TipoItem))
    : itens;

  const toggleTipo = (tipo: TipoItem) => {
    setSelectedTipos(prev => 
      prev.includes(tipo) 
        ? prev.filter(t => t !== tipo)
        : [...prev, tipo]
    );
  };

  const selectAllTipos = () => {
    setSelectedTipos(TIPO_ITEMS);
  };

  const clearTipos = () => {
    setSelectedTipos([]);
  };

  const columns = [
    {
      key: "sku_interno",
      header: "SKU",
      sortable: true,
      render: (item: HybridItem) => (
        <span className="font-mono text-sm">{item.sku_interno || "-"}</span>
      ),
    },
    {
      key: "descricao_interna",
      header: "Descrição",
      sortable: true,
      render: (item: HybridItem) => (
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
      render: (item: HybridItem) => (
        <StatusBadge variant="default">
          {TIPO_LABELS[item.tipo_item as TipoItem] || item.tipo_item}
        </StatusBadge>
      ),
    },
    {
      key: "ncm",
      header: "NCM",
      render: (item: HybridItem) => (
        <span className="font-mono text-sm">{item.ncm || "-"}</span>
      ),
    },
    {
      key: "unidade_interna",
      header: "Unidade",
      render: (item: HybridItem) => item.unidade_interna,
    },
    {
      key: "criticidade",
      header: "Criticidade",
      render: (item: HybridItem) => (
        <StatusBadge variant={CRITICIDADE_VARIANTS[(item.criticidade || 'NORMAL') as CriticidadeItem] || "muted"}>
          {item.criticidade || 'NORMAL'}
        </StatusBadge>
      ),
    },
    {
      key: "controla_lote",
      header: "Lote",
      render: (item: HybridItem) => (
        <StatusBadge variant={item.controla_lote ? "success" : "muted"}>
          {item.controla_lote ? "Sim" : "Não"}
        </StatusBadge>
      ),
    },
    {
      key: "ativo",
      header: "Status",
      render: (item: HybridItem) => (
        <StatusBadge variant={item.ativo ? "success" : "error"}>
          {item.ativo ? "Ativo" : "Inativo"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-16",
      render: (item: HybridItem) => (
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
        title="Produtos e Insumos"
        description="Matérias primas, embalagens e produtos acabados"
        icon={Package}
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Item
          </Button>
        }
      />

      <ItemWizardDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          setDialogOpen(false);
          queryClient.invalidateQueries({ queryKey: ["hybrid-itens"] });
        }}
      />

      <DataTable
        data={filteredItens}
        columns={columns}
        loading={isLoading}
        searchable
        searchPlaceholder="Buscar por SKU, descrição ou NCM..."
        searchKeys={["sku_interno", "descricao_interna", "descricao_comercial", "ncm", "ean"]}
        onRowClick={(item) => navigate(`/cadastros/itens/${item.id}`)}
        emptyMessage="Nenhum item cadastrado"
        actions={
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
            {/* Multi-select for Tipos */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 justify-between">
                  {selectedTipos.length === 0 
                    ? "Todos os tipos" 
                    : selectedTipos.length === 1 
                      ? TIPO_LABELS[selectedTipos[0]]
                      : `${selectedTipos.length} tipos selecionados`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-2">
                  <div className="flex gap-2 pb-2 border-b">
                    <Button variant="ghost" size="sm" onClick={selectAllTipos} className="text-xs">
                      Selecionar Todos
                    </Button>
                    <Button variant="ghost" size="sm" onClick={clearTipos} className="text-xs">
                      Limpar
                    </Button>
                  </div>
                  {TIPO_ITEMS.map((tipo) => (
                    <div key={tipo} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`tipo-${tipo}`}
                        checked={selectedTipos.includes(tipo)}
                        onCheckedChange={() => toggleTipo(tipo)}
                      />
                      <label 
                        htmlFor={`tipo-${tipo}`} 
                        className="text-sm cursor-pointer flex-1"
                      >
                        {TIPO_LABELS[tipo]}
                      </label>
                      {selectedTipos.includes(tipo) && (
                        <Check className="h-4 w-4 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

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
