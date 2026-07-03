import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Factory, ArrowLeft, Play, Check, XCircle,
  Package, Scale, ClipboardCheck, FileText, AlertTriangle,
  Calendar, Users, RefreshCw, Lock, Unlock, Printer,
  QrCode, Box, ListChecks, Beaker, Siren, Download
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
import { EtapasProducaoTracker, type EtapaProducao, type TipoApresentacao, ETAPAS } from '@/components/producao/EtapasProducaoTracker';
import { OPTabResumoAuditoria } from '@/components/producao/OPTabResumoAuditoria';
import { OPTabEmbalagens } from '@/components/producao/OPTabEmbalagens';
import { OPTabPesagemIndustrial } from '@/components/producao/OPTabPesagemIndustrial';
import { OPTabProcesso } from '@/components/producao/OPTabProcesso';
import { OPCabecalhoMaster } from '@/components/producao/OPCabecalhoMaster';
import { OPPreMixGeometrico } from '@/components/producao/OPPreMixGeometrico';
import { OPChecklistOperacional } from '@/components/producao/OPChecklistOperacional';
import { OPImpressaoTemplate } from '@/components/producao/OPImpressaoTemplate';
import { CustoOPDashboard } from '@/components/producao/CustoOPDashboard';
import { useOPIndustrial } from '@/hooks/use-op-industrial';
import { useCustoOPActions, useCustoOP, useConfigCustosProducao } from '@/hooks/use-custo-industrial';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { StatusOP, OPMateriaPrima, OPChecklist, OPPesagemCritica } from '@/types/op-industrial';
import { QRCodeAuditoria } from '@/components/shared/QRCodeAuditoria';

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

  const { criarCustoOP, registrarLoteConsumido, calcularCustoTotal } = useCustoOPActions();
  const { custo, lotesConsumidos } = useCustoOP(id);
  const { config: configCustos } = useConfigCustosProducao();

  const [pesagensCriticas, setPesagensCriticas] = useState<OPPesagemCritica[]>([]);
  const [dialogFinalizar, setDialogFinalizar] = useState(false);
  const [dialogImpressao, setDialogImpressao] = useState(false);
  const [qtdProduzida, setQtdProduzida] = useState('');
  const [qtdAprovada, setQtdAprovada] = useState('');
  const [etapaAtual, setEtapaAtual] = useState<EtapaProducao | null>(null);
  const [isRecalculando, setIsRecalculando] = useState(false);
  const [bannerRequisicao, setBannerRequisicao] = useState<{ itens: number; requisicaoId: string } | null>(null);

  const handleAbrirImpressao = () => {
    setDialogImpressao(true);
  };

  const handleImprimir = () => {
    setDialogImpressao(false);
    navigate(`/producao/ordens/${currentOP.id}/imprimir`);
  };

  const handleExportarPDF = () => {
    if (!currentOP?.id) return;
    // abre a folha vetorial (nítida) — usuário escolhe "Salvar como PDF" no diálogo
    window.open(`/producao/ordens/${currentOP.id}/imprimir`, '_blank');
  };

  const handleRecalcularMateriais = async () => {
    if (!id) return;
    setIsRecalculando(true);
    try {
      const { data: prep, error: prepErr } = await supabase
        .rpc('preparar_op_materiais', { p_op_id: id });
      
      if (prepErr) throw prepErr;

      // Invalidar queries para recarregar dados
      await buscarOP(id);
      await buscarMateriasPrimas(id);

      if (prep?.possui_requisicao) {
        setBannerRequisicao({
          itens: prep.itens_para_comprar || 0,
          requisicaoId: prep.requisicao_id || '',
        });
        toast.info(`${prep.itens_para_comprar} insumo(s) sem estoque — requisição de compra gerada`);
      } else {
        toast.success('Materiais recalculados com sucesso');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao recalcular materiais: ${msg}`);
    } finally {
      setIsRecalculando(false);
    }
  };

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

    if (id && currentOP) {
      const success = await atualizarStatus(id, 'FINALIZADA');
      if (success) {
        // Disparar calculo de custo apos finalizacao
        try {
          // 1. Criar registro de custo da OP
          const custoOPData = await criarCustoOP(
            id,
            currentOP.codigo,
            currentOP.tipo_apresentacao as 'CAPSULA' | 'LIQUIDO' | 'PO',
            currentOP.quantidade_planejada || 0
          );

          if (custoOPData) {
            // 2. Registrar lotes consumidos
            if (materiasPrimas && materiasPrimas.length > 0) {
              for (const mp of materiasPrimas) {
                if (mp.lote_id && mp.quantidade_real_g) {
                  // Buscar custo do insumo
                  const { data: insumoData } = await supabase
                    .from('itens')
                    .select('descricao_interna, custo_por_unidade_interna, unidade_interna')
                    .eq('id', mp.insumo_id)
                    .single();

                  if (insumoData) {
                    // Converter custo para por grama se necessario
                    let custoUnitarioG = insumoData.custo_por_unidade_interna || 0;
                    if (insumoData.unidade_interna && insumoData.unidade_interna !== 'g') {
                      // Se unidade for kg, dividir por 1000
                      if (insumoData.unidade_interna === 'kg') {
                        custoUnitarioG = custoUnitarioG / 1000;
                      }
                    }

                    await registrarLoteConsumido(
                      custoOPData.id,
                      mp.lote_id,
                      mp.numero_lote || 'N/A',
                      insumoData.descricao_interna || 'Insumo',
                      mp.quantidade_real_g,
                      custoUnitarioG
                    );
                  }
                }
              }
            }

            // 3. Calcular custo total
            const tempoTotalMinutos = currentOP.tempo_total_minutos || 0;
            const quantidadeProduzida = produzida || currentOP.quantidade_planejada || 0;
            await calcularCustoTotal(
              custoOPData.id,
              tempoTotalMinutos,
              currentOP.quantidade_planejada || 0,
              quantidadeProduzida
            );

            toast.success('Custo da OP calculado com sucesso');
          }
        } catch (err) {
          console.error('Erro ao calcular custo:', err);
          toast.warning('OP finalizada, mas houve erro ao calcular custo (parcial)');
        }

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
              <>
                <Button onClick={handleIniciar}>
                  <Play className="h-4 w-4 mr-2" />
                  Iniciar Produção
                </Button>
                <Button 
                  variant="outline"
                  onClick={handleRecalcularMateriais}
                  disabled={isRecalculando}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isRecalculando ? 'animate-spin' : ''}`} />
                  {isRecalculando ? 'Recalculando...' : 'Recalcular Materiais'}
                </Button>
              </>
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

      {/* Banner de requisição de compra */}
      {bannerRequisicao && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <span className="text-sm text-amber-800">
              <strong>{bannerRequisicao.itens} insumo(s) sem estoque</strong> — requisição de compra gerada
            </span>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/producao/requisicoes')}
          >
            Ver Requisições
          </Button>
        </div>
      )}

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

      {/* QR Code de rastreabilidade */}
      {'qr_code_hash' in currentOP && (currentOP as unknown as Record<string, unknown>).qr_code_hash && (
        <div className="mb-6 flex justify-center">
          <QRCodeAuditoria
            tipo="OP"
            id={id!}
            hash={String((currentOP as unknown as Record<string, unknown>).qr_code_hash)}
            codigo={currentOP.codigo}
            label={`OP ${currentOP.codigo}`}
            size={100}
          />
        </div>
      )}

      {/* Tracker de Etapas - Sempre visível */}
      <Card className="mb-6">
        <CardHeader className="py-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Factory className="h-4 w-4" />
            Acompanhamento de Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4">
          <EtapasProducaoTracker etapaAtual={etapaAtual} tipoApresentacao={(currentOP.tipo_apresentacao as TipoApresentacao) || 'CAPSULA'} />
          
          {/* Seletor de etapa (para operador atualizar) - Apenas quando Em Produção */}
          {currentOP.status === 'EM_PRODUCAO' && (() => {
            const tipo = (currentOP.tipo_apresentacao as TipoApresentacao) || 'CAPSULA';
            const etapasFiltradas = ETAPAS.filter(e => !e.excluirPara?.includes(tipo));
            return (
            <div className="mt-4 flex flex-wrap gap-2">
              {etapasFiltradas.map((etapa) => {
                const isActive = etapaAtual === etapa.key;
                
                return (
                  <Button
                    key={etapa.key}
                    variant={isActive ? "default" : "outline"}
                    size="sm"
                    className={isActive ? "bg-success hover:bg-success/90" : ""}
                    onClick={() => setEtapaAtual(etapa.key)}
                  >
                    {etapa.label}
                  </Button>
                );
              })}
            </div>
            );
          })()}
        </CardContent>
      </Card>

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
      <Tabs defaultValue="resumo" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="resumo" className="flex items-center gap-2">
            <QrCode className="h-4 w-4" />
            Resumo & Auditoria
          </TabsTrigger>
          <TabsTrigger value="materias-primas" className="flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Pesagem ({materiasPrimas.length})
          </TabsTrigger>
          {temAtivosCriticos && (
            <TabsTrigger value="premix" className="flex items-center gap-2 text-destructive">
              <Siren className="h-4 w-4" />
              Pré-Mix Crítico
            </TabsTrigger>
          )}
          <TabsTrigger value="checklist" className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Checklist
          </TabsTrigger>
          <TabsTrigger value="processo" className="flex items-center gap-2">
            <ListChecks className="h-4 w-4" />
            Processo
          </TabsTrigger>
          <TabsTrigger value="embalagens" className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            Embalagens
          </TabsTrigger>
          <TabsTrigger value="documentos" className="flex items-center gap-2 text-primary">
            <Printer className="h-4 w-4" />
            Documentos A4
          </TabsTrigger>
        </TabsList>

        {/* Tab: Resumo & Auditoria */}
        <TabsContent value="resumo">
          <OPTabResumoAuditoria op={currentOP as unknown as React.ComponentProps<typeof OPTabResumoAuditoria>['op']} />
        </TabsContent>

        {/* Tab: Matérias-Primas - Formato Industrial Profissional */}
        <TabsContent value="materias-primas">
          <OPTabPesagemIndustrial
            materiasPrimas={materiasPrimas}
            pesagensCriticas={pesagensCriticas}
            statusOP={currentOP.status}
            totalCapsulas={currentOP.total_capsulas_com_acrescimo}
            pesoCapsula={currentOP.peso_capsula_mg}
            onRegistrarPesagem={async (id, pesoReal, lote) => {
              const success = await registrarPesagem(id, pesoReal, lote);
              if (success) refresh();
              return success;
            }}
          />
        </TabsContent>

        {/* Tab: Pré-Mix (apenas se houver ativos críticos) */}
        {temAtivosCriticos && (
          <TabsContent value="premix">
            <OPPreMixGeometrico
              ativosCriticos={materiasPrimas
                .filter(mp => mp.pesagem_critica || mp.quantidade_teorica_g < 0.01)
                .map(mp => ({
                  id: mp.id,
                  nome: mp.insumo_nome,
                  quantidade_mg: (mp.quantidade_teorica_g || 0) * 1000,
                  quantidade_g: mp.quantidade_teorica_g || 0,
                  potencia_coa: undefined,
                  potencia_unidade: undefined,
                  fator_correcao: undefined,
                  metodo_distribuicao: mp.motivo_critico?.includes('ULTRA') ? 'Distribuição Geométrica' : 'Pré-Mix Simples',
                }))}
              diluenteNome={currentOP.excipiente_base || 'Amido de Milho'}
              diluenteQuantidadeTotal={
                materiasPrimas
                  .filter(mp => mp.categoria === 'EXCIPIENTE_BASE')
                  .reduce((acc, mp) => acc + (mp.quantidade_teorica_g || 0), 0)
              }
            />
          </TabsContent>
        )}

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
              

            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Processo Passo a Passo */}
        <TabsContent value="processo">
          <OPTabProcesso 
            opId={id!}
            status={currentOP.status}
            tipoProduto={currentOP.tipo_apresentacao || 'CAPSULA'}
            temAtivosCriticos={temAtivosCriticos}
            excipienteBase={currentOP.excipiente_base}
          />
        </TabsContent>

        {/* Tab: Embalagens */}
        <TabsContent value="embalagens">
          <OPTabEmbalagens 
            opId={id!}
            status={currentOP.status}
            quantidadeFrascos={currentOP.quantidade_frascos}
          />
        </TabsContent>

        {/* Tab: Documentos A4 - Impressão Profissional */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Documentos A4 (7 Páginas)
              </CardTitle>
              <CardDescription>
                Impressão profissional com formatação ANVISA BPF, assinaturas de RT e checklist completo
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Botões de Ação */}
              <div className="flex gap-4">
                <Button 
                  onClick={handleAbrirImpressao}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <Printer className="h-4 w-4" />
                  Abrir / Imprimir (A4)
                </Button>
                <Button 
                  onClick={handleExportarPDF}
                  variant="outline"
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <Download className="h-4 w-4" />
                  Exportar PDF
                </Button>
              </div>
              
              
              <div className="bg-blue-50 border border-blue-200 rounded p-4">
                <p className="text-sm text-blue-900">
                  💡 Clique em <strong>"Abrir / Imprimir (A4)"</strong> para visualizar a impressão em tela cheia com formatação profissional (7 páginas).
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Impressão */}
      <Dialog open={dialogImpressao} onOpenChange={setDialogImpressao}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-auto" style={{ width: '100%' }}>
          <DialogHeader>
            <DialogTitle>Impressão da OP {currentOP.numero}</DialogTitle>
            <DialogDescription>
              Visualize como ficará a impressão antes de imprimir
            </DialogDescription>
          </DialogHeader>
          
            {/* Mensagem informativa */}
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-900">
              Clique em <strong>"Imprimir Agora"</strong> para abrir a impressão em tela cheia com formatação profissional (7 páginas).
            </p>
          </div>
          
          <DialogFooter className="mt-6">
            <Button 
              variant="outline"
              onClick={() => setDialogImpressao(false)}
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleImprimir}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Imprimir Agora
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custo Real Industrial */}
      {currentOP.status === 'FINALIZADA' && (
        <div className="mt-8">
          {custo && lotesConsumidos ? (
            <Card>
              <CardHeader>
                <CardTitle>Custo Real Industrial</CardTitle>
              </CardHeader>
              <CardContent>
                <CustoOPDashboard custo={custo} lotesConsumidos={lotesConsumidos} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Custo Real Industrial</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Esta OP foi finalizada mas o custo ainda não foi calculado.
                </p>
                <Button 
                  onClick={async () => {
                    try {
                      const custoOPData = await criarCustoOP(
                        id!,
                        currentOP.codigo,
                        currentOP.tipo_apresentacao as 'CAPSULA' | 'LIQUIDO' | 'PO',
                        currentOP.quantidade_planejada || 0
                      );

                      if (custoOPData && materiasPrimas && materiasPrimas.length > 0) {
                        for (const mp of materiasPrimas) {
                          if (mp.lote_id && mp.quantidade_real_g) {
                            const { data: insumoData } = await supabase
                              .from('itens')
                              .select('descricao_interna, custo_por_unidade_interna, unidade_interna')
                              .eq('id', mp.insumo_id)
                              .single();

                            if (insumoData) {
                              let custoUnitarioG = insumoData.custo_por_unidade_interna || 0;
                              if (insumoData.unidade_interna && insumoData.unidade_interna !== 'g') {
                                if (insumoData.unidade_interna === 'kg') {
                                  custoUnitarioG = custoUnitarioG / 1000;
                                }
                              }

                              await registrarLoteConsumido(
                                custoOPData.id,
                                mp.lote_id,
                                mp.numero_lote || 'N/A',
                                insumoData.descricao_interna || 'Insumo',
                                mp.quantidade_real_g,
                                custoUnitarioG
                              );
                            }
                          }
                        }
                      }

                      if (custoOPData) {
                        const tempoTotalMinutos = currentOP.tempo_total_minutos || 0;
                        const quantidadeProduzida = currentOP.quantidade_planejada || 0;
                        await calcularCustoTotal(
                          custoOPData.id,
                          tempoTotalMinutos,
                          currentOP.quantidade_planejada || 0,
                          quantidadeProduzida
                        );
                        toast.success('Custo calculado com sucesso');
                        refresh();
                      }
                    } catch (err) {
                      console.error('Erro:', err);
                      toast.error('Erro ao calcular custo');
                    }
                  }}
                >
                  Calcular Custo desta OP
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
