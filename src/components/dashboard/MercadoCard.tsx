import { motion } from "framer-motion";
import {
  RefreshCw,
  Landmark,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useExchangeRates, formatCurrency, getVariationColor } from "@/hooks/use-exchange-rates";
import { useMarketData } from "@/components/dashboard/MarketIndicesCard";
import { cn } from "@/lib/utils";

interface MercadoCardProps {
  compact?: boolean;
  className?: string;
}

const ATIVO_ESTILO: Record<string, { cor: string; sigla: string }> = {
  BTC: { cor: "bg-amber-500", sigla: "₿" },
  ETH: { cor: "bg-indigo-500", sigla: "Ξ" },
  USDT: { cor: "bg-emerald-500", sigla: "₮" },
};

function IconeAtivo({ symbol }: { symbol: string }) {
  const e = ATIVO_ESTILO[symbol] ?? { cor: "bg-slate-400", sigla: "•" };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full text-white shrink-0",
        "w-4 h-4 text-[9px] font-bold leading-none",
        e.cor,
      )}
      aria-hidden="true"
    >
      {e.sigla}
    </span>
  );
}

function Variacao({ pct }: { pct: string }) {
  const n = parseFloat(pct);
  const Icone = n > 0 ? ArrowUpRight : n < 0 ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 font-semibold tabular-nums",
        getVariationColor(pct),
      )}
    >
      <Icone className="h-3 w-3 shrink-0" />
      {pct}
    </span>
  );
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

function Bandeira({ src }: { src: string }) {
  return (
    <span className="w-4 h-4 rounded-full overflow-hidden shrink-0 border border-border/50">
      <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
    </span>
  );
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
        },
        {
          symbol: "ETH",
          price: marketData.crypto.ethereum?.usd || 0,
          change24h: marketData.crypto.ethereum?.usd_24h_change || 0,
        },
        {
          symbol: "USDT",
          price: marketData.crypto.tether?.usd || 0,
          change24h: marketData.crypto.tether?.usd_24h_change || 0,
        },
      ]
    : undefined;

  const isLoading = loadingCamb || loadingMkt;

  const fmtPct = (n: number, digits: number) =>
    `${n >= 0 ? "+" : ""}${n.toFixed(digits)}%`;

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
            "flex-1 flex flex-col min-h-0 gap-2",
            compact ? "p-2 pt-1.5" : "p-4 pt-3",
          )}
        >
          {/* CÂMBIO */}
          <div className="shrink-0">
            <p
              className={cn(
                "font-bold uppercase tracking-wide text-muted-foreground mb-1",
                compact ? "text-[8px]" : "text-[9px]",
              )}
            >
              Câmbio
            </p>
            {errorCamb ? (
              <p className={cn("text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                Erro ao carregar cotações
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-muted-foreground min-w-0",
                      compact ? "text-[9px]" : "text-[10px]",
                    )}
                  >
                    <Bandeira src="https://flagcdn.com/us.svg" />
                    Dólar (USD)
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {loadingCamb ? (
                      <Skeleton className="h-3 w-14" />
                    ) : (
                      <>
                        <span
                          className={cn(
                            "font-bold tabular-nums text-right",
                            compact ? "text-[10px]" : "text-xs",
                          )}
                        >
                          R$ {USD ? formatCurrency(USD.bid, 2) : "--"}
                        </span>
                        {USD && (
                          <Variacao
                            pct={`${parseFloat(USD.pctChange) >= 0 ? "+" : ""}${parseFloat(USD.pctChange).toFixed(2)}%`}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-muted-foreground min-w-0",
                      compact ? "text-[9px]" : "text-[10px]",
                    )}
                  >
                    <Bandeira src="https://flagcdn.com/eu.svg" />
                    Euro (EUR)
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {loadingCamb ? (
                      <Skeleton className="h-3 w-14" />
                    ) : (
                      <>
                        <span
                          className={cn(
                            "font-bold tabular-nums text-right",
                            compact ? "text-[10px]" : "text-xs",
                          )}
                        >
                          R$ {EUR ? formatCurrency(EUR.bid, 2) : "--"}
                        </span>
                        {EUR && (
                          <Variacao
                            pct={`${parseFloat(EUR.pctChange) >= 0 ? "+" : ""}${parseFloat(EUR.pctChange).toFixed(2)}%`}
                          />
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
          <div className="flex-1 flex flex-col min-h-0 gap-1">
            <p
              className={cn(
                "font-bold uppercase tracking-wide text-muted-foreground shrink-0",
                compact ? "text-[8px]" : "text-[9px]",
              )}
            >
              Índices
            </p>
            {errorMkt && !marketData ? (
              <p className={cn("text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>
                Erro ao carregar índices
              </p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2 shrink-0">
                  <span
                    className={cn(
                      "flex items-center gap-1 text-muted-foreground",
                      compact ? "text-[9px]" : "text-[10px]",
                    )}
                  >
                    <Landmark className="h-3 w-3" />
                    IBOVESPA
                  </span>
                  <div className="flex items-center gap-2 shrink-0">
                    {loadingMkt ? (
                      <Skeleton className="h-3 w-14" />
                    ) : (
                      <>
                        <span
                          className={cn(
                            "font-bold tabular-nums text-right",
                            compact ? "text-[10px]" : "text-xs",
                          )}
                        >
                          {ibovespa
                            ? ibovespa.price.toLocaleString("pt-BR", { maximumFractionDigits: 0 })
                            : "--"}
                        </span>
                        {ibovespa && <Variacao pct={fmtPct(ibovespa.change, 2)} />}
                      </>
                    )}
                  </div>
                </div>

                <div
                  className={cn(
                    "rounded-md border border-border/40 bg-muted/20 flex-1 min-h-0 overflow-y-auto",
                    compact ? "p-1" : "p-1.5",
                  )}
                >
                  <div className="grid grid-cols-3 gap-0 border-b border-border/10 pb-1 mb-1 sticky top-0 bg-muted/40 z-10 backdrop-blur-sm">
                    <p className="text-[8px] font-black text-muted-foreground uppercase text-left pl-1">
                      Ativo
                    </p>
                    <p className="text-[8px] font-black text-muted-foreground uppercase text-right">
                      Preço
                    </p>
                    <p className="text-[8px] font-black text-muted-foreground uppercase text-right pr-1">
                      Var. 24h
                    </p>
                  </div>
                  <div className="flex flex-col justify-evenly min-h-[4.5rem]">
                    {cryptos?.map((crypto) => (
                      <div key={crypto.symbol} className="grid grid-cols-3 items-center gap-0 py-0.5">
                        <div className="flex items-center gap-1.5 justify-start pl-1">
                          <IconeAtivo symbol={crypto.symbol} />
                          <span className="text-[10px] font-black">{crypto.symbol}</span>
                        </div>
                        <div className="text-right tabular-nums">
                          <span className="text-[10px] font-bold">
                            {crypto.price >= 1000
                              ? (crypto.price / 1000).toFixed(1) + "k"
                              : formatPrice(crypto.price)}
                          </span>
                        </div>
                        <div className="text-right pr-1">
                          <Variacao pct={fmtPct(crypto.change24h, 1)} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

          {lastUpdate && (
            <div className="flex items-center justify-end gap-1 opacity-50 mt-auto pt-0.5">
              <RefreshCw className="h-2.5 w-2.5 animate-pulse" />
              <p className="text-[9px] font-bold uppercase tracking-widest tabular-nums">
                {lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
