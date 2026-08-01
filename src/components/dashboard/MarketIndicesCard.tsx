import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Bitcoin, CircleDollarSign, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';

interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  iconColor: string;
  bgColor: string;
}

interface IbovespaData {
  price: number;
  change: number;
}

import { invokeEdge } from '@/lib/edge-invoke';

interface MarketData {
  ibovespa?: IbovespaData;
  crypto?: Record<string, { usd: number; usd_24h_change: number }>;
}

async function fetchMarketData(): Promise<MarketData> {
  try {
    const { data, error } = await invokeEdge<MarketData>('market-indices');
    if (error) throw new Error(error);
    return data as MarketData;
  } catch (error) {
    console.error('Erro ao buscar dados de mercado:', error);
    throw error;
  }
}

export function useMarketData() {
  return useQuery({
    queryKey: ['market-data'],
    queryFn: fetchMarketData,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 3 * 60 * 1000,
    retry: 2,
  });
}

function formatPrice(value: number, currency: 'USD' | 'BRL' = 'USD'): string {
  if (currency === 'BRL') {
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  }
  
  if (value >= 1000) {
    return value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

function getChangeColor(change: number): string {
  if (change > 0) return 'text-green-600 dark:text-green-400';
  if (change < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

function getChangeBg(change: number): string {
  if (change > 0) return 'bg-green-50 dark:bg-green-950/30';
  if (change < 0) return 'bg-red-50 dark:bg-red-950/30';
  return 'bg-muted/30';
}

function getTrendIcon(change: number) {
  if (change > 0) return <TrendingUp className="h-3.5 w-3.5" />;
  if (change < 0) return <TrendingDown className="h-3.5 w-3.5" />;
  return <Minus className="h-3.5 w-3.5" />;
}

function getCryptoIcon(symbol: string, className: string) {
  switch (symbol) {
    case 'BTC':
      return <Bitcoin className={className} />;
    case 'ETH':
      return <CircleDollarSign className={className} />;
    case 'USDT':
      return <CircleDollarSign className={className} />;
    default:
      return <CircleDollarSign className={className} />;
  }
}

export function MarketIndicesCard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const { data: marketData, isLoading, error } = useMarketData();

  const ibovespa = marketData?.ibovespa || null;
  const cryptos: CryptoPrice[] | undefined = marketData?.crypto ? [
    {
      symbol: 'BTC',
      name: 'Bitcoin',
      price: marketData.crypto.bitcoin?.usd || 0,
      change24h: marketData.crypto.bitcoin?.usd_24h_change || 0,
      iconColor: 'text-amber-500',
      bgColor: 'bg-amber-100 dark:bg-amber-900/30',
    },
    {
      symbol: 'ETH',
      name: 'Ethereum',
      price: marketData.crypto.ethereum?.usd || 0,
      change24h: marketData.crypto.ethereum?.usd_24h_change || 0,
      iconColor: 'text-indigo-500',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
    },
    {
      symbol: 'USDT',
      name: 'Tether',
      price: marketData.crypto.tether?.usd || 0,
      change24h: marketData.crypto.tether?.usd_24h_change || 0,
      iconColor: 'text-emerald-500',
      bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
    },
  ] : undefined;

  const hasError = error && !marketData;

  if (hasError) {
    return (
      <Card className="bg-muted/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Índices de Mercado
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Erro ao carregar índices</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className={cn("h-full min-h-0", className)}
    >
      <Card className={cn("h-full overflow-hidden flex flex-col", compact && "shadow-sm")}>
        <CardHeader className={cn(
          "pb-2 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 shrink-0",
          compact ? "px-3 py-2 min-h-[40px]" : "min-h-[52px]",
        )}>
          <div className="flex items-center justify-between">
            <CardTitle className={cn("font-semibold flex items-center gap-2", compact ? "text-xs" : "text-sm")}>
              <div className={cn("rounded-lg bg-primary/10", compact ? "p-1" : "p-1.5")}>
                <Landmark className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </div>
              Índices de Mercado
            </CardTitle>
            {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className={cn(
          "flex-1 flex flex-col min-h-0",
          compact ? "p-2 pt-1.5 gap-1.5" : "p-4 pt-3 gap-3",
        )}>
          <div className={cn(
            "flex items-center justify-between rounded-xl transition-all border border-transparent shrink-0",
            compact ? "p-1.5" : "p-2",
            getChangeBg(ibovespa?.change || 0)
          )}>
            <div className={cn("flex items-center", compact ? "gap-2" : "gap-2.5")}>
              <div className={cn(
                "flex items-center justify-center rounded-lg bg-white dark:bg-slate-900 shadow-sm border border-blue-500/10",
                compact ? "w-7 h-7" : "w-8 h-8",
              )}>
                <Landmark className={cn("text-blue-600", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase leading-none mb-0.5">IBOVESPA</p>
                {isLoading ? (
                  <Skeleton className="h-4 w-16" />
                ) : (
                  <p className={cn("font-black tracking-tighter leading-none", compact ? "text-sm" : "text-base")}>
                    {ibovespa ? formatPrice(ibovespa.price, 'BRL') : '--'}
                  </p>
                )}
              </div>
            </div>
            {ibovespa && (
              <div className={cn("text-xs font-black px-2 py-0.5 rounded-md", getChangeColor(ibovespa.change), "bg-white/40 dark:bg-black/20 shadow-sm border border-black/5")}>
                {ibovespa.change >= 0 ? '+' : ''}{ibovespa.change.toFixed(2)}%
              </div>
            )}
          </div>

          <div className={cn("bg-muted/30 rounded-xl border border-border/5 flex-1 min-h-0 overflow-y-auto", compact ? "p-1.5" : "p-2")}>
            <div className="grid grid-cols-3 gap-0 border-b border-border/10 pb-1 mb-1 sticky top-0 bg-muted/30 z-10 backdrop-blur-sm">
              <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Ativo</p>
              <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Preço (USD)</p>
              <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Var. 24h</p>
            </div>
            <div className={compact ? "space-y-1" : "space-y-1.5"}>
              {cryptos?.map((crypto) => (
                <div key={crypto.symbol} className="grid grid-cols-3 items-center gap-0">
                  <div className="flex items-center gap-1.5 justify-start pl-1">
                    <div className={cn("w-2 h-2 rounded-full", crypto.iconColor.replace('text-', 'bg-'))} />
                    <span className="text-[10px] font-black">{crypto.symbol}</span>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold">
                      {crypto.price >= 1000 ? (crypto.price / 1000).toFixed(1) + 'k' : formatPrice(crypto.price)}
                    </span>
                  </div>
                  <div className={cn("text-[9px] font-black text-right pr-2", getChangeColor(crypto.change24h))}>
                    {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(1)}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}