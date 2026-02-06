import { useState } from 'react';
import { 
  Star, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Package,
  Clock,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  useRankingFornecedores, 
  useAvaliadorFornecedores 
} from '@/hooks/use-ranking-fornecedores';
import { ClassificacaoFornecedor } from '@/types/inteligencia-industrial';
import { cn } from '@/lib/utils';

const CLASSIFICACAO_STYLES: Record<ClassificacaoFornecedor, { bg: string; text: string; icon: React.ElementType }> = {
  PREFERENCIAL: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-400', icon: Star },
  REGULAR: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', icon: Package },
  RISCO: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: AlertTriangle },
  BLOQUEADO: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-400', icon: AlertTriangle },
};

export function RankingFornecedoresPanel() {
  const { rankings, stats, loading, refresh } = useRankingFornecedores();
  const { recalcularTodosRankings, avaliando } = useAvaliadorFornecedores();
  const [expandido, setExpandido] = useState<string | null>(null);

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
            <Star className="h-4 w-4 text-primary" />
            Ranking de Fornecedores
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
                {stats.preferenciais} pref
              </Badge>
              <Badge variant="outline" className="text-xs bg-yellow-100 text-yellow-700">
                {stats.risco} risco
              </Badge>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={recalcularTodosRankings}
              disabled={avaliando}
            >
              <RefreshCw className={cn('h-4 w-4', avaliando && 'animate-spin')} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {rankings.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Nenhum fornecedor avaliado</p>
            <Button
              size="sm"
              variant="link"
              onClick={recalcularTodosRankings}
              disabled={avaliando}
            >
              Calcular rankings
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {rankings.slice(0, 10).map((ranking, index) => {
              const style = CLASSIFICACAO_STYLES[ranking.classificacao];
              const Icon = style.icon;
              const isExpandido = expandido === ranking.id;

              return (
                <div
                  key={ranking.id}
                  className={cn(
                    'p-3 rounded-lg cursor-pointer transition-all',
                    style.bg,
                    isExpandido && 'ring-2 ring-primary'
                  )}
                  onClick={() => setExpandido(isExpandido ? null : ranking.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-muted-foreground w-6">
                        #{index + 1}
                      </span>
                      <Icon className={cn('h-4 w-4', style.text)} />
                      <div>
                        <p className="font-medium text-sm">{ranking.fornecedor_nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {ranking.total_lotes_recebidos} lotes recebidos
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn('text-lg font-bold', style.text)}>
                        {ranking.score_total.toFixed(0)}
                      </p>
                      <Badge variant="outline" className={cn('text-xs', style.text)}>
                        {ranking.classificacao}
                      </Badge>
                    </div>
                  </div>

                  {isExpandido && (
                    <div className="mt-3 pt-3 border-t border-border/50 grid grid-cols-5 gap-2">
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Qualidade</p>
                        <p className="text-sm font-bold">{ranking.score_qualidade.toFixed(0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Custo</p>
                        <p className="text-sm font-bold">{ranking.score_custo.toFixed(0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Pontual</p>
                        <p className="text-sm font-bold">{ranking.score_pontualidade.toFixed(0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">Conform.</p>
                        <p className="text-sm font-bold">{ranking.score_conformidade.toFixed(0)}</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-muted-foreground">NC</p>
                        <p className={cn(
                          'text-sm font-bold',
                          ranking.total_nao_conformidades > 0 && 'text-destructive'
                        )}>
                          {ranking.total_nao_conformidades}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
