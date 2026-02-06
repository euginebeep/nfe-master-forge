import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Coins, BarChart2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useQuery } from '@tanstack/react-query';

interface CryptoPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  icon: string;
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
        icon: '₿',
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        price: data.ethereum?.usd || 0,
        change24h: data.ethereum?.usd_24h_change || 0,
        icon: 'Ξ',
      },
      {
        symbol: 'USDT',
        name: 'Tether',
        price: data.tether?.usd || 0,
        change24h: data.tether?.usd_24h_change || 0,
        icon: '₮',
      },
    ];
  } catch (error) {
    console.error('Erro ao buscar crypto:', error);
    throw error;
  }
}

// Fetch Ibovespa from Yahoo Finance proxy
async function fetchIbovespa(): Promise<IbovespaData | null> {
  try {
    // Using a CORS proxy or alternative API
    const response = await fetch(
      'https://brapi.dev/api/quote/^BVSP'
    );
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    const result = data.results?.[0];
    
    if (result) {
      return {
        price: result.regularMarketPrice || 0,
        change: result.regularMarketChangePercent || 0,
      };
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
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 2 * 60 * 1000,
    retry: 2,
  });
}

function useIbovespa() {
  return useQuery({
    queryKey: ['ibovespa'],
    queryFn: fetchIbovespa,
    staleTime: 5 * 60 * 1000, // 5 minutes
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

function getTrendIcon(change: number) {
  if (change > 0) return <TrendingUp className="h-3 w-3" />;
  if (change < 0) return <TrendingDown className="h-3 w-3" />;
  return <Minus className="h-3 w-3" />;
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
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Coins className="h-4 w-4" />
              Índices de Mercado
            </CardTitle>
            {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Ibovespa */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                <BarChart2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">IBOVESPA</p>
                {ibovespaLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : (
                  <p className="text-lg font-bold">
                    {ibovespa ? formatPrice(ibovespa.price, 'BRL') : '--'}
                  </p>
                )}
              </div>
            </div>
            {ibovespa && (
              <div className={`flex items-center gap-1 text-xs ${getChangeColor(ibovespa.change)}`}>
                {getTrendIcon(ibovespa.change)}
                <span>{ibovespa.change >= 0 ? '+' : ''}{ibovespa.change.toFixed(2)}%</span>
              </div>
            )}
          </div>

          {/* Cryptos */}
          {cryptos?.map((crypto) => (
            <div key={crypto.symbol} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30">
                  <span className="text-sm font-bold text-orange-600 dark:text-orange-400">
                    {crypto.icon}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{crypto.name}</p>
                  {cryptoLoading ? (
                    <Skeleton className="h-4 w-16" />
                  ) : (
                    <p className="text-base font-semibold">
                      ${formatPrice(crypto.price)}
                    </p>
                  )}
                </div>
              </div>
              <div className={`flex items-center gap-1 text-xs ${getChangeColor(crypto.change24h)}`}>
                {getTrendIcon(crypto.change24h)}
                <span>{crypto.change24h >= 0 ? '+' : ''}{crypto.change24h.toFixed(2)}%</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </motion.div>
  );
}
