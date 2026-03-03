import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  useOrdensProducaoIndustrial 
} from '@/hooks/use-ordem-producao-industrial';
import { useLogValidacoesANVISA } from '@/hooks/use-validador-anvisa';
import { useSimulacoesProducao } from '@/hooks/use-simulador-producao';
import { 
  Factory, 
  DollarSign, 
  Shield, 
  Cpu,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  ArrowRight,
} from 'lucide-react';

export default function DashboardIndustrialPage() {
  const navigate = useNavigate();
  const { data: ordens, stats } = useOrdensProducaoIndustrial();
  const { logs: logsValidacao } = useLogValidacoesANVISA();
  const { simulacoes } = useSimulacoesProducao();

  // Métricas de validação
  const validacoesOK = logsValidacao.filter(l => l.resultado === 'OK').length;
  const validacoesAlerta = logsValidacao.filter(l => l.resultado === 'ALERTA').length;
  const validacoesBloqueio = logsValidacao.filter(l => l.resultado === 'BLOQUEIO').length;

  // Desvio médio das simulações
  const simulacoesComReal = simulacoes.filter(s => s.custo_real !== null);
  const desvioMedioCusto = simulacoesComReal.length > 0
    ? simulacoesComReal.reduce((sum, s) => sum + Math.abs(s.desvio_custo_percent || 0), 0) / simulacoesComReal.length
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Industrial"
        description="Visão geral de produção, custos, compliance e simulações"
        icon={Factory}
      />

      <div className="space-y-6">
        {/* Cards de Resumo */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/producao/ordens')}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Factory className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Ordens de Produção</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{stats.total}</span>
                <Badge variant="secondary">{stats.emProducao} em produção</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Validações ANVISA</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex items-center gap-1 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>{validacoesOK}</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <span>{validacoesAlerta}</span>
                </div>
                <div className="flex items-center gap-1 text-sm">
                  <XCircle className="h-4 w-4 text-destructive" />
                  <span>{validacoesBloqueio}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Cpu className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Simulações</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="text-3xl font-bold">{simulacoes.length}</span>
                {simulacoesComReal.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {simulacoesComReal.length} comparadas
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">Precisão Simulações</span>
              </div>
              <div className="mt-2">
                <span className="text-3xl font-bold">
                  {simulacoesComReal.length > 0 ? `±${desvioMedioCusto.toFixed(1)}%` : 'N/A'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs de Conteúdo */}
        <Tabs defaultValue="ordens" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ordens" className="flex items-center gap-2">
              <Factory className="h-4 w-4" />
              Ordens Recentes
            </TabsTrigger>
            <TabsTrigger value="validacoes" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Validações
            </TabsTrigger>
            <TabsTrigger value="simulacoes" className="flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Simulações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ordens">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Ordens de Produção Recentes</CardTitle>
                <Button variant="outline" size="sm" onClick={() => navigate('/producao/ordens')}>
                  Ver Todas
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </CardHeader>
              <CardContent>
                {ordens.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma ordem de produção encontrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {ordens.slice(0, 5).map(op => (
                      <div
                        key={op.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer"
                        onClick={() => navigate(`/producao/ordens/${op.id}`)}
                      >
                        <div className="flex items-center gap-3">
                          <Factory className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{op.codigo}</span>
                            <span className="text-sm text-muted-foreground ml-2">{op.produto_nome}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {(op.total_capsulas ?? 0).toLocaleString()} un
                          </span>
                          <Badge variant={
                            op.status === 'FINALIZADA' ? 'default' :
                            op.status === 'EM_PRODUCAO' ? 'secondary' :
                            op.status === 'BLOQUEADA' ? 'destructive' : 'outline'
                          }>
                            {op.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="validacoes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Últimas Validações ANVISA</CardTitle>
              </CardHeader>
              <CardContent>
                {logsValidacao.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma validação registrada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {logsValidacao.slice(0, 10).map(log => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          {log.resultado === 'OK' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {log.resultado === 'ALERTA' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                          {log.resultado === 'BLOQUEIO' && <XCircle className="h-4 w-4 text-destructive" />}
                          <div>
                            <span className="font-medium">{log.entidade_codigo}</span>
                            <span className="text-sm text-muted-foreground ml-2">{log.regra_aplicada}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{log.tipo_entidade}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(log.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="simulacoes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Simulações de Produção</CardTitle>
              </CardHeader>
              <CardContent>
                {simulacoes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhuma simulação realizada.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {simulacoes.slice(0, 10).map(sim => (
                      <div
                        key={sim.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <Cpu className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{sim.formula_codigo}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              {sim.quantidade_unidades.toLocaleString()} un
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span>{Math.round(sim.tempo_total_estimado / 60)}h</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            <span>R$ {sim.custo_unitario_estimado.toFixed(2)}/un</span>
                          </div>
                          {sim.desvio_custo_percent !== null && (
                            <Badge variant={Math.abs(sim.desvio_custo_percent) < 5 ? 'default' : 'secondary'}>
                              {sim.desvio_custo_percent > 0 ? '+' : ''}{sim.desvio_custo_percent.toFixed(1)}%
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Alertas Ativos */}
        {(stats.bloqueadas > 0 || validacoesBloqueio > 0) && (
          <Card className="border-destructive">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-4 w-4" />
                Alertas Ativos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.bloqueadas > 0 && (
                  <div className="flex items-center justify-between p-2 rounded bg-destructive/10">
                    <span className="text-sm">{stats.bloqueadas} OP(s) bloqueada(s)</span>
                    <Button variant="outline" size="sm" onClick={() => navigate('/producao/ordens?status=BLOQUEADA')}>
                      Ver
                    </Button>
                  </div>
                )}
                {validacoesBloqueio > 0 && (
                  <div className="flex items-center justify-between p-2 rounded bg-destructive/10">
                    <span className="text-sm">{validacoesBloqueio} bloqueio(s) ANVISA registrado(s)</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
