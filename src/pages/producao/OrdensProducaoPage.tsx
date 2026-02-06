import { useState } from "react";
import { 
  Factory, Plus, Search, Filter, Play, Pause, Check, 
  RefreshCw, Eye, AlertTriangle, XCircle, Clock, Package,
  Scale, DollarSign, Calendar, FlaskConical
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
} from "@/hooks/use-ordens-producao";
import { OrdemProducao, StatusOrdemProducao } from "@/types/ordens-producao";
import { Label } from "@/components/ui/label";

export default function OrdensProducaoPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dialogDetalhe, setDialogDetalhe] = useState<OrdemProducao | null>(null);
  const [dialogFinalizar, setDialogFinalizar] = useState<OrdemProducao | null>(null);
  const [capsulasFinais, setCapsulasFinais] = useState("");

  const { data: ordens, isLoading, refresh, stats } = useOrdensProducao();
  const actions = useOrdemProducaoActions();

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
            onClick={() => navigate("/producao/formulas")}
          >
            <FlaskConical className="h-4 w-4 mr-2" />
            Ir para Fórmulas
          </Button>
        }
      />

      {/* Info */}
      <Card className="mb-6 bg-muted/50">
        <CardContent className="p-4 text-sm text-muted-foreground">
          <strong>Nota:</strong> As Ordens de Produção são geradas automaticamente ao aprovar uma fórmula no Formulador Industrial.
        </CardContent>
      </Card>

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
                {search ? "Tente alterar os filtros de busca" : "Aprove uma fórmula no Formulador Industrial para gerar OPs"}
              </p>
              <Button onClick={() => navigate("/producao/formulas")}>
                <FlaskConical className="h-4 w-4 mr-2" />
                Ir para Fórmulas
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

      {/* Dialog: Detalhes da OP */}
      <Dialog open={!!dialogDetalhe} onOpenChange={() => setDialogDetalhe(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          {dialogDetalhe && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Factory className="h-5 w-5 text-secondary" />
                  {dialogDetalhe.codigo}
                </DialogTitle>
                <DialogDescription>
                  {dialogDetalhe.produto_nome}
                </DialogDescription>
              </DialogHeader>

              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-6 pr-4">
                  {/* Resumo */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <Package className="h-6 w-6 mx-auto mb-2 text-secondary" />
                      <p className="text-2xl font-bold">{dialogDetalhe.total_capsulas.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Cápsulas</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <Scale className="h-6 w-6 mx-auto mb-2 text-secondary" />
                      <p className="text-2xl font-bold">{dialogDetalhe.peso_total_lote_g.toFixed(2)}g</p>
                      <p className="text-xs text-muted-foreground">Peso Total</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <DollarSign className="h-6 w-6 mx-auto mb-2 text-secondary" />
                      <p className="text-2xl font-bold">R$ {dialogDetalhe.custo_total_insumos.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">Custo Total</p>
                    </div>
                    <div className="text-center p-4 bg-muted rounded-lg">
                      <Calendar className="h-6 w-6 mx-auto mb-2 text-secondary" />
                      <p className="text-2xl font-bold">
                        {dialogDetalhe.data_prevista_inicio 
                          ? new Date(dialogDetalhe.data_prevista_inicio).toLocaleDateString('pt-BR') 
                          : '-'}
                      </p>
                      <p className="text-xs text-muted-foreground">Data Prevista</p>
                    </div>
                  </div>

                  <Separator />

                  {/* Insumos */}
                  <div>
                    <h4 className="font-medium mb-3">Insumos</h4>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Insumo</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead className="text-right">Por Cápsula</TableHead>
                          <TableHead className="text-right">Total (g)</TableHead>
                          <TableHead className="text-right">Total (kg)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dialogDetalhe.insumos.map((insumo) => (
                          <TableRow key={insumo.id}>
                            <TableCell className="font-medium">{insumo.nome_insumo}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {insumo.categoria}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {insumo.quantidade_por_capsula_mg.toFixed(2)} mg
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {insumo.quantidade_total_g.toFixed(3)} g
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {insumo.quantidade_total_kg.toFixed(6)} kg
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {dialogDetalhe.observacoes && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="font-medium mb-2">Observações</h4>
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {dialogDetalhe.observacoes}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </ScrollArea>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogDetalhe(null)}>
                  Fechar
                </Button>
              </DialogFooter>
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
              Informe a quantidade final de cápsulas produzidas para {dialogFinalizar?.codigo}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cápsulas Produzidas</Label>
              <Input
                type="number"
                value={capsulasFinais}
                onChange={(e) => setCapsulasFinais(e.target.value)}
                placeholder={`Meta: ${dialogFinalizar?.total_capsulas}`}
              />
              <p className="text-xs text-muted-foreground">
                Meta original: {dialogFinalizar?.total_capsulas.toLocaleString()} cápsulas
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFinalizar(null)}>
              Cancelar
            </Button>
            <Button 
              className="bg-secondary hover:bg-secondary/90"
              onClick={handleFinalizar}
              disabled={!capsulasFinais}
            >
              <Check className="h-4 w-4 mr-2" />
              Finalizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
