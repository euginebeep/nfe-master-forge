import { useState } from "react";
import { 
  FlaskConical, Plus, Search, Filter, Eye, Trash2, 
  Copy, AlertTriangle, MoreHorizontal, FileText, 
  Beaker, Package, Settings2, CheckCircle2, XCircle
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { 
  useFormulasIndustrial, 
  useDeleteFormulaIndustrial, 
  useDuplicateFormulaIndustrial,
  useInsumosFormulacao,
  useProdutosFormulacao,
} from "@/hooks/use-formulas-industrial";
import { FormulaWizardDialog } from "@/components/formulas/FormulaWizardDialog";
import { InsumoFormDialog } from "@/components/formulas/InsumoFormDialog";
import { ProdutoFormDialogV2 } from "@/components/formulas/ProdutoFormDialogV2";
import { FichaTecnicaPDF } from "@/components/formulas/FichaTecnicaPDF";
import { TabelaNutricionalIndustrial } from "@/components/formulas/TabelaNutricionalIndustrial";
import { FormulaIndustrial, InsumoFormulacao, ProdutoFormulacao } from "@/types/formulas-industrial";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "error" | "muted" | "default"> = {
  ATIVO: "success",
  APROVADO: "success",
  RASCUNHO: "muted",
  REVISAO: "warning",
  ARQUIVADO: "default",
};

const STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  APROVADO: "Aprovado",
  RASCUNHO: "Rascunho",
  REVISAO: "Em Revisão",
  ARQUIVADO: "Arquivado",
};

export default function FormulasListPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("formulas");
  
  // Dialogs
  const [showWizard, setShowWizard] = useState(false);
  const [showInsumoForm, setShowInsumoForm] = useState(false);
  const [showProdutoForm, setShowProdutoForm] = useState(false);
  const [selectedInsumo, setSelectedInsumo] = useState<InsumoFormulacao | null>(null);
  const [selectedProduto, setSelectedProduto] = useState<ProdutoFormulacao | null>(null);
  const [deleteFormulaId, setDeleteFormulaId] = useState<string | null>(null);
  const [deleteInsumoId, setDeleteInsumoId] = useState<string | null>(null);
  const [deleteProdutoId, setDeleteProdutoId] = useState<string | null>(null);
  const [formulaParaFicha, setFormulaParaFicha] = useState<FormulaIndustrial | null>(null);
  const [formulaParaTabela, setFormulaParaTabela] = useState<FormulaIndustrial | null>(null);

  // Hooks
  const { data: formulas, isLoading: loadingFormulas, refresh: refreshFormulas } = useFormulasIndustrial(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const { data: insumos, isLoading: loadingInsumos, refresh: refreshInsumos, remove: removeInsumo } = useInsumosFormulacao();
  const { data: produtos, isLoading: loadingProdutos, refresh: refreshProdutos, remove: removeProduto } = useProdutosFormulacao();
  const { deleteFormula } = useDeleteFormulaIndustrial();
  const { duplicate } = useDuplicateFormulaIndustrial();

  // Filtrar fórmulas
  const filteredFormulas = formulas.filter(f => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      f.nome.toLowerCase().includes(s) ||
      f.codigo.toLowerCase().includes(s) ||
      f.produto_nome?.toLowerCase().includes(s)
    );
  });

  // Filtrar insumos
  const filteredInsumos = insumos.filter(i => {
    if (!search) return true;
    const s = search.toLowerCase();
    return i.nome_interno.toLowerCase().includes(s) || i.nome_rotulo.toLowerCase().includes(s);
  });

  // Filtrar produtos
  const filteredProdutos = produtos.filter(p => {
    if (!search) return true;
    return p.nome_comercial.toLowerCase().includes(search.toLowerCase());
  });

  const handleDeleteFormula = () => {
    if (deleteFormulaId) {
      deleteFormula(deleteFormulaId);
      setDeleteFormulaId(null);
      refreshFormulas();
    }
  };

  const handleDeleteInsumo = () => {
    if (deleteInsumoId) {
      removeInsumo(deleteInsumoId);
      setDeleteInsumoId(null);
    }
  };

  const handleDeleteProduto = () => {
    if (deleteProdutoId) {
      removeProduto(deleteProdutoId);
      setDeleteProdutoId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="Formulador Industrial"
        description="Sistema de formulação de suplementos encapsulados"
        icon={FlaskConical}
        actions={
          <div className="flex gap-2">
            {activeTab === "formulas" && (
              <Button className="bg-secondary hover:bg-secondary/90" onClick={() => setShowWizard(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Fórmula
              </Button>
            )}
            {activeTab === "insumos" && (
              <Button className="bg-secondary hover:bg-secondary/90" onClick={() => { setSelectedInsumo(null); setShowInsumoForm(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Insumo
              </Button>
            )}
            {activeTab === "produtos" && (
              <Button className="bg-secondary hover:bg-secondary/90" onClick={() => { setSelectedProduto(null); setShowProdutoForm(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Produto
              </Button>
            )}
          </div>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="formulas" className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Fórmulas
              {formulas.length > 0 && (
                <Badge variant="secondary" className="ml-1">{formulas.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="produtos" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Produtos
              {produtos.length > 0 && (
                <Badge variant="secondary" className="ml-1">{produtos.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="insumos" className="flex items-center gap-2">
              <Beaker className="h-4 w-4" />
              Insumos
              {insumos.length > 0 && (
                <Badge variant="secondary" className="ml-1">{insumos.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            {activeTab === "formulas" && (
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="ATIVO">Ativo</SelectItem>
                  <SelectItem value="APROVADO">Aprovado</SelectItem>
                  <SelectItem value="RASCUNHO">Rascunho</SelectItem>
                  <SelectItem value="REVISAO">Em Revisão</SelectItem>
                  <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* FÓRMULAS */}
        <TabsContent value="formulas">
          {loadingFormulas ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="h-5 bg-muted rounded w-3/4" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 bg-muted rounded w-1/2" />
                      <div className="h-4 bg-muted rounded w-2/3" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredFormulas.length === 0 ? (
            <div className="text-center py-12">
              <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhuma fórmula cadastrada</h3>
              <p className="text-muted-foreground mb-4">
                {produtos.length === 0 
                  ? "Cadastre primeiro um produto, depois crie a fórmula"
                  : "Clique em 'Nova Fórmula' para começar"}
              </p>
              {produtos.length === 0 ? (
                <Button onClick={() => { setActiveTab("produtos"); }}>
                  <Package className="h-4 w-4 mr-2" />
                  Cadastrar Produto
                </Button>
              ) : (
                <Button onClick={() => setShowWizard(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Fórmula
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredFormulas.map((formula) => (
                <FormulaCard 
                  key={formula.id} 
                  formula={formula}
                  onDuplicate={() => { duplicate(formula.id, false); refreshFormulas(); }}
                  onNewVersion={() => { duplicate(formula.id, true); refreshFormulas(); }}
                  onDelete={() => setDeleteFormulaId(formula.id)}
                  onViewFicha={() => setFormulaParaFicha(formula)}
                  onViewTabela={() => setFormulaParaTabela(formula)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* PRODUTOS */}
        <TabsContent value="produtos">
          {loadingProdutos ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="py-6">
                    <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredProdutos.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum produto cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                {insumos.length === 0 
                  ? "Cadastre primeiro os insumos (ativos), depois crie o produto"
                  : "Produtos definem quais ativos e doses serão usados nas fórmulas"}
              </p>
              {insumos.length === 0 ? (
                <Button onClick={() => { setActiveTab("insumos"); }}>
                  <Beaker className="h-4 w-4 mr-2" />
                  Cadastrar Insumo
                </Button>
              ) : (
                <Button onClick={() => { setSelectedProduto(null); setShowProdutoForm(true); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Cadastrar Primeiro Produto
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProdutos.map((produto) => (
                <Card 
                  key={produto.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => { setSelectedProduto(produto); setShowProdutoForm(true); }}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <Badge variant="outline" className="font-mono text-xs mb-1">
                          {produto.codigo}
                        </Badge>
                        <CardTitle className="text-base font-semibold">
                          {produto.nome_comercial}
                        </CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedProduto(produto); setShowProdutoForm(true); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteProdutoId(produto.id); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {produto.ativos.slice(0, 3).map(ativo => (
                        <Badge key={ativo.id} variant="secondary" className="text-xs">
                          {ativo.nome_insumo}
                        </Badge>
                      ))}
                      {produto.ativos.length > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{produto.ativos.length - 3}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Cápsula {produto.tipo_capsula_padrao} • {produto.capacidade_alvo}mg
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* INSUMOS */}
        <TabsContent value="insumos">
          {loadingInsumos ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="py-6">
                    <div className="h-5 bg-muted rounded w-3/4 mb-2" />
                    <div className="h-4 bg-muted rounded w-1/2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredInsumos.length === 0 ? (
            <div className="text-center py-12">
              <Beaker className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Nenhum insumo cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Cadastre os ativos e excipientes que serão usados nas fórmulas
              </p>
              <Button onClick={() => { setSelectedInsumo(null); setShowInsumoForm(true); }}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Insumo
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {filteredInsumos.map((insumo) => (
                <Card 
                  key={insumo.id} 
                  className="cursor-pointer hover:shadow-md transition-shadow group"
                  onClick={() => { setSelectedInsumo(insumo); setShowInsumoForm(true); }}
                >
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge 
                            variant={
                              insumo.categoria === 'ATIVO' ? 'default' :
                              insumo.categoria === 'EXCIPIENTE' ? 'secondary' : 'outline'
                            }
                            className="text-xs"
                          >
                            {insumo.categoria === 'ATIVO' && 'Ativo'}
                            {insumo.categoria === 'EXCIPIENTE' && 'Excipiente'}
                            {insumo.categoria === 'ADITIVO_TECNOLOGICO' && 'Aditivo'}
                          </Badge>
                          {insumo.higroscopico && (
                            <Badge variant="outline" className="text-xs text-primary">
                              Higroscópico
                            </Badge>
                          )}
                        </div>
                        <p className="font-medium text-sm truncate">{insumo.nome_interno}</p>
                        <p className="text-xs text-muted-foreground truncate">{insumo.nome_rotulo}</p>
                        {insumo.tipo_potencia !== 'NENHUMA' && insumo.valor_potencia && (
                          <p className="text-xs text-secondary mt-1">
                            Potência: {insumo.valor_potencia} 
                            {insumo.tipo_potencia === 'PERCENTUAL' && '%'}
                            {insumo.tipo_potencia === 'UI_POR_GRAMA' && ' UI/g'}
                            {insumo.tipo_potencia === 'MG_POR_GRAMA' && ' mg/g'}
                          </p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelectedInsumo(insumo); setShowInsumoForm(true); }}>
                            <Eye className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={(e) => { e.stopPropagation(); setDeleteInsumoId(insumo.id); }}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <FormulaWizardDialog
        open={showWizard}
        onOpenChange={setShowWizard}
        onSuccess={refreshFormulas}
      />

      <InsumoFormDialog
        open={showInsumoForm}
        onOpenChange={setShowInsumoForm}
        insumo={selectedInsumo}
        onSuccess={refreshInsumos}
      />

      <ProdutoFormDialogV2
        open={showProdutoForm}
        onOpenChange={setShowProdutoForm}
        produto={selectedProduto}
        onSuccess={refreshProdutos}
      />

      {/* Delete Dialogs */}
      <AlertDialog open={!!deleteFormulaId} onOpenChange={() => setDeleteFormulaId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fórmula</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta fórmula? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteFormula} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteInsumoId} onOpenChange={() => setDeleteInsumoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Insumo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este insumo? Verifique se não está sendo usado em produtos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInsumo} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteProdutoId} onOpenChange={() => setDeleteProdutoId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Produto</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? As fórmulas vinculadas serão mantidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProduto} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ficha Técnica PDF */}
      <FichaTecnicaPDF
        open={!!formulaParaFicha}
        onOpenChange={() => setFormulaParaFicha(null)}
        formula={formulaParaFicha}
      />

      {/* Tabela Nutricional Industrial */}
      <TabelaNutricionalIndustrial
        open={!!formulaParaTabela}
        onOpenChange={() => setFormulaParaTabela(null)}
        formula={formulaParaTabela}
      />
    </div>
  );
}

// Componente de card de fórmula
function FormulaCard({ 
  formula, 
  onDuplicate, 
  onNewVersion, 
  onDelete,
  onViewFicha,
  onViewTabela,
}: { 
  formula: FormulaIndustrial;
  onDuplicate: () => void;
  onNewVersion: () => void;
  onDelete: () => void;
  onViewFicha: () => void;
  onViewTabela: () => void;
}) {
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="font-mono text-xs">
                {formula.codigo}
              </Badge>
              {formula.versao > 1 && (
                <Badge variant="secondary" className="text-xs">
                  v{formula.versao}
                </Badge>
              )}
            </div>
            <CardTitle className="text-base font-semibold truncate">
              {formula.nome}
            </CardTitle>
            {formula.produto_nome && (
              <p className="text-sm text-muted-foreground truncate">
                {formula.produto_nome}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <StatusBadge variant={STATUS_VARIANTS[formula.status]}>
              {STATUS_LABELS[formula.status]}
            </StatusBadge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewFicha(); }}>
                  <Eye className="h-4 w-4 mr-2" />
                  Ficha Técnica
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewTabela(); }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Tabela Nutricional
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(); }}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onNewVersion(); }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Versão
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="text-destructive"
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-4 text-sm mb-3">
          <div>
            <p className="text-muted-foreground text-xs uppercase">Cápsula</p>
            <p className="font-medium">{formula.tipo_capsula}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Caps/Dose</p>
            <p className="font-medium">{formula.capsulas_por_dose}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase">Ativos</p>
            <p className="font-medium">{formula.ingredientes.length}</p>
          </div>
        </div>

        {/* Custo */}
        {formula.custo_total_capsula && formula.custo_total_capsula > 0 && (
          <div className="flex justify-between items-center text-sm mb-3 p-2 bg-muted/50 rounded">
            <span className="text-muted-foreground">Custo/Cápsula:</span>
            <span className="font-semibold text-primary">
              R$ {formula.custo_total_capsula.toFixed(4)}
            </span>
          </div>
        )}

        {/* Barra de ocupação */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              {formula.status_ocupacao === 'OK' && <CheckCircle2 className="h-3 w-3 text-secondary" />}
              {formula.status_ocupacao === 'ATENCAO' && <AlertTriangle className="h-3 w-3 text-warning" />}
              {formula.status_ocupacao === 'NAO_CABE' && <XCircle className="h-3 w-3 text-destructive" />}
              Ocupação
            </span>
            <span>
              {formula.peso_total_capsula_mg.toFixed(0)}mg / {formula.capacidade_alvo_mg}mg
            </span>
          </div>
          <Progress 
            value={Math.min(formula.percentual_ocupacao, 100)} 
            className={`h-2 ${
              formula.status_ocupacao === 'NAO_CABE' ? '[&>div]:bg-destructive' :
              formula.status_ocupacao === 'ATENCAO' ? '[&>div]:bg-warning' : ''
            }`}
          />
        </div>

        {/* Alertas */}
        {formula.alertas.filter(a => a.severidade !== 'info').length > 0 && (
          <div className="mt-3 flex items-center gap-1 text-xs text-warning">
            <AlertTriangle className="h-3 w-3" />
            <span>{formula.alertas.filter(a => a.severidade !== 'info').length} alerta(s)</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
