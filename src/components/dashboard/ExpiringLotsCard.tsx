import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Filter,
  Package,
  RefreshCcw,
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
        return "bg-destructive text-destructive-foreground";
      case "URGENTE":
        return "bg-warning text-warning-foreground";
      case "ATENCAO":
        return "bg-accent text-accent-foreground";
      default:
        return "bg-muted";
    }
  };

  const getCategoryBorderColor = (categoria: string) => {
    switch (categoria) {
      case "CRITICO":
        return "border-l-destructive";
      case "URGENTE":
        return "border-l-warning";
      case "ATENCAO":
        return "border-l-accent";
      default:
        return "border-l-muted";
    }
  };

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
      <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-lg text-primary">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Package className="h-5 w-5" />
              </div>
              Validades OK
            </div>
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isFetching}>
              <RefreshCcw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum lote próximo do vencimento nos próximos 90 dias.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Se no Publicado não aparece nada, verifique o Roadmap → Diagnóstico (falta de dados no ambiente de produção é a causa mais comum).
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card
        className={`border-2 h-full shadow-lg ${
          stats.critico > 0
            ? "border-destructive/60 bg-gradient-to-br from-destructive/10 via-background to-background"
            : stats.urgente > 0
              ? "border-warning/60 bg-gradient-to-br from-warning/10 via-background to-background"
              : "border-accent/60 bg-gradient-to-br from-accent/10 via-background to-background"
        }`}
      >
        <CardHeader className="pb-3 px-4 sm:px-6">
          <CardTitle className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              <motion.div
                className={`p-2 rounded-xl ${stats.critico > 0 ? "bg-destructive/20" : "bg-warning/20"}`}
                animate={{ scale: stats.critico > 0 ? [1, 1.15, 1] : 1 }}
                transition={{ repeat: stats.critico > 0 ? Infinity : 0, duration: 2 }}
              >
                <AlertTriangle
                  className={`h-6 w-6 ${stats.critico > 0 ? "text-destructive" : "text-warning"}`}
                />
              </motion.div>
              <span className={stats.critico > 0 ? "text-destructive" : ""}>Lotes a Vencer</span>
            </div>
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isFetching} className="h-8 w-8">
                <RefreshCcw className={"h-4 w-4 " + (isFetching ? "animate-spin" : "")} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowFullList(true)} className="h-8 text-xs font-semibold">
                Ver Todo
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-3">
            <div
              className={`p-3 rounded-xl text-center shadow-inner ${stats.critico > 0 ? "bg-destructive/15 border border-destructive/20" : "bg-muted/30"}`}
            >
              <p className={cn("text-2xl sm:text-3xl font-black", stats.critico > 0 ? "text-destructive" : "text-muted-foreground")}>{stats.critico}</p>
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">≤30 dias</p>
            </div>
            <div
              className={`p-3 rounded-xl text-center shadow-inner ${stats.urgente > 0 ? "bg-warning/15 border border-warning/20" : "bg-muted/30"}`}
            >
              <p className={cn("text-2xl sm:text-3xl font-black", stats.urgente > 0 ? "text-warning" : "text-muted-foreground")}>{stats.urgente}</p>
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">31-60 dias</p>
            </div>
            <div
              className={`p-3 rounded-xl text-center shadow-inner ${stats.atencao > 0 ? "bg-accent/15 border border-accent/20" : "bg-muted/30"}`}
            >
              <p className={cn("text-2xl sm:text-3xl font-black", stats.atencao > 0 ? "text-accent-foreground" : "text-muted-foreground")}>{stats.atencao}</p>
              <p className="text-[10px] sm:text-xs font-bold text-muted-foreground uppercase tracking-wider">61-90 dias</p>
            </div>
          </div>

          {/* Top 3 Critical Items */}
          <div className="space-y-2">
            <AnimatePresence>
              {expiringLots.slice(0, 3).map((lot, index) => (
                <motion.div
                  key={lot.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border-l-4 bg-card shadow-sm cursor-pointer hover:shadow-md hover:bg-muted/30 transition-all ${getCategoryBorderColor(lot.categoria)}`}
                  onClick={() => navigate(`/cadastros/itens/${lot.item_id}`)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate text-sm sm:text-base text-foreground uppercase tracking-tight">{lot.item_descricao}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Lote: {lot.numero_lote}</span>
                      </div>
                    </div>
                    <Badge className={cn("px-2.5 py-1 text-xs font-bold whitespace-nowrap rounded-full", getCategoryColor(lot.categoria))}>
                      {lot.dias_para_vencer} dias
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

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
