import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Bitcoin, CircleDollarSign, Landmark } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';

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

// Fetch crypto prices from CoinGecko public API
async function fetchCryptoPrices(): Promise<CryptoPrice[]> {
  try {
    const response = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd&include_24hr_change=true'
    );
    
    if (!response.ok) {
      throw new Error('Erro ao buscar preços');
    }
    
    const data = await response.json();
    
    return [
      {
        symbol: 'BTC',
        name: 'Bitcoin',
        price: data.bitcoin?.usd || 0,
        change24h: data.bitcoin?.usd_24h_change || 0,
        iconColor: 'text-amber-500',
        bgColor: 'bg-amber-100 dark:bg-amber-900/30',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        price: data.ethereum?.usd || 0,
        change24h: data.ethereum?.usd_24h_change || 0,
        iconColor: 'text-indigo-500',
        bgColor: 'bg-indigo-100 dark:bg-indigo-900/30',
      },
      {
        symbol: 'USDT',
        name: 'Tether',
        price: data.tether?.usd || 0,
        change24h: data.tether?.usd_24h_change || 0,
        iconColor: 'text-emerald-500',
        bgColor: 'bg-emerald-100 dark:bg-emerald-900/30',
      },
    ];
  } catch (error) {
    console.error('Erro ao buscar crypto:', error);
    throw error;
  }
}

// Fetch Ibovespa from brapi.dev (free, reliable Brazilian stock API)
async function fetchIbovespa(): Promise<IbovespaData | null> {
  try {
    // Try brapi.dev first (more reliable for Brazilian market)
    const response = await fetch(
      'https://brapi.dev/api/quote/%5EBVSP?token=demo'
    );
    
    if (response.ok) {
      const data = await response.json();
      const result = data.results?.[0];
      
      if (result) {
        return {
          price: result.regularMarketPrice || 0,
          change: result.regularMarketChangePercent || 0,
        };
      }
    }
    
    // Fallback: try AwesomeAPI
    const altResponse = await fetch(
      'https://economia.awesomeapi.com.br/json/daily/BVSP/1'
    );
    
    if (altResponse.ok) {
      const altData = await altResponse.json();
      if (altData && altData[0]) {
        return {
          price: parseFloat(altData[0].bid) || 0,
          change: parseFloat(altData[0].pctChange) || 0,
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Erro ao buscar Ibovespa:', error);
    return null;
  }
}

function useCryptoPrices() {
  return useQuery({
    queryKey: ['crypto-prices'],
    queryFn: fetchCryptoPrices,
    staleTime: 2 * 60 * 1000,
    refetchInterval: 2 * 60 * 1000,
    retry: 2,
  });
}

function useIbovespa() {
  return useQuery({
    queryKey: ['ibovespa'],
    queryFn: fetchIbovespa,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
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
  const { data: cryptos, isLoading: cryptoLoading, error: cryptoError } = useCryptoPrices();
  const { data: ibovespa, isLoading: ibovespaLoading } = useIbovespa();

  const isLoading = cryptoLoading || ibovespaLoading;
  const hasError = cryptoError && !ibovespa;

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
    >
      <Card className="overflow-hidden">
        <CardHeader className="pb-2 bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-900/50 dark:to-slate-800/30">
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
        <CardContent className="space-y-2.5 pt-3">
          {/* Ibovespa */}
          <div className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${getChangeBg(ibovespa?.change || 0)}`}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 shadow-lg shadow-blue-500/20">
                <Landmark className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">IBOVESPA</p>
                {ibovespaLoading ? (
                  <Skeleton className="h-6 w-24" />
                ) : (
                  <p className="text-xl font-bold tracking-tight">
                    {ibovespa ? formatPrice(ibovespa.price, 'BRL') : '--'}
                  </p>
                )}
              </div>
            </div>
            {ibovespa && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${getChangeColor(ibovespa.change)} ${getChangeBg(ibovespa.change)}`}>
                {getTrendIcon(ibovespa.change)}
                <span>{ibovespa.change >= 0 ? '+' : ''}{ibovespa.change.toFixed(2)}%</span>
              </div>
            )}
          </div>

          {/* Cryptos */}
          <div className="grid grid-cols-3 gap-2">
            {cryptos?.map((crypto) => (
              <div 
                key={crypto.symbol} 
                className="flex flex-col items-center p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className={`flex items-center justify-center w-9 h-9 rounded-xl ${crypto.bgColor} mb-2`}>
                  {getCryptoIcon(crypto.symbol, `h-5 w-5 ${crypto.iconColor}`)}
                </div>
                <p className="text-[10px] font-medium text-muted-foreground">{crypto.symbol}</p>
                {cryptoLoading ? (
                  <Skeleton className="h-4 w-14 mt-1" />
                ) : (
                  <p className="text-sm font-bold">
                    ${crypto.price >= 1000 ? (crypto.price / 1000).toFixed(1) + 'k' : formatPrice(crypto.price)}
                  </p>
                )}
                <div className={`flex items-center gap-0.5 text-[10px] mt-1 ${getChangeColor(crypto.change24h)}`}>
                  {getTrendIcon(crypto.change24h)}
                  <span>{crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}