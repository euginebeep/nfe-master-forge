import { motion } from "framer-motion";
import { RefreshCw, Landmark, Banknote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExchangeRates, formatCurrency, getVariationColor } from "@/hooks/use-exchange-rates";
import { useMarketData } from "@/components/dashboard/MarketIndicesCard";
import { cn } from "@/lib/utils";

interface MercadoCardProps {
  compact?: boolean;
  className?: string;
}

function getChangeColor(change: number): string {
  if (change > 0) return "text-green-600 dark:text-green-400";
  if (change < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

function formatPrice(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  });
}

export function MercadoCard({ compact = false, className }: MercadoCardProps) {
  const { USD, EUR, isLoading: loadingCamb, error: errorCamb, lastUpdate } = useExchangeRates();
  const { data: marketData, isLoading: loadingMkt, error: errorMkt } = useMarketData();

  const ibovespa = marketData?.ibovespa || null;
  const cryptos = marketData?.crypto
    ? [
        {
          symbol: "BTC",
          price: marketData.crypto.bitcoin?.usd || 0,
          change24h: marketData.crypto.bitcoin?.usd_24h_change || 0,
          iconColor: "text-amber-500",
        },
        {
          symbol: "ETH",
          price: marketData.crypto.ethereum?.usd || 0,
          change24h: marketData.crypto.ethereum?.usd_24h_change || 0,
          iconColor: "text-indigo-500",
        },
        {
          symbol: "USDT",
          price: marketData.crypto.tether?.usd || 0,
          change24h: marketData.crypto.tether?.usd_24h_change || 0,
          iconColor: "text-emerald-500",
        },
      ]
    : undefined;

  const isLoading = loadingCamb || loadingMkt;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className={cn("h-full min-h-0", className)}
    >
      <Card className={cn("h-full overflow-hidden flex flex-col", compact && "shadow-sm")}>
        <CardHeader
          className={cn(
            "pb-2 bg-gradient-to-r from-emerald-50 via-slate-50 to-slate-100/50 dark:from-emerald-950/30 dark:via-slate-900/40 dark:to-slate-800/30 shrink-0",
            compact ? "px-3 py-2 min-h-[40px]" : "min-h-[52px]",
          )}
        >
          <div className="flex items-center justify-between">
            <CardTitle className={cn("font-semibold flex items-center gap-2", compact ? "text-xs" : "text-sm")}>
              <div className={cn("rounded-lg bg-primary/10", compact ? "p-1" : "p-1.5")}>
                <Banknote className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
              </div>
              Mercado
            </CardTitle>
            {isLoading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            "flex-1 flex flex-col min-h-0",
            compact ? "p-2 pt-1.5 gap-1.5" : "p-4 pt-3 gap-2.5",
          )}
        >
          {/* CÂMBIO */}
          <div className="shrink-0 space-y-1">
            <p className={cn("font-bold uppercase tracking-wide text-muted-foreground", compact ? "text-[8px]" : "text-[9px]")}>
              Câmbio
            </p>
            {errorCamb ? (
              <p className={cn("text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                Erro ao carregar cotações
              </p>
            ) : (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                    Dólar (USD)
                  </span>
                  <div className="flex items-center gap-2">
                    {loadingCamb ? (
                      <Skeleton className="h-3 w-14" />
                    ) : (
                      <>
                        <span className={cn("font-bold tabular-nums", compact ? "text-[10px]" : "text-xs")}>
                          R$ {USD ? formatCurrency(USD.bid, 2) : "--"}
                        </span>
                        {USD && (
                          <span className={cn("font-semibold tabular-nums", compact ? "text-[9px]" : "text-[10px]", getVariationColor(USD.pctChange))}>
                            {parseFloat(USD.pctChange) >= 0 ? "+" : ""}
                            {parseFloat(USD.pctChange).toFixed(2)}%
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                    Euro (EUR)
                  </span>
                  <div className="flex items-center gap-2">
                    {loadingCamb ? (
                      <Skeleton className="h-3 w-14" />
                    ) : (
                      <>
                        <span className={cn("font-bold tabular-nums", compact ? "text-[10px]" : "text-xs")}>
                          R$ {EUR ? formatCurrency(EUR.bid, 2) : "--"}
                        </span>
                        {EUR && (
                          <span className={cn("font-semibold tabular-nums", compact ? "text-[9px]" : "text-[10px]", getVariationColor(EUR.pctChange))}>
                            {parseFloat(EUR.pctChange) >= 0 ? "+" : ""}
                            {parseFloat(EUR.pctChange).toFixed(2)}%
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border/60 shrink-0" />

          {/* ÍNDICES */}
          <div className="flex-1 min-h-0 flex flex-col gap-1">
            <p className={cn("font-bold uppercase tracking-wide text-muted-foreground shrink-0", compact ? "text-[8px]" : "text-[9px]")}>
              Índices
            </p>
            {errorMkt && !marketData ? (
              <p className={cn("text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                Erro ao carregar índices
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <span className={cn("flex items-center gap-1 text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                    <Landmark className="h-3 w-3" />
                    IBOVESPA
                  </span>
                  <div className="flex items-center gap-2">
                    {loadingMkt ? (
                      <Skeleton className="h-3 w-14" />
                    ) : (
                      <>
                        <span className={cn("font-bold tabular-nums", compact ? "text-[10px]" : "text-xs")}>
                          {ibovespa
                            ? ibovespa.price.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                            : "--"}
                        </span>
                        {ibovespa && (
                          <span className={cn("font-semibold tabular-nums", compact ? "text-[9px]" : "text-[10px]", getChangeColor(ibovespa.change))}>
                            {ibovespa.change >= 0 ? "+" : ""}
                            {ibovespa.change.toFixed(2)}%
                          </span>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className={cn("rounded-md border border-border/40 bg-muted/20 flex-1 min-h-0 overflow-y-auto", compact ? "p-1" : "p-1.5")}>
                  <div className="grid grid-cols-3 gap-0 border-b border-border/10 pb-1 mb-1 sticky top-0 bg-muted/40 z-10 backdrop-blur-sm">
                    <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Ativo</p>
                    <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Preço</p>
                    <p className="text-[8px] font-black text-muted-foreground uppercase text-center">Var. 24h</p>
                  </div>
                  <div className="space-y-1">
                    {cryptos?.map((crypto) => (
                      <div key={crypto.symbol} className="grid grid-cols-3 items-center gap-0">
                        <div className="flex items-center gap-1.5 justify-start pl-1">
                          <div className={cn("w-2 h-2 rounded-full", crypto.iconColor.replace("text-", "bg-"))} />
                          <span className="text-[10px] font-black">{crypto.symbol}</span>
                        </div>
                        <div className="text-center">
                          <span className="text-[10px] font-bold">
                            {crypto.price >= 1000
                              ? (crypto.price / 1000).toFixed(1) + "k"
                              : formatPrice(crypto.price)}
                          </span>
                        </div>
                        <div className={cn("text-[9px] font-black text-right pr-2", getChangeColor(crypto.change24h))}>
                          {crypto.change24h >= 0 ? "+" : ""}
                          {crypto.change24h.toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {lastUpdate && (
            <div className={cn("flex items-center justify-end gap-1 opacity-50 mt-auto", compact ? "pt-0.5" : "pt-1")}>
              <RefreshCw className="h-2.5 w-2.5 animate-pulse" />
              <p className="text-[9px] font-bold uppercase tracking-widest">
                {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
