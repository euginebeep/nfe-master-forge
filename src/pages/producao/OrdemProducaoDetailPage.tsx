import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Factory, ArrowLeft, Play, Check, XCircle,
  Package, Scale, ClipboardCheck, FileText, AlertTriangle,
  Calendar, Users, RefreshCw, Lock, Unlock, Printer
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { EtapasProducaoTracker, type EtapaProducao } from '@/components/producao/EtapasProducaoTracker';
import { useOPIndustrial } from '@/hooks/use-op-industrial';
import { toast } from 'sonner';
import type { StatusOP, OPMateriaPrima, OPChecklist, OPPesagemCritica } from '@/types/op-industrial';

export default function OrdemProducaoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentOP,
    materiasPrimas,
    checklist,
    isLoading,
    buscarOP,
    buscarMateriasPrimas,
    buscarChecklist,
    atualizarStatus,
    registrarPesagem,
    verificarChecklist,
  } = useOPIndustrial();

  const [pesagensCriticas, setPesagensCriticas] = useState<OPPesagemCritica[]>([]);
  const [dialogFinalizar, setDialogFinalizar] = useState(false);
  const [qtdProduzida, setQtdProduzida] = useState('');
  const [qtdAprovada, setQtdAprovada] = useState('');
  const [etapaAtual, setEtapaAtual] = useState<EtapaProducao | null>(null);

  // Carregar dados da OP
  useEffect(() => {
    if (id) {
      buscarOP(id);
      buscarMateriasPrimas(id);
      buscarChecklist(id);
      // Buscar pesagens críticas
      import('@/integrations/supabase/client').then(({ supabase }) => {
        supabase
          .from('op_pesagens_criticas')
          .select('*')
          .eq('op_id', id)
          .order('created_at', { ascending: true })
          .then(({ data }) => {
            setPesagensCriticas((data || []) as unknown as OPPesagemCritica[]);
          });
      });
    }
  }, [id, buscarOP, buscarMateriasPrimas, buscarChecklist]);

  const refresh = () => {
    if (id) {
      buscarOP(id);
      buscarMateriasPrimas(id);
      buscarChecklist(id);
    }
  };

  if (isLoading || !currentOP) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        {isLoading ? (
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Factory className="h-12 w-12 text-muted-foreground" />
            <h2 className="text-xl font-medium">OP não encontrada</h2>
            <Button onClick={() => navigate('/producao/ordens')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          </>
        )}
      </div>
    );
  }

  const getStatusConfig = (status: StatusOP) => {
    const map: Record<StatusOP, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string; className?: string }> = {
      PLANEJADA: { variant: 'outline', label: 'Planejada' },
      AGUARDANDO_MATERIAIS: { variant: 'outline', label: 'Aguardando Materiais', className: 'border-warning text-warning' },
      EM_PRODUCAO: { variant: 'default', label: 'Em Produção' },
      FINALIZADA: { variant: 'secondary', label: 'Finalizada' },
      BLOQUEADA: { variant: 'destructive', label: 'Bloqueada' },
      CANCELADA: { variant: 'destructive', label: 'Cancelada' },
    };
    return map[status] || map.PLANEJADA;
  };

  const statusConfig = getStatusConfig(currentOP.status);

  // Calcular progresso
  const totalItens = materiasPrimas.length;
  const itensPesados = materiasPrimas.filter(i => i.quantidade_real_g !== null && i.quantidade_real_g !== undefined).length;
  const progressoPesagem = totalItens > 0 ? (itensPesados / totalItens) * 100 : 0;

  const totalChecklist = checklist.length;
  const checklistVerificados = checklist.filter(c => c.verificado).length;
  const progressoChecklist = totalChecklist > 0 ? (checklistVerificados / totalChecklist) * 100 : 0;

  const temAtivosCriticos = materiasPrimas.some(i => i.pesagem_critica);

  // Handlers
  const handleIniciar = async () => {
    if (id) {
      const success = await atualizarStatus(id, 'EM_PRODUCAO');
      if (success) refresh();
    }
  };

  const handleBloquear = async () => {
    if (id) {
      const success = await atualizarStatus(id, 'BLOQUEADA', 'Bloqueio manual pelo operador');
      if (success) refresh();
    }
  };

  const handleDesbloquear = async () => {
    if (id) {
      const success = await atualizarStatus(id, 'EM_PRODUCAO');
      if (success) refresh();
    }
  };

  const handleFinalizar = async () => {
    if (totalChecklist > 0 && checklistVerificados < totalChecklist) {
      toast.error('Checklist obrigatório: conclua 100% antes de finalizar a OP');
      return;
    }

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

    if (id) {
      const success = await atualizarStatus(id, 'FINALIZADA');
      if (success) {
        setDialogFinalizar(false);
        refresh();
      }
    }
  };

  const handleVerificarChecklist = async (checklistId: string) => {
    const success = await verificarChecklist(checklistId);
    if (success) {
      toast.success('Item do checklist verificado!');
      buscarChecklist(id!);
    } else {
      toast.error('Erro ao verificar item do checklist');
    }
  };

  // Agrupar checklist por categoria
  const checklistPorCategoria = checklist.reduce((acc, item) => {
    if (!acc[item.categoria]) acc[item.categoria] = [];
    acc[item.categoria].push(item);
    return acc;
  }, {} as Record<string, OPChecklist[]>);

  const categoriasChecklist = [
    { key: 'PRE_PRODUCAO', label: 'Pré-Produção' },
    { key: 'DURANTE_PRODUCAO', label: 'Durante Produção' },
    { key: 'POS_PRODUCAO', label: 'Pós-Produção' },
    { key: 'QC', label: 'Controle de Qualidade' },
  ];

  return (
    <div>
      <PageHeader
        title={currentOP.codigo}
        description={currentOP.produto_nome}
        icon={Factory}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/producao/ordens')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button variant="outline" size="icon" onClick={refresh}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            
            {currentOP.status === 'PLANEJADA' && (
              <Button onClick={handleIniciar}>
                <Play className="h-4 w-4 mr-2" />
                Iniciar Produção
              </Button>
            )}
            
            {currentOP.status === 'EM_PRODUCAO' && (
              <>
                <Button variant="destructive" onClick={handleBloquear}>
                  <Lock className="h-4 w-4 mr-2" />
                  Bloquear
                </Button>
                <Button 
                  className="bg-secondary hover:bg-secondary/90"
                  onClick={() => {
                    setQtdProduzida(String(currentOP.total_capsulas_com_acrescimo));
                    setQtdAprovada(String(currentOP.total_capsulas));
                    setDialogFinalizar(true);
                  }}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Finalizar
                </Button>
              </>
            )}
            
            {currentOP.status === 'BLOQUEADA' && (
              <Button onClick={handleDesbloquear}>
                <Unlock className="h-4 w-4 mr-2" />
                Desbloquear
              </Button>
            )}
          </div>
        }
      />

      {/* Cabeçalho com informações principais */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={statusConfig.variant} className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Fórmula</span>
              <span className="font-mono text-sm">
                {currentOP.formula_codigo || 'OP Manual'} 
                {currentOP.formula_versao && ` v${currentOP.formula_versao}`}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Excipiente</span>
              <span className="text-sm">{currentOP.excipiente_base}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-2xl font-bold">{currentOP.quantidade_frascos.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Frascos</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Scale className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold">{currentOP.total_capsulas_com_acrescimo.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Cápsulas (+{currentOP.acrescimo_percentual}%)</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-bold font-mono">{currentOP.lote_produto_acabado}</p>
            <p className="text-xs text-muted-foreground">Lote PA</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
            <p className="text-sm font-medium truncate">{currentOP.responsavel_producao_nome || '-'}</p>
            <p className="text-xs text-muted-foreground">Responsável</p>
          </CardContent>
        </Card>
      </div>

      {/* Tracker de Etapas - Apenas quando Em Produção */}
      {currentOP.status === 'EM_PRODUCAO' && (
        <Card className="mb-6">
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Factory className="h-4 w-4" />
              Acompanhamento de Produção
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-4">
            <EtapasProducaoTracker etapaAtual={etapaAtual} />
            
            {/* Seletor de etapa (para operador atualizar) */}
            <div className="mt-4 flex flex-wrap gap-2">
              {(['SEPARACAO_MP', 'PESAGEM', 'MISTURA', 'ENCAPSULAMENTO', 'ENVASE', 
                'FECHAMENTO_INDUCAO', 'ROTULACAO', 'MARCACAO_VALIDADE', 'CONTAGEM', 
                'EMPACOTAMENTO', 'CONFERENCIA', 'EMISSAO_NF', 'COLETA'] as EtapaProducao[]).map((etapa, idx) => {
                const labels = ['Separação', 'Pesagem', 'Mistura', 'Encapsular', 'Envase', 
                  'Indução', 'Rótulo', 'Validade', 'Contagem', 'Empacot.', 'Conferir', 'NF', 'Coleta'];
                const isActive = etapaAtual === etapa;
                
                return (
                  <Button
                    key={etapa}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={isActive ? "bg-success hover:bg-success/90" : ""}
                    onClick={() => setEtapaAtual(etapa)}
                  >
                    {labels[idx]}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progresso */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Pesagem</span>
              <span className="text-sm">{itensPesados}/{totalItens}</span>
            </div>
            <Progress 
              value={progressoPesagem} 
              className="h-3"
              indicatorClassName={progressoPesagem === 100 ? "bg-success" : "bg-muted-foreground/30"}
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Checklist</span>
              <span className="text-sm">{checklistVerificados}/{totalChecklist}</span>
            </div>
            <Progress 
              value={progressoChecklist} 
              className="h-3"
              indicatorClassName={progressoChecklist === 100 ? "bg-success" : "bg-muted-foreground/30"}
            />
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
                Esta OP contém {pesagensCriticas.length} ativo(s) que exigem pesagem crítica com dupla conferência.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs principais */}
      <Tabs defaultValue="materias-primas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="materias-primas" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Matérias-Primas ({materiasPrimas.length})
          </TabsTrigger>
          <TabsTrigger value="checklist" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="pesagem-critica" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Pesagem Crítica ({pesagensCriticas.length})
          </TabsTrigger>
          <TabsTrigger value="ficha" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Ficha de Produção
          </TabsTrigger>
        </TabsList>

        {/* Tab: Matérias-Primas */}
        <TabsContent value="materias-primas">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Lista de Pesagem - Ordem de Mistura Industrial
              </CardTitle>
              <CardDescription>
                Ordem fixa ANVISA: Ativos → Excipiente Base → Dióxido de Silício → Talco → Estearato de Magnésio
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Ordem</TableHead>
                    <TableHead>Insumo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Teórico (g)</TableHead>
                    <TableHead className="text-right">Tolerância</TableHead>
                    <TableHead className="text-right">Real (g)</TableHead>
                    <TableHead>Lote</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {materiasPrimas.map((item) => (
                    <TableRow 
                      key={item.id}
                      className={item.pesagem_critica ? 'bg-destructive/5' : ''}
                    >
                      <TableCell>
                        <span className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-sm">
                          {item.ordem_mistura}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{item.insumo_nome}</p>
                          {item.motivo_critico && (
                            <p className="text-xs text-destructive flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {item.motivo_critico}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {item.categoria}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        {item.quantidade_teorica_g.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {item.quantidade_minima_g.toFixed(2)} - {item.quantidade_maxima_g.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {item.quantidade_real_g !== null && item.quantidade_real_g !== undefined ? (
                          <span className={item.dentro_tolerancia ? 'text-secondary' : 'text-destructive'}>
                            {item.quantidade_real_g.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.numero_lote || '-'}
                      </TableCell>
                      <TableCell>
                        {item.quantidade_real_g !== null && item.quantidade_real_g !== undefined ? (
                          item.dentro_tolerancia ? (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs border-warning text-warning">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Fora
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

        {/* Tab: Checklist */}
        <TabsContent value="checklist">
          <div className="space-y-4">
            {/* Aviso sobre status da OP */}
            {currentOP.status !== 'EM_PRODUCAO' && (
              <Card className="border-warning/50 bg-warning/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  <div>
                    <p className="font-medium text-warning">Checklist por fase</p>
                    <p className="text-sm text-muted-foreground">
                      {currentOP.status === 'PLANEJADA' && 'Pré-Produção liberada. Itens de Produção / Pós-Produção / QC só após “Iniciar Produção”.'}
                      {currentOP.status === 'AGUARDANDO_MATERIAIS' && 'Pré-Produção liberada. Itens de Produção / Pós-Produção / QC só após “Iniciar Produção”.'}
                      {currentOP.status === 'FINALIZADA' && 'Esta OP já foi finalizada e o checklist não pode ser alterado.'}
                      {currentOP.status === 'BLOQUEADA' && 'Desbloqueie a OP para continuar com o checklist.'}
                      {currentOP.status === 'CANCELADA' && 'Esta OP foi cancelada.'}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {categoriasChecklist.map(({ key, label }) => {
              const items = checklistPorCategoria[key] || [];
              if (items.length === 0) return null;
              
              const verificadosCategoria = items.filter(i => i.verificado).length;
              
              return (
                <Card key={key}>
                  <CardHeader className="py-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{label}</CardTitle>
                      <span className="text-sm text-muted-foreground">
                        {verificadosCategoria}/{items.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2">
                      {items.map((item) => {
                        const status = currentOP.status;
                        const opImutavel = status === 'FINALIZADA' || status === 'CANCELADA';
                        const opBloqueada = status === 'BLOQUEADA';

                        const liberadoPorFase =
                          item.categoria === 'PRE_PRODUCAO'
                            ? status === 'PLANEJADA' || status === 'AGUARDANDO_MATERIAIS' || status === 'EM_PRODUCAO'
                            : status === 'EM_PRODUCAO';

                        const podeInteragir = !item.verificado && !opImutavel && !opBloqueada;
                        const podeMarcar = podeInteragir && liberadoPorFase;

                        return (
                          <div 
                            key={item.id} 
                            className={`flex items-center gap-3 p-2 rounded hover:bg-muted/50 ${
                              !podeMarcar ? 'opacity-60' : ''
                            }`}
                          >
                            <Checkbox 
                              checked={item.verificado}
                              onCheckedChange={() => {
                                if (podeMarcar) {
                                  handleVerificarChecklist(item.id);
                                  return;
                                }

                                if (!podeInteragir) return;

                                toast.warning(
                                  'Itens de Produção / Pós-Produção / QC só podem ser marcados após “Iniciar Produção”.'
                                );
                              }}
                              disabled={!podeInteragir}
                              className={!podeMarcar ? 'cursor-not-allowed' : ''}
                            />
                            <div className="flex-1">
                              <p className={item.verificado ? 'text-muted-foreground line-through' : ''}>
                                {item.item}
                              </p>
                              {item.verificado && item.verificado_em && (
                                <p className="text-xs text-muted-foreground">
                                  Verificado em {new Date(item.verificado_em).toLocaleString('pt-BR')}
                                </p>
                              )}
                            </div>
                            {item.obrigatorio && (
                              <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Tab: Pesagem Crítica */}
        <TabsContent value="pesagem-critica">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Pesagem Crítica - Dupla Conferência Obrigatória
              </CardTitle>
              <CardDescription>
                Ativos com quantidade &lt; 1mg ou em unidades UI/MCG exigem conferência dupla
              </CardDescription>
            </CardHeader>
            <CardContent>
              {pesagensCriticas.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum ativo crítico nesta OP
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ativo</TableHead>
                      <TableHead className="text-right">Qtd. Teórica (mg)</TableHead>
                      <TableHead className="text-right">Qtd. Pesada (mg)</TableHead>
                      <TableHead>Pesado por</TableHead>
                      <TableHead>Conferido por</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pesagensCriticas.map((pc) => (
                      <TableRow key={pc.id}>
                        <TableCell className="font-medium">{pc.insumo_nome}</TableCell>
                        <TableCell className="text-right font-mono">
                          {pc.quantidade_teorica_mg.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {pc.quantidade_pesada_mg?.toFixed(4) || '-'}
                        </TableCell>
                        <TableCell>{pc.operador_pesagem_nome || '-'}</TableCell>
                        <TableCell>{pc.conferente_nome || '-'}</TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              pc.status === 'CONFERIDO' ? 'secondary' : 
                              pc.status === 'REPROVADO' ? 'destructive' : 'outline'
                            }
                          >
                            {pc.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Ficha de Produção */}
        <TabsContent value="ficha">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Ficha de Produção - {currentOP.codigo}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Identificação</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Código:</span> {currentOP.codigo}</p>
                      <p><span className="text-muted-foreground">Produto:</span> {currentOP.produto_nome}</p>
                      <p><span className="text-muted-foreground">Fórmula:</span> {currentOP.formula_codigo || 'OP Manual'}</p>
                      <p><span className="text-muted-foreground">Lote PA:</span> {currentOP.lote_produto_acabado}</p>
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Quantidades</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Frascos:</span> {currentOP.quantidade_frascos}</p>
                      <p><span className="text-muted-foreground">Cápsulas/Frasco:</span> {currentOP.capsulas_por_frasco}</p>
                      <p><span className="text-muted-foreground">Total:</span> {currentOP.total_capsulas.toLocaleString()}</p>
                      <p><span className="text-muted-foreground">Com Acréscimo (+{currentOP.acrescimo_percentual}%):</span> {currentOP.total_capsulas_com_acrescimo.toLocaleString()}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Datas</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Fabricação:</span> {new Date(currentOP.data_fabricacao).toLocaleDateString('pt-BR')}</p>
                      <p><span className="text-muted-foreground">Validade:</span> {new Date(currentOP.data_validade).toLocaleDateString('pt-BR')}</p>
                      {currentOP.data_inicio_producao && (
                        <p><span className="text-muted-foreground">Início Produção:</span> {new Date(currentOP.data_inicio_producao).toLocaleString('pt-BR')}</p>
                      )}
                      {currentOP.data_fim_producao && (
                        <p><span className="text-muted-foreground">Fim Produção:</span> {new Date(currentOP.data_fim_producao).toLocaleString('pt-BR')}</p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-semibold mb-2">Configuração</h4>
                    <div className="space-y-1 text-sm">
                      <p><span className="text-muted-foreground">Tipo Cápsula:</span> {currentOP.tipo_capsula}</p>
                      <p><span className="text-muted-foreground">Peso Cápsula:</span> {currentOP.peso_capsula_mg}mg</p>
                      <p><span className="text-muted-foreground">Excipiente Base:</span> {currentOP.excipiente_base}</p>
                      <p><span className="text-muted-foreground">Responsável:</span> {currentOP.responsavel_producao_nome || '-'}</p>
                    </div>
                  </div>
                </div>
              </div>
              
              {currentOP.observacoes && (
                <div className="mt-6">
                  <h4 className="font-semibold mb-2">Observações</h4>
                  <p className="text-sm bg-muted p-3 rounded">{currentOP.observacoes}</p>
                </div>
              )}
              
              <Separator className="my-6" />
              
              <div className="flex justify-end">
                <Button variant="outline" disabled>
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Ficha (Em breve)
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog Finalizar */}
      <Dialog open={dialogFinalizar} onOpenChange={setDialogFinalizar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar Produção</DialogTitle>
            <DialogDescription>
              Informe as quantidades finais para fechar a OP {currentOP.codigo}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Quantidade Produzida</Label>
              <Input
                type="number"
                value={qtdProduzida}
                onChange={(e) => setQtdProduzida(e.target.value)}
                placeholder={String(currentOP.total_capsulas_com_acrescimo)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Planejado: {currentOP.total_capsulas_com_acrescimo.toLocaleString()}
              </p>
            </div>
            
            <div>
              <Label>Quantidade Aprovada</Label>
              <Input
                type="number"
                value={qtdAprovada}
                onChange={(e) => setQtdAprovada(e.target.value)}
                placeholder={String(currentOP.total_capsulas)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Objetivo: {currentOP.total_capsulas.toLocaleString()}
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
