import { useEffect, useState } from 'react';
import { RefreshCw, Clock, CheckCircle2, AlertTriangle, XCircle, Zap, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SyncStatusBannerProps {
  ultimoSync: {
    status: string;
    finalizado_em: string | null;
    versao_legislacao: string | null;
    detalhes: Record<string, unknown>;
    registros_atualizados?: number | null;
    registros_novos?: number | null;
  } | null | undefined;
  sincronizando: boolean;
  onSync: () => void;
}

function getNextScheduledRun(): Date {
  // Job agendado: diariamente às 03:00 (horário local do servidor BRT)
  const now = new Date();
  const next = new Date(now);
  next.setHours(3, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next;
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return '00h 00m 00s';
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

export function SyncStatusBanner({ ultimoSync, sincronizando, onSync }: SyncStatusBannerProps) {
  const [nextRun, setNextRun] = useState<Date>(() => getNextScheduledRun());
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => {
      const n = new Date();
      setNow(n);
      if (n >= nextRun) setNextRun(getNextScheduledRun());
    }, 1000);
    return () => clearInterval(id);
  }, [nextRun]);

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
  const countdownMs = nextRun.getTime() - now.getTime();
  const novos = Number(ultimoSync?.registros_novos ?? 0);
  const atualizados = Number(ultimoSync?.registros_atualizados ?? 0);

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
                {ultimoSync?.finalizado_em && (novos > 0 || atualizados > 0) && (
                  <Badge variant="secondary" className="text-xs">
                    +{novos} novos · {atualizados} atualizados
                  </Badge>
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
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <CalendarClock className="w-3 h-3" />
                Próxima sincronização programada:{' '}
                <span className="font-mono font-semibold text-foreground">
                  {formatCountdown(countdownMs)}
                </span>
                <span className="opacity-70">
                  ({format(nextRun, "dd/MM 'às' HH:mm", { locale: ptBR })})
                </span>
              </p>
            </div>
          </div>
          <Button
            variant={sincronizando ? 'outline' : 'default'}
            size="sm"
            onClick={onSync}
            disabled={sincronizando}
            className="shrink-0"
          >
            {sincronizando ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            {sincronizando ? 'Verificando ANVISA...' : 'Forçar sincronização agora'}
          </Button>
        </div>
        {sincronizando && (
          <div className="mt-3 space-y-1">
            <Progress value={undefined} className="h-1.5" />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Consultando portal ANVISA (Power BI + IN 28/2018 + RDC 243/2018)... pode levar de 10s a 60s.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
