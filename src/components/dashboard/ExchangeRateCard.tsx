import { motion } from 'framer-motion';
import { DollarSign, Euro, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useExchangeRates, formatCurrency, getVariationColor } from '@/hooks/use-exchange-rates';

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
    if (change > 0) return <TrendingUp className="h-3 w-3" />;
    if (change < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Cotações do Dia</CardTitle>
            {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* USD */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Dólar (USD)</p>
                {isLoading ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <p className="text-lg font-bold">
                    R$ {USD ? formatCurrency(USD.bid, 2) : '--'}
                  </p>
                )}
              </div>
            </div>
            {USD && (
              <div className={`flex items-center gap-1 text-xs ${getVariationColor(USD.pctChange)}`}>
                {getTrendIcon(USD.pctChange)}
                <span>{parseFloat(USD.pctChange).toFixed(2)}%</span>
              </div>
            )}
          </div>

          {/* EUR */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30">
                <Euro className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-medium">Euro (EUR)</p>
                {isLoading ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <p className="text-lg font-bold">
                    R$ {EUR ? formatCurrency(EUR.bid, 2) : '--'}
                  </p>
                )}
              </div>
            </div>
            {EUR && (
              <div className={`flex items-center gap-1 text-xs ${getVariationColor(EUR.pctChange)}`}>
                {getTrendIcon(EUR.pctChange)}
                <span>{parseFloat(EUR.pctChange).toFixed(2)}%</span>
              </div>
            )}
          </div>

          {lastUpdate && (
            <p className="text-xs text-muted-foreground text-right">
              Atualizado: {lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
