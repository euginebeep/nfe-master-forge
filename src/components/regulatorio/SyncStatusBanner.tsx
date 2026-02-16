import { RefreshCw, Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SyncStatusBannerProps {
  ultimoSync: {
    status: string;
    finalizado_em: string | null;
    versao_legislacao: string | null;
    detalhes: Record<string, unknown>;
  } | null | undefined;
  sincronizando: boolean;
  onSync: () => void;
}

export function SyncStatusBanner({ ultimoSync, sincronizando, onSync }: SyncStatusBannerProps) {
  const getStatusInfo = () => {
    if (!ultimoSync?.finalizado_em) {
      return { icon: XCircle, color: 'text-destructive', bg: 'bg-red-50 dark:bg-red-950/20 border-destructive/30', label: 'Nunca verificado' };
    }
    if (ultimoSync.status === 'alerta') {
      return { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50 dark:bg-amber-950/20 border-amber-500/30', label: 'Alteração detectada' };
    }
    return { icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-950/20 border-green-500/30', label: 'Verificado' };
  };

  const status = getStatusInfo();
  const StatusIcon = status.icon;

  return (
    <Card className={`border ${status.bg}`}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <StatusIcon className={`w-5 h-5 ${status.color}`} />
            <div>
              <div className="flex items-center gap-2">
                <span className={`font-semibold text-sm ${status.color}`}>{status.label}</span>
                {ultimoSync?.versao_legislacao && (
                  <Badge variant="outline" className="text-xs">{ultimoSync.versao_legislacao}</Badge>
                )}
              </div>
              {ultimoSync?.finalizado_em && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  Última verificação: {format(new Date(ultimoSync.finalizado_em), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  {' '}({formatDistanceToNow(new Date(ultimoSync.finalizado_em), { addSuffix: true, locale: ptBR })})
                </p>
              )}
              {!ultimoSync?.finalizado_em && (
                <p className="text-xs text-muted-foreground">
                  A base ainda não foi verificada contra o portal da ANVISA. Clique em sincronizar.
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onSync}
            disabled={sincronizando}
            className="shrink-0"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />
            {sincronizando ? 'Verificando...' : 'Sincronizar com ANVISA'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
