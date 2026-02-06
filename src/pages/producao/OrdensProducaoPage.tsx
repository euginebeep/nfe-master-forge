import { useState } from "react";
import { 
  Factory, Plus, Search, Filter, Play, Pause, Check, 
  RefreshCw, Eye, AlertTriangle, XCircle, Clock, Package,
  Scale, DollarSign, Calendar
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  useOrdensProducao, 
  useOrdemProducaoActions,
  useCreateOrdemProducao,
} from "@/hooks/use-ordens-producao";
import { useFormulasIndustrial, useFormulaIndustrial } from "@/hooks/use-formulas-industrial";
import { OrdemProducao, StatusOrdemProducao } from "@/types/ordens-producao";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function OrdensProducaoPage() {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogNovaOP, setDialogNovaOP] = useState(false);
  const [dialogDetalhe, setDialogDetalhe] = useState<OrdemProducao | null>(null);
  const [dialogFinalizar, setDialogFinalizar] = useState<OrdemProducao | null>(null);
  const [capsulasFinais, setCapsulasFinais] = useState("");

  const { data: ordens, isLoading, refresh, stats } = useOrdensProducao();
  const { data: formulas } = useFormulasIndustrial({ status: 'APROVADO' });
  const actions = useOrdemProducaoActions();
  const { criarOP } = useCreateOrdemProducao();

  // Form para nova OP
  const [novaOPForm, setNovaOPForm] = useState({
    formula_id: "",
    quantidade_doses: 30,
    data_prevista_inicio: "",
    responsavel: "",
    observacoes: "",
  });

  // Buscar fórmula selecionada para preview
  const { formula: formulaSelecionada } = useFormulaIndustrial(novaOPForm.formula_id);

  // Filtrar ordens
  const ordensFiltradas = ordens.filter(op => {
    const matchSearch = 
      op.codigo.toLowerCase().includes(search.toLowerCase()) ||
      op.produto_nome.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || op.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const getStatusVariant = (status: StatusOrdemProducao) => {
    switch (status) {
      case "EM_PRODUCAO": return "info";
      case "AGUARDANDO_INICIO": 
      case "AGUARDANDO_MATERIAIS": return "warning";
      case "FINALIZADA": return "success";
      case "PAUSADA": return "muted";
      case "CANCELADA": return "destructive";
      default: return "muted";
    }
  };

  const getStatusLabel = (status: StatusOrdemProducao) => {
    switch (status) {
      case "RASCUNHO": return "Rascunho";
      case "AGUARDANDO_MATERIAIS": return "Aguardando Materiais";
      case "AGUARDANDO_INICIO": return "Aguardando Início";
      case "EM_PRODUCAO": return "Em Produção";
      case "PAUSADA": return "Pausada";
      case "FINALIZADA": return "Finalizada";
      case "CANCELADA": return "Cancelada";
      default: return status;
    }
  };

  const handleCriarOP = () => {
    if (!formulaSelecionada) return;
    
    const op = criarOP(formulaSelecionada, {
      formula_id: novaOPForm.formula_id,
      quantidade_doses: novaOPForm.quantidade_doses,
      data_prevista_inicio: novaOPForm.data_prevista_inicio || undefined,
      observacoes: novaOPForm.observacoes || undefined,
      responsavel: novaOPForm.responsavel || undefined,
    });
    
    if (op) {
      setDialogNovaOP(false);
      setNovaOPForm({
        formula_id: "",
        quantidade_doses: 30,
        data_prevista_inicio: "",
        responsavel: "",
        observacoes: "",
      });
      refresh();
    }
  };

  const handleFinalizar = () => {
    if (!dialogFinalizar || !capsulasFinais) return;
    actions.finalizarProducao(dialogFinalizar.id, parseInt(capsulasFinais));
    setDialogFinalizar(null);
    setCapsulasFinais("");
    refresh();
  };

  return (
    <div>
      <PageHeader
        title="Ordens de Produção"
        description="Gestão e acompanhamento de OPs industriais"
        icon={Factory}
        actions={
          <Button 
            className="bg-secondary hover:bg-secondary/90"
            onClick={() => setDialogNovaOP(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova OP
          </Button>
        }
      />

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total OPs</div>
          </CardContent>
        </Card>
        <Card className="border-warning/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-warning">{stats.aguardando}</div>
            <div className="text-xs text-muted-foreground">Aguardando</div>
          </CardContent>
        </Card>
        <Card className="border-primary/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{stats.emProducao}</div>
            <div className="text-xs text-muted-foreground">Em Produção</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.pausadas}</div>
            <div className="text-xs text-muted-foreground">Pausadas</div>
          </CardContent>
        </Card>
        <Card className="border-secondary/50">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-secondary">{stats.finalizadas}</div>
            <div className="text-xs text-muted-foreground">Finalizadas</div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por código ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="AGUARDANDO_INICIO">Aguardando Início</SelectItem>
            <SelectItem value="EM_PRODUCAO">Em Produção</SelectItem>
            <SelectItem value="PAUSADA">Pausada</SelectItem>
            <SelectItem value="FINALIZADA">Finalizada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={refresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Lista de OPs */}
      <div className="space-y-4">
        {ordensFiltradas.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhuma OP encontrada</h3>
              <p className="text-muted-foreground mb-4">
                {search ? "Tente alterar os filtros de busca" : "Crie uma nova ordem de produção para começar"}
              </p>
              <Button onClick={() => setDialogNovaOP(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nova OP
              </Button>
            </CardContent>
          </Card>
        ) : (
          ordensFiltradas.map((op) => (
            <Card key={op.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-mono font-bold text-lg">{op.codigo}</p>
                        <Badge variant="outline" className="text-xs">
                          {op.tipo_capsula}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground">{op.produto_nome}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <StatusBadge variant={getStatusVariant(op.status) as any}>
                      {getStatusLabel(op.status)}
                    </StatusBadge>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setDialogDetalhe(op)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Detalhes
                      </Button>
                      {op.status === "AGUARDANDO_INICIO" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            actions.iniciarProducao(op.id);
                            refresh();
                          }}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Iniciar
                        </Button>
                      )}
                      {op.status === "EM_PRODUCAO" && (
                        <>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              actions.pausarProducao(op.id);
                              refresh();
                            }}
                          >
                            <Pause className="h-4 w-4 mr-1" />
                            Pausar
                          </Button>
                          <Button 
                            size="sm" 
                            className="bg-secondary hover:bg-secondary/90"
                            onClick={() => {
                              setCapsulasFinais(String(op.total_capsulas));
                              setDialogFinalizar(op);
                            }}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Finalizar
                          </Button>
                        </>
                      )}
                      {op.status === "PAUSADA" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            actions.retomarProducao(op.id);
                            refresh();
                          }}
                        >
                          <Play className="h-4 w-4 mr-1" />
                          Retomar
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grid de informações */}
                <div className="grid grid-cols-6 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Cápsulas</p>
                    <p className="font-semibold">{op.total_capsulas.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Doses</p>
                    <p className="font-semibold">{op.quantidade_doses}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Peso Total</p>
                    <p className="font-semibold">{op.peso_total_lote_g.toFixed(2)} g</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase">Custo Estimado</p>
                    <p className="font-semibold">R$ {op.custo_total_insumos.toFixed(2)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground uppercase mb-2">Progresso</p>
                    <div className="flex items-center gap-3">
                      <Progress value={op.progresso} className="flex-1" />
                      <span className="text-sm font-medium">{op.progresso}%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Dialog: Nova OP */}
      <Dialog open={dialogNovaOP} onOpenChange={setDialogNovaOP}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-secondary" />
              Nova Ordem de Produção
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fórmula *</Label>
                <Select 
                  value={novaOPForm.formula_id}
                  onValueChange={(v) => setNovaOPForm(prev => ({ ...prev, formula_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma fórmula aprovada..." />
                  </SelectTrigger>
                  <SelectContent>
                    {formulas.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Nenhuma fórmula aprovada disponível
                      </div>
                    ) : (
                      formulas.map(f => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.codigo} - {f.produto_nome || f.nome}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Quantidade de Doses *</Label>
                <Input
                  type="number"
                  value={novaOPForm.quantidade_doses}
                  onChange={(e) => setNovaOPForm(prev => ({ 
                    ...prev, 
                    quantidade_doses: parseInt(e.target.value) || 0 
                  }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data Prevista de Início</Label>
                <Input
                  type="date"
                  value={novaOPForm.data_prevista_inicio}
                  onChange={(e) => setNovaOPForm(prev => ({ 
                    ...prev, 
                    data_prevista_inicio: e.target.value 
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Responsável</Label>
                <Input
                  value={novaOPForm.responsavel}
                  onChange={(e) => setNovaOPForm(prev => ({ 
                    ...prev, 
                    responsavel: e.target.value 
                  }))}
                  placeholder="Nome do responsável"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={novaOPForm.observacoes}
                onChange={(e) => setNovaOPForm(prev => ({ 
                  ...prev, 
                  observacoes: e.target.value 
                }))}
                placeholder="Observações sobre a produção..."
              />
            </div>

            {/* Preview da OP */}
            {formulaSelecionada && novaOPForm.quantidade_doses > 0 && (
              <Card className="bg-muted/50">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm font-medium">Preview da OP</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-secondary">
                        {novaOPForm.quantidade_doses * formulaSelecionada.capsulas_por_dose}
                      </p>
                      <p className="text-xs text-muted-foreground">cápsulas</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {((formulaSelecionada.peso_total_capsula_mg * novaOPForm.quantidade_doses * formulaSelecionada.capsulas_por_dose) / 1000).toFixed(1)}
                      </p>
                      <p className="text-xs text-muted-foreground">gramas totais</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {formulaSelecionada.tipo_capsula}
                      </p>
                      <p className="text-xs text-muted-foreground">cápsula</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold">
                        {formulaSelecionada.ingredientes.length}
                      </p>
                      <p className="text-xs text-muted-foreground">insumos</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovaOP(false)}>
              Cancelar
            </Button>
            <Button 
              className="bg-secondary hover:bg-secondary/90"
              onClick={handleCriarOP}
              disabled={!novaOPForm.formula_id || novaOPForm.quantidade_doses <= 0}
            >
              Criar OP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes da OP */}
      <Dialog open={!!dialogDetalhe} onOpenChange={() => setDialogDetalhe(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {dialogDetalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Factory className="h-5 w-5 text-secondary" />
                  {dialogDetalhe.codigo} - {dialogDetalhe.produto_nome}
                </DialogTitle>
                <DialogDescription>
                  Fórmula: {dialogDetalhe.formula_codigo} | Cápsula: {dialogDetalhe.tipo_capsula}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="insumos">
                <TabsList>
                  <TabsTrigger value="insumos">
                    <Package className="h-4 w-4 mr-1" />
                    Insumos
                  </TabsTrigger>
                  <TabsTrigger value="resumo">
                    <Scale className="h-4 w-4 mr-1" />
                    Resumo
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="insumos" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Insumo</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">mg/cáps</TableHead>
                          <TableHead className="text-right">Total (g)</TableHead>
                          <TableHead className="text-right">Total (kg)</TableHead>
                          <TableHead className="text-right">Custo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dialogDetalhe.insumos.map(insumo => (
                          <TableRow key={insumo.id}>
                            <TableCell className="font-medium">
                              {insumo.nome_insumo}
                            </TableCell>
                            <TableCell>
                              <Badge variant={insumo.categoria === 'ATIVO' ? 'default' : 'secondary'}>
                                {insumo.categoria}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {insumo.quantidade_por_capsula_mg.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {insumo.quantidade_total_g.toFixed(4)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {insumo.quantidade_total_kg.toFixed(6)}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {insumo.custo_total 
                                ? `R$ ${insumo.custo_total.toFixed(2)}` 
                                : '-'
                              }
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="resumo" className="mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Produção</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Total de Cápsulas:</span>
                          <span className="font-medium">{dialogDetalhe.total_capsulas.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Doses:</span>
                          <span className="font-medium">{dialogDetalhe.quantidade_doses}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Cáps/Dose:</span>
                          <span className="font-medium">{dialogDetalhe.capsulas_por_dose}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Peso por Cápsula:</span>
                          <span className="font-medium">{dialogDetalhe.peso_por_capsula_mg.toFixed(1)} mg</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Peso Total (g):</span>
                          <span className="font-medium">{dialogDetalhe.peso_total_lote_g.toFixed(2)} g</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Peso Total (kg):</span>
                          <span className="font-medium">{dialogDetalhe.peso_total_lote_kg.toFixed(4)} kg</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="py-3">
                        <CardTitle className="text-sm">Custos</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Custo Total Insumos:</span>
                          <span className="font-medium">R$ {dialogDetalhe.custo_total_insumos.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Custo por Cápsula:</span>
                          <span className="font-medium">R$ {dialogDetalhe.custo_por_capsula.toFixed(4)}</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Status:</span>
                          <StatusBadge variant={getStatusVariant(dialogDetalhe.status) as any}>
                            {getStatusLabel(dialogDetalhe.status)}
                          </StatusBadge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Progresso:</span>
                          <span className="font-medium">{dialogDetalhe.progresso}%</span>
                        </div>
                        {dialogDetalhe.responsavel && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Responsável:</span>
                            <span className="font-medium">{dialogDetalhe.responsavel}</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Finalizar OP */}
      <Dialog open={!!dialogFinalizar} onOpenChange={() => setDialogFinalizar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Produção</DialogTitle>
            <DialogDescription>
              Informe a quantidade real de cápsulas produzidas
            </DialogDescription>
          </DialogHeader>

          {dialogFinalizar && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium">{dialogFinalizar.codigo}</p>
                <p className="text-sm text-muted-foreground">{dialogFinalizar.produto_nome}</p>
                <p className="text-sm mt-2">
                  Previsto: <strong>{dialogFinalizar.total_capsulas.toLocaleString()}</strong> cápsulas
                </p>
              </div>

              <div className="space-y-2">
                <Label>Cápsulas Produzidas</Label>
                <Input
                  type="number"
                  value={capsulasFinais}
                  onChange={(e) => setCapsulasFinais(e.target.value)}
                  placeholder={String(dialogFinalizar.total_capsulas)}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFinalizar(null)}>
              Cancelar
            </Button>
            <Button 
              className="bg-secondary hover:bg-secondary/90"
              onClick={handleFinalizar}
            >
              <Check className="h-4 w-4 mr-1" />
              Confirmar Finalização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
