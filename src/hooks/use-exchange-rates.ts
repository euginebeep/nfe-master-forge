import { useQuery } from '@tanstack/react-query';

interface ExchangeRate {
  code: string;
  name: string;
  bid: string;
  ask: string;
  high: string;
  low: string;
  varBid: string;
  pctChange: string;
  timestamp: string;
  create_date: string;
}

interface ExchangeRates {
  USD: ExchangeRate | null;
  EUR: ExchangeRate | null;
  isLoading: boolean;
  error: Error | null;
  lastUpdate: Date | null;
}

async function fetchExchangeRates(): Promise<{ USD: ExchangeRate; EUR: ExchangeRate }> {
  const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL');
  
  if (!response.ok) {
    throw new Error('Erro ao buscar cotações');
  }
  
  const data = await response.json();
  
  return {
    USD: data.USDBRL,
    EUR: data.EURBRL,
  };
}

export function useExchangeRates(): ExchangeRates {
  const { data, isLoading, error } = useQuery({
    queryKey: ['exchange-rates'],
    queryFn: fetchExchangeRates,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    retry: 2,
  });

  return {
    USD: data?.USD || null,
    EUR: data?.EUR || null,
    isLoading,
    error: error as Error | null,
    lastUpdate: data ? new Date() : null,
  };
}

// Format currency for display
export function formatCurrency(value: string | number, decimals = 4): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return num.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// Get variation color class
export function getVariationColor(pctChange: string): string {
  const change = parseFloat(pctChange);
  if (change > 0) return 'text-green-600 dark:text-green-400';
  if (change < 0) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

// Get variation arrow
export function getVariationArrow(pctChange: string): string {
  const change = parseFloat(pctChange);
  if (change > 0) return '↑';
  if (change < 0) return '↓';
  return '→';
}
