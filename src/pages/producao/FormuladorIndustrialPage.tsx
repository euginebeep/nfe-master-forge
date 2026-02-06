// ============================================================
// FORMULADOR INDUSTRIAL - PÁGINA PRINCIPAL
// Lista de Fórmulas
// ============================================================

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FlaskConical, Plus, Search, Filter, Eye, Edit, Trash2, 
  CheckCircle, XCircle, Clock, FileText, RefreshCw
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useFormulas, useFormulaCRUD } from "@/hooks/use-formulador-industrial";
import { Formula, StatusFormula, TipoApresentacao } from "@/types/formulador-industrial";

export default function FormuladorIndustrialPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterTipo, setFilterTipo] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<Formula | null>(null);

  const { formulas, loading, refresh, stats } = useFormulas();
  const { excluir } = useFormulaCRUD();

  // Filtrar fórmulas
  const formulasFiltradas = formulas.filter(f => {
    const matchSearch = 
      f.codigo_formula.toLowerCase().includes(search.toLowerCase()) ||
      f.nome_formula.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || f.status === filterStatus;
    const matchTipo = filterTipo === "all" || f.tipo_apresentacao === filterTipo;
    return matchSearch && matchStatus && matchTipo;
  });

  const getStatusVariant = (status: StatusFormula) => {
    switch (status) {
      case "APROVADA": return "success";
      case "BLOQUEADA": return "destructive";
      case "RASCUNHO": 
      default: return "warning";
    }
  };

  const getStatusIcon = (status: StatusFormula) => {
    switch (status) {
      case "APROVADA": return <CheckCircle className="h-3 w-3 mr-1" />;
      case "BLOQUEADA": return <XCircle className="h-3 w-3 mr-1" />;
      default: return <Clock className="h-3 w-3 mr-1" />;
    }
  };

  const getTipoLabel = (tipo: TipoApresentacao) => {
    switch (tipo) {
      case "CAPSULA": return "Cápsula";
      case "LIQUIDO": return "Líquido";
      case "PO": return "Pó";
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    const success = await excluir(deleteConfirm.id);
    if (success) {
      refresh();
    }
    setDeleteConfirm(null);
  };

  return (
    <div>
      <PageHeader
        title="Formulador Industrial"
        description="Sistema de formulação de suplementos - ANVISA compliant"
        icon={FlaskConical}
        actions={
          <Button 
            className="bg-secondary hover:bg-secondary/90"
            onClick={() => navigate("/producao/formulas/nova")}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Fórmula
          </Button>
        }
      />

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <FlaskConical className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-warning/50">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-warning" />
            <div className="text-2xl font-bold text-warning">{stats.rascunhos}</div>
            <div className="text-xs text-muted-foreground">Rascunhos</div>
          </CardContent>
        </Card>
        <Card className="border-secondary/50">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 mx-auto mb-2 text-secondary" />
            <div className="text-2xl font-bold text-secondary">{stats.aprovadas}</div>
            <div className="text-xs text-muted-foreground">Aprovadas</div>
          </CardContent>
        </Card>
        <Card className="border-destructive/50">
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 mx-auto mb-2 text-destructive" />
            <div className="text-2xl font-bold text-destructive">{stats.bloqueadas}</div>
            <div className="text-xs text-muted-foreground">Bloqueadas</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou nome..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="APROVADA">Aprovada</SelectItem>
            <SelectItem value="BLOQUEADA">Bloqueada</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTipo} onValueChange={setFilterTipo}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos tipos</SelectItem>
            <SelectItem value="CAPSULA">Cápsula</SelectItem>
            <SelectItem value="LIQUIDO">Líquido</SelectItem>
            <SelectItem value="PO">Pó</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Tabela de fórmulas */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-muted-foreground">
              Carregando...
            </div>
          ) : formulasFiltradas.length === 0 ? (
            <div className="p-12 text-center">
              <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma fórmula encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {search ? "Tente alterar os filtros" : "Crie sua primeira fórmula industrial"}
              </p>
              <Button onClick={() => navigate("/producao/formulas/nova")}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Fórmula
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Versão</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formulasFiltradas.map((formula) => (
                  <TableRow key={formula.id}>
                    <TableCell>
                      <span className="font-mono font-medium">{formula.codigo_formula}</span>
                    </TableCell>
                    <TableCell>{formula.nome_formula}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{getTipoLabel(formula.tipo_apresentacao)}</Badge>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono">v{formula.versao}</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={getStatusVariant(formula.status) as any}>
                        {getStatusIcon(formula.status)}
                        {formula.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formula.criado_em ? new Date(formula.criado_em).toLocaleDateString('pt-BR') : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => navigate(`/producao/formulas/${formula.id}`)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {formula.status === 'RASCUNHO' && (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              onClick={() => navigate(`/producao/formulas/${formula.id}/editar`)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => setDeleteConfirm(formula)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fórmula?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a fórmula <strong>{deleteConfirm?.codigo_formula}</strong>?
              Esta ação não pode ser desfeita.
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
