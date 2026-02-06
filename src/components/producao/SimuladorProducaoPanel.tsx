import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  SimulacaoProducao, 
  DadosFormulaSimulacao,
  Gargalo,
  Sugestao,
  formatarTempo,
} from '@/types/simulador-producao';
import { useSimuladorProducao } from '@/hooks/use-simulador-producao';
import { 
  Timer, 
  DollarSign,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Clock,
  Package,
  Cpu,
  Activity,
  Play,
} from 'lucide-react';

interface SimuladorProducaoPanelProps {
  formula: DadosFormulaSimulacao;
  custoMPEstimado: number;
  onSimulacaoCompleta?: (simulacao: SimulacaoProducao) => void;
}

export function SimuladorProducaoPanel({ 
  formula, 
  custoMPEstimado,
  onSimulacaoCompleta,
}: SimuladorProducaoPanelProps) {
  const [quantidade, setQuantidade] = useState(10000);
  const [simulacao, setSimulacao] = useState<SimulacaoProducao | null>(null);
  const [preview, setPreview] = useState<Omit<SimulacaoProducao, 'id' | 'created_at'> | null>(null);
  const [executando, setExecutando] = useState(false);

  const { executarSimulacao, simularPreview, loadingConfig } = useSimuladorProducao();

  // Preview em tempo real
  useEffect(() => {
    if (quantidade > 0 && !loadingConfig) {
      const p = simularPreview(formula, quantidade, custoMPEstimado);
      setPreview(p);
    }
  }, [quantidade, formula, custoMPEstimado, simularPreview, loadingConfig]);

  const handleExecutar = async () => {
    setExecutando(true);
    const resultado = await executarSimulacao(formula, quantidade, custoMPEstimado);
    if (resultado) {
      setSimulacao(resultado);
      onSimulacaoCompleta?.(resultado);
    }
    setExecutando(false);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const dados = simulacao || preview;

  const renderGargalo = (gargalo: Gargalo) => {
    const getImpactoColor = () => {
      switch (gargalo.impacto) {
        case 'ALTO': return 'destructive';
        case 'MEDIO': return 'secondary';
        case 'BAIXO': return 'outline';
      }
    };

    return (
      <div key={gargalo.etapa} className="flex items-start gap-2 p-2 rounded bg-destructive/10">
        <AlertTriangle className="h-4 w-4 text-destructive mt-0.5" />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{gargalo.etapa}</span>
            <Badge variant={getImpactoColor() as any} className="text-xs">{gargalo.impacto}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{gargalo.descricao}</p>
          <p className="text-xs text-destructive">+{gargalo.tempo_adicional_min} min</p>
        </div>
      </div>
    );
  };

  const renderSugestao = (sugestao: Sugestao) => {
    return (
      <div key={sugestao.tipo} className="flex items-start gap-2 p-2 rounded bg-primary/10">
        <Lightbulb className="h-4 w-4 text-primary mt-0.5" />
        <div className="flex-1">
          <span className="font-medium text-sm">{sugestao.tipo.replace(/_/g, ' ')}</span>
          <p className="text-sm text-muted-foreground">{sugestao.descricao}</p>
          {sugestao.economia_estimada && (
            <p className="text-xs text-green-600">Economia: {formatCurrency(sugestao.economia_estimada)}</p>
          )}
          {sugestao.tempo_economizado_min && sugestao.tempo_economizado_min > 0 && (
            <p className="text-xs text-green-600">Tempo: -{sugestao.tempo_economizado_min} min</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Simulador Industrial de Produção
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label htmlFor="quantidade">Quantidade a Produzir</Label>
              <Input
                id="quantidade"
                type="number"
                value={quantidade}
                onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)}
                min={100}
                step={100}
              />
            </div>
            <Button onClick={handleExecutar} disabled={executando || loadingConfig}>
              <Play className="h-4 w-4 mr-2" />
              {executando ? 'Simulando...' : 'Executar Simulação'}
            </Button>
          </div>

          {/* Info da Fórmula */}
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Package className="h-4 w-4" />
              {formula.codigo}
            </span>
            <span>{formula.nome}</span>
            <Badge variant="outline">{formula.tipo_apresentacao}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {dados && (
        <>
          {/* Tempos Estimados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Timer className="h-4 w-4" />
                Tempos Estimados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div className="p-3 rounded bg-muted">
                  <Clock className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">{formatarTempo(dados.tempo_pesagem_estimado)}</div>
                  <div className="text-xs text-muted-foreground">Pesagem</div>
                </div>
                <div className="p-3 rounded bg-muted">
                  <Activity className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">{formatarTempo(dados.tempo_mistura_estimado)}</div>
                  <div className="text-xs text-muted-foreground">Mistura</div>
                </div>
                <div className="p-3 rounded bg-muted">
                  <Cpu className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">{formatarTempo(dados.tempo_encapsulamento_estimado)}</div>
                  <div className="text-xs text-muted-foreground">Encapsulamento</div>
                </div>
                <div className="p-3 rounded bg-muted">
                  <Activity className="h-4 w-4 mx-auto mb-1 text-muted-foreground" />
                  <div className="text-lg font-bold">{formatarTempo(dados.tempo_qc_estimado)}</div>
                  <div className="text-xs text-muted-foreground">QC</div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-medium">Tempo Total Estimado</span>
                <span className="text-xl font-bold">{formatarTempo(dados.tempo_total_estimado)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Custos Estimados */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Custos Estimados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Matéria-Prima</span>
                  <span>{formatCurrency(dados.custo_mp_estimado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Mão de Obra</span>
                  <span>{formatCurrency(dados.custo_mao_obra_estimado)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Overhead</span>
                  <span>{formatCurrency(dados.custo_overhead_estimado)}</span>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <span className="font-medium">Custo Total</span>
                <span className="text-xl font-bold">{formatCurrency(dados.custo_total_estimado)}</span>
              </div>

              <div className="flex justify-between items-center text-primary">
                <span className="font-medium">Custo Unitário</span>
                <span className="text-lg font-bold">{formatCurrency(dados.custo_unitario_estimado)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Rendimento */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Rendimento Esperado
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Progress value={dados.rendimento_esperado_percent} className="h-3" />
                </div>
                <span className="text-lg font-bold">{dados.rendimento_esperado_percent}%</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                Perdas estimadas: {dados.perdas_estimadas_unidades.toLocaleString()} unidades
              </p>
            </CardContent>
          </Card>

          {/* Gargalos */}
          {dados.gargalos.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Gargalos Identificados ({dados.gargalos.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dados.gargalos.map(renderGargalo)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Sugestões */}
          {dados.sugestoes.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2 text-primary">
                  <Lightbulb className="h-4 w-4" />
                  Sugestões de Otimização ({dados.sugestoes.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {dados.sugestoes.map(renderSugestao)}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comparação Real (se disponível) */}
          {simulacao?.custo_real && (
            <Alert>
              <Activity className="h-4 w-4" />
              <AlertTitle>Comparação com Produção Real</AlertTitle>
              <AlertDescription>
                <div className="mt-2 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Desvio de Custo:</span>
                    <span className={`ml-2 font-medium ${simulacao.desvio_custo_percent && simulacao.desvio_custo_percent > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {simulacao.desvio_custo_percent?.toFixed(1)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Desvio de Tempo:</span>
                    <span className={`ml-2 font-medium ${simulacao.desvio_tempo_percent && simulacao.desvio_tempo_percent > 0 ? 'text-destructive' : 'text-green-600'}`}>
                      {simulacao.desvio_tempo_percent?.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
}
