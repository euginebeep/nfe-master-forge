import { motion } from 'framer-motion';
import { DollarSign, Euro, RefreshCw, TrendingUp, TrendingDown, Minus, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useExchangeRates, formatCurrency, getVariationColor } from '@/hooks/use-exchange-rates';
import { cn } from '@/lib/utils';

export function ExchangeRateCard() {
  const { USD, EUR, isLoading, error, lastUpdate } = useExchangeRates();

  if (error) {
    return (
      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Cotações
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Erro ao carregar cotações</p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = (pctChange: string) => {
    const change = parseFloat(pctChange);
    if (change > 0) return <TrendingUp className="h-3.5 w-3.5" />;
    if (change < 0) return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
  };

  const getChangeBg = (pctChange: string) => {
    const change = parseFloat(pctChange);
    if (change > 0) return 'bg-green-50 dark:bg-green-950/30';
    if (change < 0) return 'bg-red-50 dark:bg-red-950/30';
    return 'bg-muted/30';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="h-full"
    >
      <Card className="h-auto overflow-hidden flex flex-col">
        <CardHeader className="pb-2 bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 shrink-0 min-h-[52px]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Banknote className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              Cotações do Dia
            </CardTitle>
            {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-3">
          <div className="grid grid-cols-2 gap-2">
            {/* USD */}
            <div className={cn("flex flex-col p-2 rounded-xl transition-colors", USD ? getChangeBg(USD.pctChange) : 'bg-muted/30')}>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 shadow-sm">
                  <DollarSign className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Dólar</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-5 w-full" />
              ) : (
                <div className="flex items-baseline justify-between gap-1">
                  <p className="text-sm font-black tracking-tighter">R$ {USD ? formatCurrency(USD.bid, 2) : '--'}</p>
                  {USD && (
                    <span className={cn("text-[10px] font-bold whitespace-nowrap", getVariationColor(USD.pctChange))}>
                      {parseFloat(USD.pctChange) >= 0 ? '+' : ''}{parseFloat(USD.pctChange).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* EUR */}
            <div className={cn("flex flex-col p-2 rounded-xl transition-colors", EUR ? getChangeBg(EUR.pctChange) : 'bg-muted/30')}>
              <div className="flex items-center gap-2 mb-1">
                <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 shadow-sm">
                  <Euro className="h-3.5 w-3.5 text-white" />
                </div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Euro</p>
              </div>
              {isLoading ? (
                <Skeleton className="h-5 w-full" />
              ) : (
                <div className="flex items-baseline justify-between gap-1">
                  <p className="text-sm font-black tracking-tighter">R$ {EUR ? formatCurrency(EUR.bid, 2) : '--'}</p>
                  {EUR && (
                    <span className={cn("text-[10px] font-bold whitespace-nowrap", getVariationColor(EUR.pctChange))}>
                      {parseFloat(EUR.pctChange) >= 0 ? '+' : ''}{parseFloat(EUR.pctChange).toFixed(1)}%
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {lastUpdate && (
            <p className="text-[9px] text-muted-foreground text-right">
              At: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}