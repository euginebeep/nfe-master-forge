import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Factory, ArrowLeft, Play, Pause, Check, XCircle,
  Package, Scale, ClipboardCheck, FileText, AlertTriangle,
  Calendar, Users, Printer, RefreshCw, Lock
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  useOrdemProducaoIndustrial, 
  useOrdemProducaoIndustrialActions 
} from '@/hooks/use-ordem-producao-industrial';
import { StatusOP } from '@/types/ordem-producao-industrial';
import { OPDocumentoPDF } from '@/components/producao/OPDocumentoPDF';
import { PickListLotes } from '@/components/producao/PickListLotes';
import { ControleQualidadeForm } from '@/components/producao/ControleQualidadeForm';
import { toast } from 'sonner';

export default function OrdemProducaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { ordem, isLoading, refresh } = useOrdemProducaoIndustrial(id);
  const actions = useOrdemProducaoIndustrialActions();

  const [dialogFinalizar, setDialogFinalizar] = useState(false);
  const [qtdProduzida, setQtdProduzida] = useState('');
  const [qtdAprovada, setQtdAprovada] = useState('');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ordem) {
    return (
      <div className="text-center py-12">
        <Factory className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-medium mb-2">OP não encontrada</h2>
        <Button onClick={() => navigate('/producao/ordens')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  const getStatusBadge = (status: StatusOP) => {
    const map: Record<StatusOP, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
      PLANEJADA: { variant: 'outline', label: 'Planejada' },
      AGUARDANDO_MATERIAIS: { variant: 'outline', label: 'Aguardando Materiais' },
      EM_PRODUCAO: { variant: 'default', label: 'Em Produção' },
      FINALIZADA: { variant: 'secondary', label: 'Finalizada' },
      BLOQUEADA: { variant: 'destructive', label: 'Bloqueada' },
      CANCELADA: { variant: 'destructive', label: 'Cancelada' },
    };
    const config = map[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const handleIniciar = () => {
    actions.iniciarProducao(ordem.id);
    refresh();
  };

  const handleFinalizar = () => {
    const produzida = parseInt(qtdProduzida);
    const aprovada = parseInt(qtdAprovada);
    
    if (isNaN(produzida) || isNaN(aprovada)) {
      toast.error('Informe as quantidades');
      return;
    }
    
    if (aprovada > produzida) {
      toast.error('Quantidade aprovada não pode ser maior que produzida');
      return;
    }

    actions.finalizarProducao(ordem.id, produzida, aprovada, 'Usuário');
    setDialogFinalizar(false);
    refresh();
  };

  const handleAlocarLote = (
    insumoId: string,
    insumoNome: string,
    loteId: string,
    numeroLote: string,
    fornecedorNome: string,
    quantidade: number,
    custoUnitario: number
  ) => {
    actions.alocarLote(ordem.id, insumoId, insumoNome, loteId, numeroLote, fornecedorNome, quantidade, custoUnitario);
    refresh();
  };

  const handleSalvarQC = (qc: any) => {
    actions.registrarQC(ordem.id, qc);
    refresh();
  };

  // Calcular progresso
  const totalItens = ordem.itens_pesagem.length;
  const itensPesados = ordem.itens_pesagem.filter(i => i.quantidade_pesada_g !== undefined).length;
  const progressoPesagem = totalItens > 0 ? (itensPesados / totalItens) * 100 : 0;

  const temAtivosCriticos = ordem.itens_pesagem.some(i => i.tipo_pesagem === 'CRITICA');

  return (
    <div>
      <PageHeader
        title={ordem.codigo}
        description={ordem.produto_nome}
        icon={Factory}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/producao/ordens')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            
            {ordem.status === 'PLANEJADA' && (
              <Button onClick={handleIniciar}>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Produção
              </Button>
            )}
            
            {ordem.status === 'EM_PRODUCAO' && ordem.controle_qualidade?.status === 'APROVADO' && (
              <Button 
                className="bg-secondary hover:bg-secondary/90"
                onClick={() => {
                  setQtdProduzida(String(ordem.quantidade_com_acrescimo));
                  setQtdAprovada(String(ordem.quantidade_planejada));
                  setDialogFinalizar(true);
                }}
              >
                <Check className="h-4 w-4 mr-2" />
                Finalizar
              </Button>
            )}
          </div>
        }
      />

      {/* Cabeçalho com informações principais */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <Card className="col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Status</span>
              {getStatusBadge(ordem.status)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Fórmula</span>
              <span className="font-mono">{ordem.formula_codigo} v{ordem.formula_versao}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-2xl font-bold">{ordem.quantidade_com_acrescimo.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Quantidade (+{ordem.acrescimo_producao_percentual}%)</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-lg font-bold font-mono">{ordem.lote_produto_acabado}</p>
            <p className="text-xs text-muted-foreground">Lote PA</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Scale className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-lg font-bold">{progressoPesagem.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Pesagem</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-secondary" />
            <p className="text-sm font-medium truncate">{ordem.responsavel_tecnico || '-'}</p>
            <p className="text-xs text-muted-foreground">Responsável</p>
          </CardContent>
        </Card>
      </div>

      {/* Alerta de Ativos Críticos */}
      {temAtivosCriticos && (
        <Card className="mb-6 border-destructive/50 bg-destructive/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-destructive" />
            <div>
              <p className="font-medium text-destructive">Ativos Críticos Detectados</p>
              <p className="text-sm text-muted-foreground">
                Esta OP contém ativos que exigem pesagem crítica com dupla conferência.
                Procedimentos de diluição geométrica incluídos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs principais */}
      <Tabs defaultValue="pesagem" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pesagem" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Pesagem
          </TabsTrigger>
          <TabsTrigger value="pick-list" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Pick List
          </TabsTrigger>
          <TabsTrigger value="qc" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Controle de Qualidade
          </TabsTrigger>
          <TabsTrigger value="documento" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documento
          </TabsTrigger>
        </TabsList>

        {/* Tab: Pesagem */}
        <TabsContent value="pesagem">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-secondary" />
                Lista de Pesagem - Ordem Industrial
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm">Progresso:</span>
                  <Progress value={progressoPesagem} className="flex-1 max-w-xs" />
                  <span className="text-sm font-medium">{itensPesados}/{totalItens}</span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Ordem</TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-center">Tipo</TableHead>
                    <TableHead className="text-right">Qtd. Lote (g)</TableHead>
                    <TableHead className="text-right">Tolerância</TableHead>
                    <TableHead className="text-right">Pesado (g)</TableHead>
                    <TableHead>Lote MP</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ordem.itens_pesagem.map((item) => (
                    <TableRow 
                      key={item.id}
                      className={item.tipo_pesagem === 'CRITICA' ? 'bg-destructive/5' : ''}
                    >
                      <TableCell>
                        <span className="w-7 h-7 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs">
                          {item.ordem}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium">
                        {item.insumo_nome}
                        {item.motivo_critico && (
                          <p className="text-xs text-muted-foreground">{item.motivo_critico}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {item.tipo_pesagem === 'CRITICA' ? (
                          <Badge variant="destructive" className="text-xs">CRÍTICA</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">PADRÃO</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {item.quantidade_lote_g.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.quantidade_minima_g.toFixed(2)} - {item.quantidade_maxima_g.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantidade_pesada_g !== undefined ? (
                          <span className={item.dentro_tolerancia ? 'text-secondary' : 'text-destructive'}>
                            {item.quantidade_pesada_g.toFixed(4)}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.numero_lote || '-'}
                      </TableCell>
                      <TableCell>
                        {item.quantidade_pesada_g !== undefined ? (
                          item.dentro_tolerancia ? (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-100 text-amber-800 border-amber-300">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Tolerância
                            </Badge>
                          )
                        ) : (
                          <Badge variant="outline" className="text-xs">Pendente</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Pick List */}
        <TabsContent value="pick-list">
          <PickListLotes
            itensPesagem={ordem.itens_pesagem}
            alocacoesExistentes={ordem.alocacoes_lote}
            onAlocarLote={handleAlocarLote}
          />
        </TabsContent>

        {/* Tab: QC */}
        <TabsContent value="qc">
          <ControleQualidadeForm
            opId={ordem.id}
            qcExistente={ordem.controle_qualidade}
            pesoCapsulaAlvo={ordem.peso_unidade_mg}
            onSalvar={handleSalvarQC}
            disabled={ordem.status !== 'EM_PRODUCAO'}
          />
        </TabsContent>

        {/* Tab: Documento */}
        <TabsContent value="documento">
          <OPDocumentoPDF op={ordem} />
        </TabsContent>
      </Tabs>

      {/* Rastreabilidade */}
      {ordem.status === 'FINALIZADA' && ordem.lotes_mp_origem.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">Rastreabilidade - Lotes de Origem</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {ordem.lotes_mp_origem.map((loteId) => (
                <Badge key={loteId} variant="outline" className="font-mono">
                  {loteId.slice(0, 8)}...
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog Finalizar */}
      <Dialog open={dialogFinalizar} onOpenChange={setDialogFinalizar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Produção</DialogTitle>
            <DialogDescription>
              Informe as quantidades finais para fechar a OP {ordem.codigo}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Quantidade Produzida</Label>
              <Input
                type="number"
                value={qtdProduzida}
                onChange={(e) => setQtdProduzida(e.target.value)}
                placeholder={String(ordem.quantidade_com_acrescimo)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Planejado: {ordem.quantidade_com_acrescimo.toLocaleString()}
              </p>
            </div>
            
            <div>
              <Label>Quantidade Aprovada</Label>
              <Input
                type="number"
                value={qtdAprovada}
                onChange={(e) => setQtdAprovada(e.target.value)}
                placeholder={String(ordem.quantidade_planejada)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Objetivo: {ordem.quantidade_planejada.toLocaleString()}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogFinalizar(false)}>
              Cancelar
            </Button>
            <Button onClick={handleFinalizar} className="bg-secondary hover:bg-secondary/90">
              <Check className="h-4 w-4 mr-2" />
              Confirmar Finalização
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
