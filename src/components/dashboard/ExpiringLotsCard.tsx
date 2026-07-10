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

/** Título legível sem gritar em CAPS — cabe melhor no card estreito */
function formatarNomeProduto(nome: string): string {
  const t = nome.trim();
  if (t === t.toUpperCase() && t.length > 4) {
    return t
      .toLowerCase()
      .split(/\s+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }
  return t;
}

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
      <Card className="h-full overflow-hidden flex flex-col shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4 min-h-[52px] bg-gradient-to-r from-emerald-50 to-teal-50/50 dark:from-emerald-950/30 dark:to-teal-950/20">
          <CardTitle className="text-sm font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <span className="block leading-tight">Validades OK</span>
                <p className="text-[10px] font-normal text-muted-foreground mt-0.5">Nenhum lote crítico em 90 dias</p>
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
        <Card className="h-full overflow-hidden flex flex-col shadow-sm">
          <CardHeader
            className={cn(
              "pb-2 pt-3 px-4 shrink-0 min-h-[52px] border-b border-border/40",
              severityLevel === "critico"
                ? "bg-gradient-to-r from-red-50 to-rose-50/40 dark:from-red-950/35 dark:to-rose-950/15"
                : severityLevel === "urgente"
                  ? "bg-gradient-to-r from-amber-50 to-orange-50/40 dark:from-amber-950/30 dark:to-orange-950/15"
                  : "bg-gradient-to-r from-slate-50 to-slate-100/40 dark:from-slate-900/40 dark:to-slate-800/20",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-sm font-semibold flex items-start gap-2 min-w-0">
                <div className="relative shrink-0 mt-0.5">
                  {severityLevel === "critico" && (
                    <span className="absolute inset-0 rounded-lg bg-red-500/30 blur-sm animate-pulse" />
                  )}
                  <div
                    className={cn(
                      "relative p-1.5 rounded-lg",
                      severityLevel === "critico"
                        ? "bg-red-500/15"
                        : severityLevel === "urgente"
                          ? "bg-amber-500/15"
                          : "bg-slate-500/10",
                    )}
                  >
                    <ShieldAlert
                      className={cn(
                        "h-4 w-4",
                        severityLevel === "critico"
                          ? "text-red-600 dark:text-red-400"
                          : severityLevel === "urgente"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-slate-600 dark:text-slate-400",
                      )}
                    />
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="block leading-tight">Lotes a Vencer</span>
                  <p className="text-[10px] font-normal text-muted-foreground mt-0.5 leading-snug">
                    {stats.total} lote{stats.total !== 1 ? 's' : ''} · validade em 90 dias
                  </p>
                </div>
              </CardTitle>

              <div className="flex items-center gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isFetching} className="h-7 w-7">
                  <RefreshCcw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFullList(true)}
                  className="h-7 text-[11px] font-medium px-2 text-primary hover:text-primary"
                >
                  Ver todos
                  <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-4 pt-3 space-y-2.5 flex-1">
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { count: stats.critico, label: '≤30d', sub: 'Crítico', icon: Flame, tone: 'red' as const },
                { count: stats.urgente, label: '31-60d', sub: 'Urgente', icon: Timer, tone: 'amber' as const },
                { count: stats.atencao, label: '61-90d', sub: 'Atenção', icon: CalendarClock, tone: 'slate' as const },
              ].map((stat) => {
                const Icon = stat.icon;
                const active = stat.count > 0;
                const toneMap = {
                  red: {
                    box: 'bg-red-50 dark:bg-red-950/30 border-red-100 dark:border-red-900/40',
                    num: 'text-red-600 dark:text-red-400',
                    icon: 'bg-red-100 dark:bg-red-900/40 text-red-600',
                  },
                  amber: {
                    box: 'bg-amber-50 dark:bg-amber-950/25 border-amber-100 dark:border-amber-900/40',
                    num: 'text-amber-600 dark:text-amber-400',
                    icon: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600',
                  },
                  slate: {
                    box: 'bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800',
                    num: 'text-slate-700 dark:text-slate-300',
                    icon: 'bg-slate-100 dark:bg-slate-800 text-slate-600',
                  },
                }[stat.tone];

                return (
                  <div
                    key={stat.sub}
                    className={cn(
                      'rounded-xl border p-2 text-center',
                      active ? toneMap.box : 'bg-muted/20 border-transparent',
                    )}
                  >
                    <div className={cn('mx-auto mb-1 flex h-6 w-6 items-center justify-center rounded-md', active ? toneMap.icon : 'bg-muted text-muted-foreground')}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <p className={cn('text-base font-black leading-none tabular-nums', active ? toneMap.num : 'text-muted-foreground')}>
                      {stat.count}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground leading-tight mt-1">{stat.label}</p>
                  </div>
                );
              })}
            </div>

            <div className="space-y-2">
              <AnimatePresence>
                {expiringLots.slice(0, 3).map((lot, index) => {
                  const styles = getCategoryStyles(lot.categoria);
                  const nome = formatarNomeProduto(lot.item_descricao);
                  return (
                    <motion.button
                      key={lot.id}
                      type="button"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.06 }}
                      className={cn(
                        'w-full text-left flex items-center gap-2.5 p-2.5 rounded-xl border-l-[3px] transition-all hover:shadow-sm',
                        styles.border,
                        styles.bg,
                      )}
                      onClick={() => navigate(`/cadastros/itens/${lot.item_id}`)}
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-slate-900 shadow-sm border border-border/50">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <p
                          className="text-xs font-semibold text-foreground leading-snug"
                          title={lot.item_descricao}
                        >
                          {nome}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight truncate">
                          Lote {lot.numero_lote} · {format(parseISO(lot.data_val), 'dd/MM/yy', { locale: ptBR })}
                        </p>
                      </div>

                      <Badge
                        className={cn(
                          'shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-md tabular-nums whitespace-nowrap',
                          getCategoryColor(lot.categoria),
                        )}
                      >
                        {lot.dias_para_vencer} dias
                      </Badge>
                    </motion.button>
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
