import { 
  AlertTriangle, 
  CheckCircle2, 
  XCircle,
  Clock,
  Activity,
  RefreshCw,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  useAnomaliasOperacionais, 
  useDetectorAnomalias 
} from '@/hooks/use-anomalias';
import { SeveridadeAnomalia, TipoAnomalia } from '@/types/inteligencia-industrial';
import { cn } from '@/lib/utils';

const SEVERIDADE_STYLES: Record<SeveridadeAnomalia, string> = {
  CRITICA: 'bg-destructive text-destructive-foreground',
  ALTA: 'bg-orange-500 text-white',
  MEDIA: 'bg-yellow-500 text-black',
  BAIXA: 'bg-blue-500 text-white',
  INFO: 'bg-gray-500 text-white',
};

const TIPO_LABELS: Record<TipoAnomalia, string> = {
  PESO_FORA_PADRAO: 'Peso fora do padrão',
  CONSUMO_EXCESSIVO: 'Consumo excessivo',
  TEMPO_ANORMAL: 'Tempo anormal',
  RENDIMENTO_BAIXO: 'Rendimento baixo',
  PERDA_ELEVADA: 'Perda elevada',
  DESVIO_CUSTO: 'Desvio de custo',
  DESVIO_QUALIDADE: 'Desvio de qualidade',
};

export function AnomaliasOperacionaisPanel() {
  const { anomalias, stats, loading, refresh } = useAnomaliasOperacionais();
  const { atualizarStatus } = useDetectorAnomalias();

  const anomaliasPendentes = anomalias.filter(a => a.status === 'PENDENTE');

  const handleResolver = async (id: string) => {
    await atualizarStatus(id, 'RESOLVIDA', 'Resolvido manualmente');
    refresh();
  };

  const handleIgnorar = async (id: string) => {
    await atualizarStatus(id, 'IGNORADA', 'Ignorado pelo operador');
    refresh();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(stats.criticas > 0 && 'border-destructive')}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            Anomalias Operacionais
          </CardTitle>
          <div className="flex items-center gap-2">
            {stats.criticas > 0 && (
              <Badge className="bg-destructive animate-pulse">
                {stats.criticas} críticas
              </Badge>
            )}
            {stats.altas > 0 && (
              <Badge className="bg-orange-500">
                {stats.altas} altas
              </Badge>
            )}
            <Badge variant="outline">
              {stats.pendentes} pendentes
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {anomaliasPendentes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">Nenhuma anomalia pendente</p>
            <p className="text-xs mt-1">
              Anomalias são detectadas automaticamente durante a produção
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[350px] overflow-y-auto">
            {anomaliasPendentes.slice(0, 10).map(anomalia => (
              <div
                key={anomalia.id}
                className={cn(
                  'p-3 rounded-lg border-l-4',
                  anomalia.severidade === 'CRITICA' && 'border-l-destructive bg-destructive/5',
                  anomalia.severidade === 'ALTA' && 'border-l-orange-500 bg-orange-50 dark:bg-orange-900/10',
                  anomalia.severidade === 'MEDIA' && 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10',
                  anomalia.severidade === 'BAIXA' && 'border-l-blue-500 bg-blue-50 dark:bg-blue-900/10',
                  anomalia.severidade === 'INFO' && 'border-l-gray-500 bg-muted/50'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={cn('text-xs', SEVERIDADE_STYLES[anomalia.severidade])}>
                        {anomalia.severidade}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {TIPO_LABELS[anomalia.tipo_anomalia]}
                      </span>
                    </div>
                    
                    <p className="text-sm">{anomalia.descricao}</p>
                    
                    {anomalia.desvio_percentual !== null && (
                      <p className={cn(
                        'text-xs mt-1 font-medium',
                        Math.abs(anomalia.desvio_percentual) > 20 && 'text-destructive'
                      )}>
                        Desvio: {anomalia.desvio_percentual > 0 ? '+' : ''}{anomalia.desvio_percentual.toFixed(1)}%
                      </p>
                    )}
                    
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(anomalia.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-green-600 hover:bg-green-100"
                      onClick={() => handleResolver(anomalia.id)}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-muted-foreground hover:bg-muted"
                      onClick={() => handleIgnorar(anomalia.id)}
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
