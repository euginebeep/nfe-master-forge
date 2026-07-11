import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Calendar,
  ChevronRight,
  Clock,
  Filter,
  FlaskConical,
  Leaf,
  MapPin,
  RefreshCcw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { useNavigate } from "react-router-dom";
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
  quantidade_original: number;
  unidade_interna: string;
  status: string;
  local: string;
  pct_estoque: number;
  urgencia_pct: number;
  categoria: "CRITICO" | "URGENTE" | "ATENCAO";
}

type RawLote = {
  id: string;
  item_id: string;
  numero_lote: string;
  data_val: string | null;
  quantidade_interna: number;
  quantidade_original: number;
  unidade_original: string;
  status: string;
  item: {
    id: string;
    sku_interno: string | null;
    descricao_interna: string;
    unidade_interna: string | null;
    armazenamento: string | null;
  } | null;
};

type CategoriaLote = ExpiringLot["categoria"];

const CATEGORIA_META: Record<
  CategoriaLote,
  {
    prioridade: string;
    LotIcon: typeof Box;
    SummaryIcon: typeof MapPin;
    summaryBg: string;
    summaryBorder: string;
    summaryIconBg: string;
    summaryIconColor: string;
    summaryCount: string;
    iconBox: string;
    iconColor: string;
    badgeBg: string;
    badgeNumber: string;
    badgeSub: string;
    prioridadeText: string;
    progress: string;
    progressTrack: string;
  }
> = {
  CRITICO: {
    prioridade: "CRÍTICO",
    LotIcon: Box,
    SummaryIcon: MapPin,
    summaryBg: "bg-red-50",
    summaryBorder: "border-red-100",
    summaryIconBg: "bg-red-100",
    summaryIconColor: "text-red-600",
    summaryCount: "text-red-600",
    iconBox: "bg-red-50",
    iconColor: "text-red-500",
    badgeBg: "bg-red-50",
    badgeNumber: "text-red-600",
    badgeSub: "text-red-500",
    prioridadeText: "text-red-600",
    progress: "bg-red-500",
    progressTrack: "bg-red-100",
  },
  URGENTE: {
    prioridade: "ALTA",
    LotIcon: FlaskConical,
    SummaryIcon: FlaskConical,
    summaryBg: "bg-orange-50",
    summaryBorder: "border-orange-100",
    summaryIconBg: "bg-orange-100",
    summaryIconColor: "text-orange-600",
    summaryCount: "text-orange-600",
    iconBox: "bg-orange-50",
    iconColor: "text-orange-500",
    badgeBg: "bg-orange-50",
    badgeNumber: "text-orange-600",
    badgeSub: "text-orange-500",
    prioridadeText: "text-orange-600",
    progress: "bg-orange-500",
    progressTrack: "bg-orange-100",
  },
  ATENCAO: {
    prioridade: "MÉDIA",
    LotIcon: Leaf,
    SummaryIcon: Clock,
    summaryBg: "bg-amber-50",
    summaryBorder: "border-amber-100",
    summaryIconBg: "bg-amber-100",
    summaryIconColor: "text-amber-600",
    summaryCount: "text-amber-600",
    iconBox: "bg-amber-50",
    iconColor: "text-amber-600",
    badgeBg: "bg-amber-50",
    badgeNumber: "text-amber-700",
    badgeSub: "text-amber-600",
    prioridadeText: "text-amber-700",
    progress: "bg-amber-500",
    progressTrack: "bg-amber-100",
  },
};

function calcUrgenciaPct(dias: number, categoria: CategoriaLote): number {
  if (categoria === "CRITICO") {
    return Math.min(95, Math.max(40, Math.round(100 - (dias / 30) * 25)));
  }
  if (categoria === "URGENTE") {
    return Math.min(90, Math.max(30, Math.round(((60 - dias) / 30) * 55)));
  }
  return Math.min(80, Math.max(20, Math.round(((90 - dias) / 30) * 50)));
}

function formatQuantidade(qtd: number, unidade: string): string {
  return `${qtd.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${unidade}`;
}

function localLote(lote: RawLote): string {
  const armazenamento = lote.item?.armazenamento?.trim();
  if (armazenamento) return armazenamento;
  if (lote.status === "QUARENTENA") return "Quarentena";
  if (lote.status === "BLOQUEADO") return "Bloqueado";
  return "Depósito principal";
}

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
      const { data, error: queryError } = await supabase
        .from("estoque_lotes")
        .select(
          `id,item_id,numero_lote,data_val,quantidade_interna,quantidade_original,unidade_original,status,
           item:itens (id, sku_interno, descricao_interna, unidade_interna, armazenamento)`,
        )
        .gte("data_val", startIso)
        .lte("data_val", endIso)
        .neq("status", "VENCIDO")
        .order("data_val", { ascending: true });

      if (queryError) throw queryError;
      return (data ?? []) as RawLote[];
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

      let categoria: CategoriaLote = "ATENCAO";
      if (diasParaVencer <= 30) categoria = "CRITICO";
      else if (diasParaVencer <= 60) categoria = "URGENTE";

      const original = lote.quantidade_original > 0 ? lote.quantidade_original : lote.quantidade_interna;
      const pctEstoque = original > 0
        ? Math.round((lote.quantidade_interna / original) * 100)
        : 100;

      expiring.push({
        id: lote.id,
        item_id: lote.item_id,
        item_descricao: lote.item?.descricao_interna || "Item não encontrado",
        item_sku: lote.item?.sku_interno || "-",
        numero_lote: lote.numero_lote,
        data_val: lote.data_val,
        dias_para_vencer: diasParaVencer,
        quantidade_interna: lote.quantidade_interna,
        quantidade_original: original,
        unidade_interna: lote.item?.unidade_interna || lote.unidade_original || "un",
        status: lote.status,
        local: localLote(lote),
        pct_estoque: pctEstoque,
        urgencia_pct: calcUrgenciaPct(diasParaVencer, categoria),
        categoria,
      });
    }

    return expiring.sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);
  }, [rawLotes]);

  const filteredLots = useMemo(
    () => expiringLots.filter((l) => l.dias_para_vencer <= filterDays),
    [expiringLots, filterDays],
  );

  const stats = useMemo(
    () => ({
      critico: expiringLots.filter((l) => l.categoria === "CRITICO").length,
      urgente: expiringLots.filter((l) => l.categoria === "URGENTE").length,
      atencao: expiringLots.filter((l) => l.categoria === "ATENCAO").length,
      total: expiringLots.length,
    }),
    [expiringLots],
  );

  const handleRefresh = async () => {
    setRefreshTick((v) => v + 1);
    await refetch();
  };

  const summaryItems = [
    { key: "CRITICO" as const, count: stats.critico, label: "Até 30 dias" },
    { key: "URGENTE" as const, count: stats.urgente, label: "31–60 dias" },
    { key: "ATENCAO" as const, count: stats.atencao, label: "61–90 dias" },
  ];

  if (isLoading) {
    return (
      <Card className="border border-border/50 shadow-sm rounded-xl">
        <CardContent className="p-4">
          <div className="animate-pulse space-y-4">
            <div className="h-5 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 bg-muted rounded-xl" />
              <div className="h-20 bg-muted rounded-xl" />
              <div className="h-20 bg-muted rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-destructive/30 shadow-sm rounded-2xl">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-red-600">
              Lotes críticos para ação
            </h3>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCcw className="h-4 w-4 mr-2" />
              Recarregar
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">Falha ao carregar lotes.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border border-border/50 shadow-sm rounded-xl overflow-hidden bg-white">
        <CardContent className="p-3 sm:p-4 space-y-3">
          {/* Cabeçalho: título à esquerda, resumo à direita */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-red-100">
                <AlertTriangle className="h-4 w-4 text-red-600 fill-red-600/20" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold uppercase tracking-wide text-red-600 leading-tight">
                  Lotes críticos para ação
                </h3>
                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                  Lotes próximos do vencimento que precisam de ação imediata para evitar perdas.
                </p>
              </div>
            </div>

            <div className="shrink-0 sm:min-w-[200px]">
              <p className="text-[10px] text-muted-foreground mb-1.5 text-right">
                Resumo por faixa de vencimento
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {summaryItems.map(({ key, count, label }) => {
                  const meta = CATEGORIA_META[key];
                  const SummaryIcon = meta.SummaryIcon;
                  return (
                    <div
                      key={key}
                      className={cn(
                        "rounded-lg border px-1.5 py-1.5 flex flex-col items-center text-center gap-0.5",
                        meta.summaryBg,
                        meta.summaryBorder,
                      )}
                    >
                      <div className={cn("p-1 rounded-md", meta.summaryIconBg)}>
                        <SummaryIcon className={cn("h-3 w-3", meta.summaryIconColor)} />
                      </div>
                      <p className={cn("text-lg font-bold leading-none", meta.summaryCount)}>
                        {count}
                      </p>
                      <p className="text-[9px] text-muted-foreground leading-tight">{label}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Link centralizado */}
          <div className="flex items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={() => (stats.total > 0 ? setShowFullList(true) : navigate("/estoque/lotes"))}
              className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
            >
              Ver todos os lotes a vencer
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isFetching}
              className="h-6 w-6 text-muted-foreground"
              aria-label="Atualizar lotes"
            >
              <RefreshCcw className={cn("h-3 w-3", isFetching && "animate-spin")} />
            </Button>
          </div>

          {/* Cards de lote */}
          {stats.total === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/10 px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                Nenhum lote com vencimento nos próximos 90 dias.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {expiringLots.slice(0, 6).map((lot) => {
                const meta = CATEGORIA_META[lot.categoria];
                const LotIcon = meta.LotIcon;

                return (
                  <button
                    key={lot.id}
                    type="button"
                    onClick={() => navigate(`/estoque/lotes/${lot.id}`)}
                    className="rounded-xl border border-border/60 bg-white p-2.5 text-left shadow-sm hover:shadow-md transition-shadow min-w-0"
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                          meta.iconBox,
                        )}
                      >
                        <LotIcon className={cn("h-4 w-4", meta.iconColor)} strokeWidth={1.75} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-[10px] uppercase text-foreground leading-tight line-clamp-2">
                              {lot.item_descricao}
                            </p>
                            <p className="text-[9px] text-muted-foreground mt-0.5 truncate">
                              Lote {lot.numero_lote}
                            </p>
                          </div>

                          <div
                            className={cn(
                              "shrink-0 rounded-lg px-1.5 py-1 text-center min-w-[48px]",
                              meta.badgeBg,
                            )}
                          >
                            <p className={cn("text-sm font-bold leading-none", meta.badgeNumber)}>
                              {lot.dias_para_vencer}
                            </p>
                            <p className="text-[8px] text-muted-foreground leading-tight mt-0.5">
                              dias p/ vencer
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 mt-1.5 text-[9px] text-muted-foreground">
                          <Calendar className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {format(parseISO(lot.data_val), "dd/MM/yy", { locale: ptBR })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 pt-2 border-t border-border/40">
                      <p className={cn("text-[9px] font-bold uppercase tracking-wide", meta.prioridadeText)}>
                        {meta.prioridade}
                      </p>
                      <div className={cn("mt-1 h-0.5 rounded-full overflow-hidden", meta.progressTrack)}>
                        <div
                          className={cn("h-full rounded-full transition-all", meta.progress)}
                          style={{ width: `${lot.urgencia_pct}%` }}
                        />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showFullList} onOpenChange={setShowFullList}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Lotes próximos do vencimento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Filtrar por:</span>
              </div>
              <Select value={filterDays.toString()} onValueChange={(v) => setFilterDays(parseInt(v))}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">≤ 30 dias (Crítico)</SelectItem>
                  <SelectItem value="60">≤ 60 dias (Alta)</SelectItem>
                  <SelectItem value="90">≤ 90 dias (Todos)</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                {filteredLots.length} lote(s) encontrado(s)
              </span>
            </div>

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
                { key: "numero_lote", header: "Lote" },
                {
                  key: "quantidade_interna",
                  header: "Quantidade",
                  render: (row) => (
                    <span>
                      {formatQuantidade(row.quantidade_interna, row.unidade_interna)}
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
                  render: (row) => (
                    <Badge variant="outline" className={cn("border-0", CATEGORIA_META[row.categoria].badgeBg, CATEGORIA_META[row.categoria].badgeNumber)}>
                      {row.dias_para_vencer} dias
                    </Badge>
                  ),
                },
                {
                  key: "local",
                  header: "Local",
                  render: (row) => row.local,
                },
                {
                  key: "actions",
                  header: "",
                  render: (row) => (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigate(`/estoque/lotes/${row.id}`);
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
