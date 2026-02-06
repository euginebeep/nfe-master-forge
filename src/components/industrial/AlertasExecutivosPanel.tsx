import { 
  AlertTriangle, 
  TrendingDown, 
  Package, 
  Calendar,
  Shield,
  DollarSign,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAlertasExecutivos, useGeradorAlertas } from '@/hooks/use-alertas-executivos';
import { AlertaExecutivo, NivelAlerta, TipoAlertaExecutivo } from '@/types/inteligencia-industrial';
import { cn } from '@/lib/utils';

const ICON_MAP: Record<TipoAlertaExecutivo, React.ElementType> = {
  MARGEM_BAIXA: TrendingDown,
  FORNECEDOR_RISCO: AlertTriangle,
  PROCESSO_FORA_PADRAO: Activity,
  RISCO_REGULATORIO: Shield,
  ESTOQUE_CRITICO: Package,
  CUSTO_ELEVADO: DollarSign,
  QUALIDADE_COMPROMETIDA: XCircle,
  VENCIMENTO_PROXIMO: Calendar,
  PRODUCAO_ATRASADA: Clock,
  ANOMALIA_DETECTADA: AlertTriangle,
};

const NIVEL_STYLES: Record<NivelAlerta, string> = {
  CRITICO: 'bg-destructive text-destructive-foreground',
  ALTO: 'bg-orange-500 text-white',
  MEDIO: 'bg-yellow-500 text-black',
  BAIXO: 'bg-blue-500 text-white',
};

const NIVEL_BORDER: Record<NivelAlerta, string> = {
  CRITICO: 'border-l-4 border-l-destructive',
  ALTO: 'border-l-4 border-l-orange-500',
  MEDIO: 'border-l-4 border-l-yellow-500',
  BAIXO: 'border-l-4 border-l-blue-500',
};

interface AlertaCardProps {
  alerta: AlertaExecutivo;
  onVisualizar: (id: string) => void;
  onResolver: (id: string) => void;
}

function AlertaCard({ alerta, onVisualizar, onResolver }: AlertaCardProps) {
  const Icon = ICON_MAP[alerta.tipo_alerta] || AlertTriangle;
  
  return (
    <div className={cn(
      'p-4 rounded-lg bg-card hover:bg-muted/50 transition-colors',
      NIVEL_BORDER[alerta.nivel]
    )}>
      <div className="flex items-start gap-3">
        <div className={cn('p-2 rounded', NIVEL_STYLES[alerta.nivel])}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-sm truncate">{alerta.titulo}</h4>
            <Badge variant="outline" className="text-xs shrink-0">
              {alerta.nivel}
            </Badge>
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2">
            {alerta.descricao}
          </p>
          
          {alerta.acao_sugerida && (
            <p className="text-xs text-primary mt-1 font-medium">
              {alerta.acao_sugerida}
            </p>
          )}
          
          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-muted-foreground">
              {new Date(alerta.created_at).toLocaleDateString('pt-BR')}
            </span>
            {alerta.entidade_codigo && (
              <Badge variant="secondary" className="text-xs">
                {alerta.entidade_codigo}
              </Badge>
            )}
          </div>
        </div>
        
        <div className="flex flex-col gap-1">
          {alerta.status === 'ATIVO' && (
            <>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 px-2"
                onClick={() => onVisualizar(alerta.id)}
              >
                <Eye className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-7 px-2"
                onClick={() => onResolver(alerta.id)}
              >
                <CheckCircle2 className="h-3 w-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export function AlertasExecutivosPanel() {
  const { alertas, stats, loading, refresh } = useAlertasExecutivos();
  const { atualizarStatus } = useGeradorAlertas();

  const alertasAtivos = alertas.filter(a => a.status === 'ATIVO');

  const handleVisualizar = async (id: string) => {
    await atualizarStatus(id, 'VISUALIZADO');
    refresh();
  };

  const handleResolver = async (id: string) => {
    await atualizarStatus(id, 'RESOLVIDO');
    refresh();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-20 bg-muted rounded" />
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
            <AlertTriangle className="h-4 w-4 text-primary" />
            Alertas Executivos
          </CardTitle>
          <div className="flex items-center gap-2">
            {stats.criticos > 0 && (
              <Badge className="bg-destructive">{stats.criticos} críticos</Badge>
            )}
            {stats.altos > 0 && (
              <Badge className="bg-orange-500">{stats.altos} altos</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {alertasAtivos.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p className="text-sm">Nenhum alerta ativo</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {alertasAtivos.slice(0, 10).map(alerta => (
              <AlertaCard
                key={alerta.id}
                alerta={alerta}
                onVisualizar={handleVisualizar}
                onResolver={handleResolver}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
