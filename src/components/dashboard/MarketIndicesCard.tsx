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

import { supabase } from '@/integrations/supabase/client';

interface MarketData {
  ibovespa?: IbovespaData;
  crypto?: Record<string, { usd: number; usd_24h_change: number }>;
}

async function fetchMarketData(): Promise<MarketData> {
  try {
    const { data, error } = await supabase.functions.invoke('market-indices');
    if (error) throw error;
    return data as MarketData;
  } catch (error) {
    console.error('Erro ao buscar dados de mercado:', error);
    throw error;
  }
}

function useMarketData() {
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

export function MarketIndicesCard() {
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
      className="h-full"
    >
      <Card className="h-auto overflow-hidden flex flex-col">
        <CardHeader className="pb-2 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30 shrink-0 min-h-[52px]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Landmark className="h-4 w-4 text-primary" />
              </div>
              Índices de Mercado
            </CardTitle>
            {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-1.5 pt-3">
          {/* Ibovespa - Compact Row */}
          <div className={cn("flex items-center justify-between p-2 rounded-xl transition-colors", getChangeBg(ibovespa?.change || 0))}>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 shadow-sm">
                <Landmark className="h-4 w-4 text-white" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter leading-none">IBOV</p>
                {isLoading ? (
                  <Skeleton className="h-4 w-12 mt-0.5" />
                ) : (
                  <p className="text-sm font-black tracking-tighter">
                    {ibovespa ? formatPrice(ibovespa.price, 'BRL') : '--'}
                  </p>
                )}
              </div>
            </div>
            {ibovespa && (
              <div className={cn("text-[10px] font-bold", getChangeColor(ibovespa.change))}>
                {ibovespa.change >= 0 ? '+' : ''}{ibovespa.change.toFixed(1)}%
              </div>
            )}
          </div>

          {/* Cryptos - Single Compact Row */}
          <div className="grid grid-cols-3 gap-1.5">
            {cryptos?.map((crypto) => (
              <div 
                key={crypto.symbol} 
                className="flex flex-col items-center p-1.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className={cn("flex items-center justify-center w-6 h-6 rounded-lg mb-1", crypto.bgColor)}>
                  {getCryptoIcon(crypto.symbol, `h-3.5 w-3.5 ${crypto.iconColor}`)}
                </div>
                <p className="text-[10px] font-black leading-none">
                  {crypto.price >= 1000 ? (crypto.price / 1000).toFixed(1) + 'k' : formatPrice(crypto.price)}
                </p>
                <span className={cn("text-[8px] font-bold mt-0.5", getChangeColor(crypto.change24h))}>
                  {crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}