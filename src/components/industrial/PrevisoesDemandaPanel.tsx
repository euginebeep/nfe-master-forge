import { 
  TrendingUp, 
  Package,
  AlertTriangle,
  Calendar,
  Factory,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  usePrevisoesProdução, 
  useGeradorPrevisoes 
} from '@/hooks/use-previsao-producao';
import { PrioridadeProducao } from '@/types/inteligencia-industrial';
import { cn } from '@/lib/utils';

const PRIORIDADE_STYLES: Record<PrioridadeProducao, string> = {
  URGENTE: 'bg-destructive text-destructive-foreground',
  ALTA: 'bg-orange-500 text-white',
  MEDIA: 'bg-yellow-500 text-black',
  BAIXA: 'bg-blue-500 text-white',
};

export function PrevisoesDemandaPanel() {
  const { previsoes, loading, refresh } = usePrevisoesProdução();
  const { gerarPrevisoes, gerando } = useGeradorPrevisoes();

  const previsoesUrgentes = previsoes.filter(p => p.prioridade === 'URGENTE' || p.prioridade === 'ALTA');

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            Previsões de Demanda
          </CardTitle>
          <div className="flex items-center gap-2">
            {previsoesUrgentes.length > 0 && (
              <Badge className="bg-destructive">
                {previsoesUrgentes.length} urgentes
              </Badge>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                await gerarPrevisoes();
                refresh();
              }}
              disabled={gerando}
            >
              <RefreshCw className={cn('h-4 w-4', gerando && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {previsoes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <TrendingUp className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Nenhuma previsão gerada</p>
            <Button
              size="sm"
              variant="link"
              onClick={gerarPrevisoes}
              disabled={gerando}
            >
              Gerar previsões agora
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {previsoes.slice(0, 8).map(previsao => (
              <div
                key={previsao.id}
                className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={cn('text-xs', PRIORIDADE_STYLES[previsao.prioridade])}>
                      {previsao.prioridade}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm">{previsao.produto_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        Período: {previsao.periodo}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2">
                      <Package className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm font-bold">
                        {previsao.demanda_prevista.toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Lote sugerido: {previsao.lote_sugerido.toLocaleString()}
                    </p>
                  </div>
                </div>
                
                {previsao.alerta && (
                  <div className="mt-2 flex items-center gap-2 text-xs">
                    <AlertTriangle className={cn(
                      'h-3 w-3',
                      previsao.prioridade === 'URGENTE' && 'text-destructive',
                      previsao.prioridade === 'ALTA' && 'text-orange-500',
                      previsao.prioridade === 'BAIXA' && 'text-yellow-600'
                    )} />
                    <span className={cn(
                      previsao.prioridade === 'URGENTE' && 'text-destructive font-medium',
                      previsao.prioridade === 'ALTA' && 'text-orange-600',
                      previsao.prioridade === 'BAIXA' && 'text-yellow-600'
                    )}>
                      {previsao.alerta}
                    </span>
                  </div>
                )}
                
                <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                  <span>Confiança: {previsao.confianca_percentual.toFixed(0)}%</span>
                  <span>Ponto reposição: {previsao.ponto_reposicao}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
