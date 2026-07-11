import { motion } from 'framer-motion';
import { DollarSign, Euro, RefreshCw, TrendingUp, TrendingDown, Minus, Banknote } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useExchangeRates, formatCurrency, getVariationColor } from '@/hooks/use-exchange-rates';
import { cn } from '@/lib/utils';

interface ExchangeRateCardProps {
  compact?: boolean;
  className?: string;
}

export function ExchangeRateCard({ compact = false, className }: ExchangeRateCardProps) {
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
      className={cn("h-full min-h-0", className)}
    >
      <Card className={cn("h-full overflow-hidden flex flex-col", compact && "shadow-sm")}>
        <CardHeader className={cn(
          "pb-2 bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20 shrink-0",
          compact ? "px-3 py-2 min-h-[40px]" : "min-h-[52px]",
        )}>
          <div className="flex items-center justify-between">
            <CardTitle className={cn("font-semibold flex items-center gap-2", compact ? "text-xs" : "text-sm")}>
              <div className={cn("rounded-lg bg-emerald-500/10", compact ? "p-1" : "p-1.5")}>
                <Banknote className={cn("text-emerald-600 dark:text-emerald-400", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </div>
              Cotações do Dia
            </CardTitle>
            {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className={cn(
          "flex-1 flex flex-col justify-between min-h-0",
          compact ? "p-2 pt-1.5" : "p-4 pt-3",
        )}>
          <div className={compact ? "space-y-1.5" : "space-y-2"}>
            {/* USD */}
            <div className={cn(
              "flex items-center justify-between rounded-xl transition-all border border-transparent hover:border-emerald-500/20",
              compact ? "p-1.5" : "p-2",
              USD ? getChangeBg(USD.pctChange) : 'bg-muted/30'
            )}>
              <div className={cn("flex items-center", compact ? "gap-2" : "gap-2.5")}>
                <div className={cn(
                  "flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 shadow-sm border border-emerald-500/10 overflow-hidden",
                  compact ? "w-7 h-7" : "w-8 h-8",
                )}>
                  <img src="https://flagcdn.com/us.svg" alt="USA" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-0.5">Dólar (USD)</p>
                  {isLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    <p className={cn("font-black tracking-tighter leading-none", compact ? "text-sm" : "text-base")}>
                      R$ {USD ? formatCurrency(USD.bid, 2) : '--'}
                    </p>
                  )}
                </div>
              </div>
              {!isLoading && USD && (
                <div className={cn("text-xs font-black px-2 py-0.5 rounded-md", getVariationColor(USD.pctChange), "bg-white/40 dark:bg-black/20 shadow-sm border border-black/5")}>
                  {parseFloat(USD.pctChange) >= 0 ? '+' : ''}{parseFloat(USD.pctChange).toFixed(2)}%
                </div>
              )}
            </div>

            {/* EUR */}
            <div className={cn(
              "flex items-center justify-between rounded-xl transition-all border border-transparent hover:border-blue-500/20",
              compact ? "p-1.5" : "p-2",
              EUR ? getChangeBg(EUR.pctChange) : 'bg-muted/30'
            )}>
              <div className={cn("flex items-center", compact ? "gap-2" : "gap-2.5")}>
                <div className={cn(
                  "flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 shadow-sm border border-blue-500/10 overflow-hidden",
                  compact ? "w-7 h-7" : "w-8 h-8",
                )}>
                  <img src="https://flagcdn.com/eu.svg" alt="EU" className="w-full h-full object-cover" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-0.5">Euro (EUR)</p>
                  {isLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    <p className={cn("font-black tracking-tighter leading-none", compact ? "text-sm" : "text-base")}>
                      R$ {EUR ? formatCurrency(EUR.bid, 2) : '--'}
                    </p>
                  )}
                </div>
              </div>
              {!isLoading && EUR && (
                <div className={cn("text-xs font-black px-2 py-0.5 rounded-md", getVariationColor(EUR.pctChange), "bg-white/40 dark:bg-black/20 shadow-sm border border-black/5")}>
                  {parseFloat(EUR.pctChange) >= 0 ? '+' : ''}{parseFloat(EUR.pctChange).toFixed(2)}%
                </div>
              )}
            </div>
          </div>

          {lastUpdate && (
            <div className={cn("flex items-center justify-end gap-1 opacity-50", compact ? "mt-1" : "mt-2")}>
              <RefreshCw className="h-2.5 w-2.5 animate-pulse" />
              <p className="text-[9px] font-bold uppercase tracking-widest">
                {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}