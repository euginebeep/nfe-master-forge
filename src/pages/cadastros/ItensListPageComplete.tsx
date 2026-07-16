import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Package, Plus, Eye, Filter, Check, MoreHorizontal,
  Trash2, Ban, RotateCcw, Loader2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { useHybridItens, type HybridItem } from "@/hooks/use-hybrid-data";
import { ItemWizardDialog } from "@/components/itens/ItemWizardDialog";
import { TenantAccessDiagnostic } from "@/components/diagnostics/TenantAccessDiagnostic";
import {
  podeExcluirItem,
  excluirItemSeguro,
  desativarItem,
  type PodeExcluirResult,
} from "@/hooks/use-excluir-item";

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

type DialogMode = "excluir" | "desativar" | "reativar" | null;

export default function ItensListPageComplete() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedTipos, setSelectedTipos] = useState<TipoItem[]>([]);
  const [ativoFilter, setAtivoFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [targetItem, setTargetItem] = useState<HybridItem | null>(null);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [checkResult, setCheckResult] = useState<PodeExcluirResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [acting, setActing] = useState(false);

  const { data: itensData, isLoading } = useHybridItens({
    tipo_item: undefined,
    ativo: ativoFilter !== "all" ? ativoFilter === "true" : undefined,
  });
  
  const itens = itensData || [];

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

  const selectAllTipos = () => setSelectedTipos(TIPO_ITEMS);
  const clearTipos = () => setSelectedTipos([]);

  const refreshLista = async () => {
    await queryClient.invalidateQueries({ queryKey: ["hybrid-itens"] });
    await queryClient.invalidateQueries({ queryKey: ["itens"] });
  };

  const fecharDialog = () => {
    setDialogMode(null);
    setTargetItem(null);
    setCheckResult(null);
  };

  const iniciarExclusao = async (item: HybridItem) => {
    setTargetItem(item);
    setChecking(true);
    setCheckResult(null);
    try {
      const result = await podeExcluirItem(item.id);
      setCheckResult(result);
      setDialogMode(result.pode_excluir ? "excluir" : "desativar");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao verificar exclusão");
      setTargetItem(null);
    } finally {
      setChecking(false);
    }
  };

  const iniciarReativacao = (item: HybridItem) => {
    setTargetItem(item);
    setCheckResult(null);
    setDialogMode("reativar");
  };

  const confirmarAcao = async () => {
    if (!targetItem || !dialogMode) return;
    setActing(true);
    try {
      if (dialogMode === "excluir") {
        await excluirItemSeguro(targetItem.id);
        toast.success(`Insumo "${targetItem.sku_interno}" excluído permanentemente`);
      } else if (dialogMode === "desativar") {
        await desativarItem(targetItem.id, false);
        toast.success(`Insumo "${targetItem.sku_interno}" desativado — histórico preservado`);
      } else if (dialogMode === "reativar") {
        await desativarItem(targetItem.id, true);
        toast.success(`Insumo "${targetItem.sku_interno}" reativado`);
      }
      fecharDialog();
      await refreshLista();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na operação");
    } finally {
      setActing(false);
    }
  };

  const columns = [
    {
      key: "sku_interno",
      header: "SKU",
      sortable: true,
      render: (item: HybridItem) => (
        <span className={`font-mono text-sm ${!item.ativo ? "text-muted-foreground" : ""}`}>
          {item.sku_interno || "-"}
        </span>
      ),
    },
    {
      key: "descricao_interna",
      header: "Descrição",
      sortable: true,
      render: (item: HybridItem) => (
        <div className={!item.ativo ? "opacity-70" : undefined}>
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
        <StatusBadge variant={item.ativo ? "success" : "muted"}>
          {item.ativo ? "Ativo" : "Inativo"}
        </StatusBadge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-20",
      render: (item: HybridItem) => (
        <div className="flex items-center justify-end gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/cadastros/itens/${item.id}`);
            }}
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => e.stopPropagation()}
                disabled={checking && targetItem?.id === item.id}
                title="Mais ações"
              >
                {checking && targetItem?.id === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => navigate(`/cadastros/itens/${item.id}`)}>
                <Eye className="h-4 w-4 mr-2" />
                Abrir
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {item.ativo ? (
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => void iniciarExclusao(item)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir / Desativar…
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem onClick={() => iniciarReativacao(item)}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reativar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
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
          <div className="flex gap-2">
            <TenantAccessDiagnostic table="itens" contextLabel="Produtos/Insumos" visibleCount={filteredItens.length} />
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Item
            </Button>
          </div>
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
        pageSize={40}
        onRowClick={(item) => navigate(`/cadastros/itens/${item.id}`)}
        emptyMessage="Nenhum item cadastrado"
        actions={
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
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

      {/* Confirmação: excluir permanente */}
      <AlertDialog open={dialogMode === "excluir"} onOpenChange={(o) => !o && fecharDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                O insumo <strong>{targetItem?.sku_interno}</strong>
                {targetItem?.descricao_interna ? ` — ${targetItem.descricao_interna}` : ""}{" "}
                nunca foi usado e pode ser apagado.
              </span>
              <span className="block text-destructive">
                Esta ação não pode ser desfeita.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarAcao();
              }}
              disabled={acting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação: só desativar (tem histórico) */}
      <AlertDialog open={dialogMode === "desativar"} onOpenChange={(o) => !o && fecharDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível excluir</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                O insumo <strong>{targetItem?.sku_interno}</strong> tem histórico
                (estoque/notas/OPs) e não pode ser excluído para preservar a rastreabilidade.
              </span>
              {checkResult?.motivos && checkResult.motivos.length > 0 && (
                <ul className="list-disc pl-5 text-sm space-y-1">
                  {checkResult.motivos.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              )}
              <span className="block">
                Você pode <strong>desativá-lo</strong> — ele some das listas de seleção,
                mas o histórico é mantido.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarAcao();
              }}
              disabled={acting}
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação: reativar */}
      <AlertDialog open={dialogMode === "reativar"} onOpenChange={(o) => !o && fecharDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reativar insumo?</AlertDialogTitle>
            <AlertDialogDescription>
              O insumo <strong>{targetItem?.sku_interno}</strong> voltará a aparecer
              nas listas de seleção (fórmulas, compras, etc.).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={acting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void confirmarAcao();
              }}
              disabled={acting}
            >
              {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Reativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
