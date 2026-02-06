import { 
  Lightbulb, 
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  Zap,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  useSugestoesOtimizacao, 
  useGeradorSugestoes 
} from '@/hooks/use-otimizacao';
import { TipoSugestaoOtimizacao, StatusSugestao } from '@/types/inteligencia-industrial';
import { cn } from '@/lib/utils';

const TIPO_ICONS: Record<TipoSugestaoOtimizacao, React.ElementType> = {
  AJUSTE_EXCIPIENTE: Zap,
  ORDEM_MISTURA: RefreshCw,
  REDUCAO_PERDA: TrendingUp,
  MELHORIA_RENDIMENTO: TrendingUp,
  SUBSTITUICAO_INSUMO: RefreshCw,
  ALTERACAO_PROCESSO: Zap,
  ECONOMIA_CUSTO: TrendingUp,
};

const STATUS_STYLES: Record<StatusSugestao, string> = {
  PENDENTE: 'bg-yellow-100 text-yellow-700',
  EM_ANALISE: 'bg-blue-100 text-blue-700',
  APROVADA: 'bg-green-100 text-green-700',
  REJEITADA: 'bg-red-100 text-red-700',
  IMPLEMENTADA: 'bg-purple-100 text-purple-700',
};

export function SugestoesOtimizacaoPanel() {
  const { sugestoes, stats, loading, refresh } = useSugestoesOtimizacao();
  const { atualizarStatus, gerando } = useGeradorSugestoes();

  const sugestoesPendentes = sugestoes.filter(s => s.status === 'PENDENTE' || s.status === 'EM_ANALISE');

  const handleAprovar = async (id: string) => {
    await atualizarStatus(id, 'APROVADA');
    refresh();
  };

  const handleRejeitar = async (id: string) => {
    await atualizarStatus(id, 'REJEITADA');
    refresh();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
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
            <Lightbulb className="h-4 w-4 text-primary" />
            Sugestões de Otimização
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {stats.pendentes} pendentes
            </Badge>
            <Badge variant="outline" className="text-xs bg-green-100 text-green-700">
              {stats.implementadas} implementadas
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {sugestoesPendentes.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Lightbulb className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Nenhuma sugestão pendente</p>
            <p className="text-xs mt-1">
              Sugestões são geradas automaticamente ao analisar fórmulas e OPs
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {sugestoesPendentes.slice(0, 5).map(sugestao => {
              const Icon = TIPO_ICONS[sugestao.tipo_sugestao] || Lightbulb;
              
              return (
                <div
                  key={sugestao.id}
                  className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded bg-primary/10">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-sm truncate">{sugestao.titulo}</h4>
                        <Badge className={cn('text-xs', STATUS_STYLES[sugestao.status])}>
                          {sugestao.status}
                        </Badge>
                      </div>
                      
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {sugestao.descricao}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        {sugestao.entidade_codigo && (
                          <Badge variant="secondary" className="text-xs">
                            {sugestao.entidade_tipo}: {sugestao.entidade_codigo}
                          </Badge>
                        )}
                        {sugestao.impacto_estimado && (
                          <span className="text-xs text-green-600 font-medium">
                            +{sugestao.impacto_estimado.toFixed(1)}{sugestao.impacto_unidade}
                          </span>
                        )}
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-2 italic">
                        {sugestao.justificativa_tecnica}
                      </p>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-100"
                        onClick={() => handleAprovar(sugestao.id)}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-destructive hover:bg-destructive/10"
                        onClick={() => handleRejeitar(sugestao.id)}
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
