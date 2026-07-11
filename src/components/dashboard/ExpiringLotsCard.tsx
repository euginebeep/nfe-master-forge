import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Box,
  Calendar,
  ChevronRight,
  Filter,
  Flame,
  FlaskConical,
  Hourglass,
  Leaf,
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
    label: string;
    prioridade: string;
    Icon: typeof Box;
    summaryIcon: typeof AlertTriangle;
    summaryLabel: string;
    card: string;
    iconBox: string;
    badge: string;
    progress: string;
    prioridadeText: string;
    daysBadge: string;
  }
> = {
  CRITICO: {
    label: "Até 30 dias",
    prioridade: "CRÍTICO",
    Icon: Box,
    summaryIcon: Flame,
    summaryLabel: "Até 30 dias",
    card: "bg-red-50/60 border-red-100 hover:border-red-200",
    iconBox: "bg-red-100 text-red-600",
    badge: "bg-red-50 text-red-700 border border-red-200",
    progress: "bg-red-500",
    prioridadeText: "text-red-600",
    daysBadge: "text-red-600",
  },
  URGENTE: {
    label: "31–60 dias",
    prioridade: "ALTA",
    Icon: FlaskConical,
    summaryIcon: Hourglass,
    summaryLabel: "31–60 dias",
    card: "bg-orange-50/60 border-orange-100 hover:border-orange-200",
    iconBox: "bg-orange-100 text-orange-600",
    badge: "bg-orange-50 text-orange-700 border border-orange-200",
    progress: "bg-orange-500",
    prioridadeText: "text-orange-600",
    daysBadge: "text-orange-600",
  },
  ATENCAO: {
    label: "61–90 dias",
    prioridade: "MÉDIA",
    Icon: Leaf,
    summaryIcon: Calendar,
    summaryLabel: "61–90 dias",
    card: "bg-amber-50/60 border-amber-100 hover:border-amber-200",
    iconBox: "bg-amber-100 text-amber-700",
    badge: "bg-amber-50 text-amber-800 border border-amber-200",
    progress: "bg-amber-500",
    prioridadeText: "text-amber-700",
    daysBadge: "text-amber-700",
  },
};

function calcUrgenciaPct(dias: number): number {
  return Math.min(95, Math.max(25, Math.round(100 - dias * 0.78)));
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
        urgencia_pct: calcUrgenciaPct(diasParaVencer),
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
    { key: "CRITICO" as const, count: stats.critico },
    { key: "URGENTE" as const, count: stats.urgente },
    { key: "ATENCAO" as const, count: stats.atencao },
  ];

  if (isLoading) {
    return (
      <Card className="border border-border/60 shadow-sm">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-5 bg-muted rounded w-1/3" />
            <div className="h-4 bg-muted rounded w-2/3" />
            <div className="grid grid-cols-3 gap-3">
              <div className="h-16 bg-muted rounded-xl" />
              <div className="h-16 bg-muted rounded-xl" />
              <div className="h-16 bg-muted rounded-xl" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border border-destructive/30 shadow-sm">
        <CardContent className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-destructive">
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
      <Card className="border border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2 min-w-0">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm sm:text-base font-bold uppercase tracking-wide text-red-600">
                    Lotes críticos para ação
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
                    Matérias-primas com vencimento próximo que exigem avaliação do responsável
                    técnico para definição de tratativa.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isFetching}
                className="h-8 w-8"
                aria-label="Atualizar lotes"
              >
                <RefreshCcw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </Button>
              <button
                type="button"
                onClick={() => (stats.total > 0 ? setShowFullList(true) : navigate("/estoque/lotes"))}
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
              >
                Ver todos os lotes a vencer →
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-muted-foreground">
              Resumo por faixa de vencimento
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {summaryItems.map(({ key, count }) => {
                const meta = CATEGORIA_META[key];
                const SummaryIcon = meta.summaryIcon;
                return (
                  <div
                    key={key}
                    className={cn(
                      "rounded-xl border px-4 py-3 flex items-center gap-3",
                      meta.card,
                    )}
                  >
                    <div className={cn("p-2 rounded-lg", meta.iconBox)}>
                      <SummaryIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <p className={cn("text-2xl font-bold leading-none", meta.prioridadeText)}>
                        {count}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">{meta.summaryLabel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {stats.total === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum lote com vencimento nos próximos 90 dias.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {expiringLots.slice(0, 6).map((lot) => {
                const meta = CATEGORIA_META[lot.categoria];
                const LotIcon = meta.Icon;

                return (
                  <button
                    key={lot.id}
                    type="button"
                    onClick={() => navigate(`/estoque/lotes/${lot.id}`)}
                    className={cn(
                      "rounded-xl border p-4 text-left transition-all hover:shadow-md",
                      meta.card,
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn("p-2.5 rounded-xl shrink-0", meta.iconBox)}>
                          <LotIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate">
                            {lot.item_descricao}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            Lote {lot.numero_lote}
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn("text-[11px] font-medium shrink-0", meta.badge)}
                      >
                        {lot.dias_para_vencer} dias para vencer
                      </Badge>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className={cn("font-bold uppercase tracking-wide", meta.prioridadeText)}>
                          {meta.prioridade}
                        </span>
                        <span className="text-muted-foreground">{lot.urgencia_pct}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/80 overflow-hidden">
                        <div
                          className={cn("h-2 rounded-full transition-all", meta.progress)}
                          style={{ width: `${lot.urgencia_pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">Validade</p>
                        <p className="font-medium mt-0.5">
                          {format(parseISO(lot.data_val), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Estoque</p>
                        <p className="font-medium mt-0.5">
                          {lot.pct_estoque}% ({formatQuantidade(lot.quantidade_interna, lot.unidade_interna)})
                        </p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-muted-foreground">Local</p>
                        <p className="font-medium mt-0.5 truncate" title={lot.local}>
                          {lot.local}
                        </p>
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
                    <Badge variant="outline" className={CATEGORIA_META[row.categoria].badge}>
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
