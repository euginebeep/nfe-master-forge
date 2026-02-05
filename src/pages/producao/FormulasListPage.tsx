import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FlaskConical, Plus, Search, Filter, Eye, Trash2, 
  Copy, AlertTriangle, MoreHorizontal, FileText 
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
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
import { useFormulas, useDeleteFormula, useDuplicateFormula } from "@/hooks/use-formulas";
import { FormulaFormDialog } from "@/components/formulas/FormulaFormDialog";
import { TabelaNutricionalDialog } from "@/components/formulas/TabelaNutricionalDialog";
import { Formula } from "@/types/formulas";

const STATUS_VARIANTS: Record<string, "success" | "warning" | "error" | "muted" | "default"> = {
  ATIVO: "success",
  RASCUNHO: "muted",
  REVISAO: "warning",
  ARQUIVADO: "default",
};

const STATUS_LABELS: Record<string, string> = {
  ATIVO: "Ativo",
  RASCUNHO: "Rascunho",
  REVISAO: "Em Revisão",
  ARQUIVADO: "Arquivado",
};

export default function FormulasListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showTabela, setShowTabela] = useState(false);
  const [tabelaFormula, setTabelaFormula] = useState<Formula | null>(null);

  const { data: formulas, isLoading, refresh } = useFormulas(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const { deleteFormula } = useDeleteFormula();
  const { duplicate } = useDuplicateFormula();

  // Filtrar por busca
  const filteredFormulas = formulas.filter(f => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      f.nome.toLowerCase().includes(searchLower) ||
      f.codigo.toLowerCase().includes(searchLower) ||
      f.nome_comercial?.toLowerCase().includes(searchLower) ||
      f.ingredientes.some(i => i.item_descricao.toLowerCase().includes(searchLower))
    );
  });

  const handleEdit = (formula: Formula) => {
    setSelectedFormula(formula);
    setShowForm(true);
  };

  const handleNew = () => {
    setSelectedFormula(null);
    setShowForm(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteFormula(deleteId);
      setDeleteId(null);
      refresh();
    }
  };

  const handleDuplicate = (formula: Formula) => {
    duplicate(formula.id, false);
    refresh();
  };

  const handleNewVersion = (formula: Formula) => {
    duplicate(formula.id, true);
    refresh();
  };

  const handleViewTabela = (formula: Formula) => {
    setTabelaFormula(formula);
    setShowTabela(true);
  };

  return (
    <div>
      <PageHeader
        title="Formulador ANVISA"
        description="Gestão de fórmulas e fichas técnicas de suplementos"
        icon={FlaskConical}
        actions={
          <Button className="bg-secondary hover:bg-secondary/90" onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Fórmula
          </Button>
        }
      />

      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar fórmula..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ATIVO">Ativo</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="REVISAO">Em Revisão</SelectItem>
            <SelectItem value="ARQUIVADO">Arquivado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
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
          <p className="text-muted-foreground mb-4">Clique em "Nova Fórmula" para começar</p>
          <Button onClick={handleNew}>
            <Plus className="h-4 w-4 mr-2" />
            Criar Primeira Fórmula
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredFormulas.map((formula) => (
            <Card 
              key={formula.id} 
              className="cursor-pointer hover:shadow-md transition-shadow group"
              onClick={() => handleEdit(formula)}
            >
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
                    {formula.nome_comercial && (
                      <p className="text-sm text-muted-foreground truncate">
                        {formula.nome_comercial}
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
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(formula); }}>
                          <Eye className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewTabela(formula); }}>
                          <FileText className="h-4 w-4 mr-2" />
                          Tabela Nutricional
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDuplicate(formula); }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleNewVersion(formula); }}>
                          <Plus className="h-4 w-4 mr-2" />
                          Nova Versão
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive"
                          onClick={(e) => { e.stopPropagation(); setDeleteId(formula.id); }}
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
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Cápsula</p>
                    <p className="font-medium">{formula.tipo_capsula}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Capacidade</p>
                    <p className="font-medium">{formula.capacidade_mg}mg</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs uppercase">Ativos</p>
                    <p className="font-medium">{formula.ingredientes.length}</p>
                  </div>
                </div>

                {/* Barra de ocupação */}
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Ocupação</span>
                    <span>
                      {formula.total_ativos_mg.toFixed(0)}mg / {formula.capacidade_mg}mg
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all ${
                        formula.total_ativos_mg > formula.capacidade_mg 
                          ? 'bg-destructive' 
                          : formula.total_ativos_mg > formula.capacidade_mg * 0.9
                            ? 'bg-warning' 
                            : 'bg-secondary'
                      }`}
                      style={{ 
                        width: `${Math.min((formula.total_ativos_mg / formula.capacidade_mg) * 100, 100)}%` 
                      }}
                    />
                  </div>
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
          ))}
        </div>
      )}

      {/* Dialogs */}
      <FormulaFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        formula={selectedFormula}
        onSuccess={() => {
          setShowForm(false);
          setSelectedFormula(null);
          refresh();
        }}
      />

      <TabelaNutricionalDialog
        open={showTabela}
        onOpenChange={setShowTabela}
        formula={tabelaFormula}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Fórmula</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta fórmula? Esta ação não pode ser desfeita.
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
    </div>
  );
}
