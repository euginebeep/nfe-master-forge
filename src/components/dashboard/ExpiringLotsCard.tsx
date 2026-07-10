import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Filter,
  Package,
  RefreshCcw,
  ShieldAlert,
  Flame,
  Timer,
  CalendarClock,
  Clock3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { addDays, differenceInDays, format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ExpiringLot {
  id: string;
  item_id: string;
  item_descricao: string;
  item_sku: string;
  numero_lote: string;
  data_val: string;
  dias_para_vencer: number;
  quantidade_interna: number;
  unidade_interna: string;
  status: string;
  categoria: "CRITICO" | "URGENTE" | "ATENCAO";
}

type RawLote = {
  id: string;
  item_id: string;
  numero_lote: string;
  data_val: string | null;
  quantidade_interna: number;
  unidade_original: string;
  status: string;
  item: {
    id: string;
    sku_interno: string | null;
    descricao_interna: string;
    unidade_interna: string | null;
  } | null;
};

/**
 * Card de alerta de lotes próximos do vencimento
 * (Agora lendo do backend, para funcionar igualmente no Preview e no Publicado)
 */
export function ExpiringLotsCard() {
  const navigate = useNavigate();
  const [showFullList, setShowFullList] = useState(false);
  const [filterDays, setFilterDays] = useState<number>(90);
  const [refreshTick, setRefreshTick] = useState(0);

  const today = useMemo(() => new Date(), [refreshTick]);
  const startIso = useMemo(() => format(today, "yyyy-MM-dd"), [today]);
  const endIso = useMemo(() => format(addDays(today, 90), "yyyy-MM-dd"), [today]);

  const {
    data: rawLotes,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery<RawLote[]>({
    queryKey: ["dashboard-expiring-lots", startIso, endIso, refreshTick],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estoque_lotes")
        .select(
          `id,item_id,numero_lote,data_val,quantidade_interna,unidade_original,status,
           item:itens (id, sku_interno, descricao_interna, unidade_interna)`,
        )
        .gte("data_val", startIso)
        .lte("data_val", endIso)
        .neq("status", "VENCIDO")
        .order("data_val", { ascending: true });

      if (error) throw error;
      return (data ?? []) as any;
    },
  });

  const expiringLots = useMemo((): ExpiringLot[] => {
    const lotes = rawLotes ?? [];
    const now = new Date();

    const expiring: ExpiringLot[] = [];

    for (const lote of lotes) {
      if (!lote.data_val) continue;

      const dataVal = parseISO(lote.data_val);
      const diasParaVencer = differenceInDays(dataVal, now);
      if (diasParaVencer < 0) continue;

      let categoria: "CRITICO" | "URGENTE" | "ATENCAO" = "ATENCAO";
      if (diasParaVencer <= 30) categoria = "CRITICO";
      else if (diasParaVencer <= 60) categoria = "URGENTE";

      expiring.push({
        id: lote.id,
        item_id: lote.item_id,
        item_descricao: lote.item?.descricao_interna || "Item não encontrado",
        item_sku: lote.item?.sku_interno || "-",
        numero_lote: lote.numero_lote,
        data_val: lote.data_val,
        dias_para_vencer: diasParaVencer,
        quantidade_interna: lote.quantidade_interna,
        unidade_interna: lote.item?.unidade_interna || lote.unidade_original || "un",
        status: lote.status,
        categoria,
      });
    }

    return expiring.sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);
  }, [rawLotes]);

  const filteredLots = useMemo(() => {
    return expiringLots.filter((l) => l.dias_para_vencer <= filterDays);
  }, [expiringLots, filterDays]);

  const stats = useMemo(
    () => ({
      critico: expiringLots.filter((l) => l.categoria === "CRITICO").length,
      urgente: expiringLots.filter((l) => l.categoria === "URGENTE").length,
      atencao: expiringLots.filter((l) => l.categoria === "ATENCAO").length,
      total: expiringLots.length,
    }),
    [expiringLots],
  );

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case "CRITICO":
        return "bg-red-600 text-white shadow-sm shadow-red-500/30";
      case "URGENTE":
        return "bg-amber-500 text-white shadow-sm shadow-amber-500/25";
      case "ATENCAO":
        return "bg-slate-500 text-white shadow-sm";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getCategoryStyles = (categoria: string) => {
    switch (categoria) {
      case "CRITICO":
        return {
          border: "border-l-red-500",
          bg: "bg-red-50/80 dark:bg-red-950/25",
          ring: "ring-red-500/10",
          dot: "bg-red-500",
        };
      case "URGENTE":
        return {
          border: "border-l-amber-500",
          bg: "bg-amber-50/70 dark:bg-amber-950/20",
          ring: "ring-amber-500/10",
          dot: "bg-amber-500",
        };
      default:
        return {
          border: "border-l-slate-400",
          bg: "bg-slate-50/70 dark:bg-slate-900/30",
          ring: "ring-slate-400/10",
          dot: "bg-slate-400",
        };
    }
  };

  const severityLevel = stats.critico > 0 ? "critico" : stats.urgente > 0 ? "urgente" : "atencao";

  const handleRefresh = async () => {
    setRefreshTick((v) => v + 1);
    await refetch();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-1/3" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-2 border-destructive/40">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <span className="text-lg">Lotes a Vencer</span>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Recarregar
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Falha ao carregar lotes.</p>
        </CardContent>
      </Card>
    );
  }

  if (stats.total === 0) {
    return (
      <Card className="h-full border-emerald-200/60 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20 dark:to-background">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-500/25">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div>
                <span className="font-bold text-emerald-700 dark:text-emerald-300">Validades OK</span>
                <p className="text-[10px] text-muted-foreground mt-0.5">Nenhum lote crítico nos próximos 90 dias</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isFetching} className="h-7 w-7">
              <RefreshCcw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="h-full"
      >
        <Card
          className={cn(
            "h-full overflow-hidden flex flex-col shadow-sm transition-all duration-300",
            severityLevel === "critico"
              ? "border-red-300/70 dark:border-red-800/50"
              : severityLevel === "urgente"
                ? "border-amber-300/70 dark:border-amber-800/50"
                : "border-slate-200 dark:border-slate-800",
          )}
        >
          <CardHeader
            className={cn(
              "pb-2 pt-3 px-4 shrink-0 border-b",
              severityLevel === "critico"
                ? "bg-gradient-to-r from-red-50 via-rose-50/80 to-background dark:from-red-950/40 dark:via-rose-950/20 dark:to-background border-red-100/80 dark:border-red-900/40"
                : severityLevel === "urgente"
                  ? "bg-gradient-to-r from-amber-50 via-orange-50/60 to-background dark:from-amber-950/30 dark:via-orange-950/15 dark:to-background border-amber-100/80 dark:border-amber-900/40"
                  : "bg-gradient-to-r from-slate-50 to-background dark:from-slate-900/40 dark:to-background border-border/60",
            )}
          >
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-2xl blur-md",
                      severityLevel === "critico"
                        ? "bg-red-500/35 animate-pulse"
                        : severityLevel === "urgente"
                          ? "bg-amber-500/25"
                          : "bg-slate-400/15",
                    )}
                  />
                  <motion.div
                    className={cn(
                      "relative flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg ring-2 ring-white/70 dark:ring-slate-900/60",
                      severityLevel === "critico"
                        ? "bg-gradient-to-br from-red-500 to-rose-600 shadow-red-500/35"
                        : severityLevel === "urgente"
                          ? "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/30"
                          : "bg-gradient-to-br from-slate-500 to-slate-600 shadow-slate-500/20",
                    )}
                    animate={
                      severityLevel === "critico"
                        ? { scale: [1, 1.06, 1], opacity: [1, 0.85, 1] }
                        : { scale: 1 }
                    }
                    transition={{ duration: 1.4, repeat: severityLevel === "critico" ? Infinity : 0, ease: "easeInOut" }}
                  >
                    <ShieldAlert className="h-5 w-5 text-white drop-shadow-sm" />
                  </motion.div>
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-sm font-bold leading-tight",
                        severityLevel === "critico"
                          ? "text-red-700 dark:text-red-300"
                          : severityLevel === "urgente"
                            ? "text-amber-700 dark:text-amber-300"
                            : "text-foreground",
                      )}
                    >
                      Lotes a Vencer
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[9px] px-1.5 py-0 h-4 font-bold",
                        severityLevel === "critico"
                          ? "border-red-300 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300 dark:bg-red-950/40"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      {stats.total} ativo{stats.total !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Clock3 className="h-3 w-3 shrink-0" />
                    Risco de validade · próximos 90 dias
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isFetching} className="h-7 w-7">
                  <RefreshCcw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowFullList(true)} className="h-7 text-[10px] font-semibold px-2">
                  Ver todos
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-3 px-4 pb-4 pt-3 flex-1">
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: "critico", count: stats.critico, label: "≤30 dias", icon: Flame, activeClass: "border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50", text: "text-red-600 dark:text-red-400", iconBg: "bg-red-100 dark:bg-red-900/50 text-red-600" },
                { key: "urgente", count: stats.urgente, label: "31-60 dias", icon: Timer, activeClass: "border-amber-200 bg-amber-50 dark:bg-amber-950/25 dark:border-amber-900/50", text: "text-amber-600 dark:text-amber-400", iconBg: "bg-amber-100 dark:bg-amber-900/50 text-amber-600" },
                { key: "atencao", count: stats.atencao, label: "61-90 dias", icon: CalendarClock, activeClass: "border-slate-200 bg-slate-50 dark:bg-slate-900/40 dark:border-slate-800", text: "text-slate-600 dark:text-slate-300", iconBg: "bg-slate-100 dark:bg-slate-800 text-slate-600" },
              ].map((stat) => {
                const Icon = stat.icon;
                const active = stat.count > 0;
                return (
                  <div
                    key={stat.key}
                    className={cn(
                      "rounded-xl border p-2 transition-all",
                      active ? stat.activeClass : "border-transparent bg-muted/20",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", active ? stat.iconBg : "bg-muted text-muted-foreground")}>
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      {active && stat.key === "critico" && (
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
                      )}
                    </div>
                    <p className={cn("text-lg font-black leading-none tabular-nums", active ? stat.text : "text-muted-foreground")}>
                      {stat.count}
                    </p>
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wide mt-0.5">
                      {stat.label}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <AnimatePresence>
                {expiringLots.slice(0, 3).map((lot, index) => {
                  const styles = getCategoryStyles(lot.categoria);
                  return (
                    <motion.div
                      key={lot.id}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.08 }}
                      className={cn(
                        "group flex items-center gap-2.5 p-2.5 rounded-xl border-l-[3px] cursor-pointer transition-all hover:shadow-md ring-1",
                        styles.border,
                        styles.bg,
                        styles.ring,
                      )}
                      onClick={() => navigate(`/cadastros/itens/${lot.item_id}`)}
                    >
                      <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/80 dark:bg-slate-900/60 shadow-sm border border-border/40")}>
                        <Package className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[11px] leading-tight line-clamp-2 break-words text-foreground">
                          {lot.item_descricao}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[9px] font-medium text-muted-foreground bg-background/70 dark:bg-slate-950/40 px-1.5 py-0.5 rounded border border-border/50">
                            Lote {lot.numero_lote}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            Val. {format(parseISO(lot.data_val), "dd/MM/yy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0 gap-0.5">
                        <Badge className={cn("px-1.5 py-0 text-[9px] font-bold rounded-full tabular-nums", getCategoryColor(lot.categoria))}>
                          {lot.dias_para_vencer}d
                        </Badge>
                        <span className={cn("h-1.5 w-1.5 rounded-full", styles.dot)} />
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Full List Dialog */}
      <Dialog open={showFullList} onOpenChange={setShowFullList}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Lotes Próximos do Vencimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Filter */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtrar por:</span>
              </div>
              <Select value={filterDays.toString()} onValueChange={(v) => setFilterDays(parseInt(v))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">≤ 30 dias (Crítico)</SelectItem>
                  <SelectItem value="60">≤ 60 dias (Urgente)</SelectItem>
                  <SelectItem value="90">≤ 90 dias (Todos)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filteredLots.length} lote(s) encontrado(s)</span>
            </div>

            {/* Table */}
            <DataTable
              data={filteredLots}
              searchable={false}
              columns={[
                {
                  key: "item_descricao",
                  header: "Produto",
                  render: (row) => (
                    <div>
                      <p className="font-medium">{row.item_descricao}</p>
                      <p className="text-xs text-muted-foreground">{row.item_sku}</p>
                    </div>
                  ),
                },
                {
                  key: "numero_lote",
                  header: "Lote",
                },
                {
                  key: "quantidade_interna",
                  header: "Quantidade",
                  render: (row) => (
                    <span>
                      {row.quantidade_interna.toLocaleString("pt-BR")} {row.unidade_interna.toUpperCase()}
                    </span>
                  ),
                },
                {
                  key: "data_val",
                  header: "Validade",
                  render: (row) => format(parseISO(row.data_val), "dd/MM/yyyy", { locale: ptBR }),
                },
                {
                  key: "dias_para_vencer",
                  header: "Dias",
                  render: (row) => <Badge className={getCategoryColor(row.categoria)}>{row.dias_para_vencer} dias</Badge>,
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge variant={row.status === "DISPONIVEL" ? "default" : "secondary"}>{row.status}</Badge>
                  ),
                },
                {
                  key: "actions",
                  header: "",
                  render: (row) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigate(`/cadastros/itens/${row.item_id}`);
                        setShowFullList(false);
                      }}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
