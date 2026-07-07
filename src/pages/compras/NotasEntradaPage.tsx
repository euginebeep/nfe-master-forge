import { useState, useMemo, useCallback } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, Calendar, Building2, DollarSign,
  Package, CheckCircle2, AlertTriangle, Clock, XCircle,
  TrendingUp, Filter, ChevronDown
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { DataTable } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { useNotasEntrada, type NotaEntrada, processarNota } from "@/hooks/use-notas-entrada";
import { formatCurrency, formatDate } from "@/lib/nfe-parser";
import { NFeVisualizacaoDialog } from "@/components/nfe/NFeVisualizacaoDialog";
import { NotaEntradaAcoesCell } from "@/components/nfe/NotaEntradaAcoesCell";
import { ImportarCoaNotaDialog } from "@/components/nfe/ImportarCoaNotaDialog";
import { BackButton } from "@/components/ui/back-button";
import { reverterImportacaoNFe } from "@/lib/supabase-nfe-import";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

// ── Status badges ──────────────────────────────────────────────
const STATUS_VARIANTS: Record<string, "success" | "warning" | "muted"> = {
  IMPORTADA: "success",
  PROCESSADA: "success",
  CANCELADA: "muted",
};

const STATUS_FIN_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PAGO: {
    label: "Pago",
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: <CheckCircle2 className="h-3 w-3" />,
  },
  PENDENTE: {
    label: "Pendente",
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: <Clock className="h-3 w-3" />,
  },
  VENCIDO: {
    label: "Vencido",
    color: "bg-red-100 text-red-700 border-red-200",
    icon: <AlertTriangle className="h-3 w-3" />,
  },
  SEM_DUPLICATA: {
    label: "Sem duplicata",
    color: "bg-slate-100 text-slate-500 border-slate-200",
    icon: <XCircle className="h-3 w-3" />,
  },
};

// ── Filtros de período ─────────────────────────────────────────
type PeriodoFiltro = "todos" | "mes" | "trimestre" | "ano";
type StatusFinFiltro = "todos" | "PAGO" | "PENDENTE" | "VENCIDO" | "SEM_DUPLICATA";

function filtrarPorPeriodo(notas: NotaEntrada[], periodo: PeriodoFiltro): NotaEntrada[] {
  if (periodo === "todos") return notas;
  const agora = new Date();
  const inicio = new Date();
  if (periodo === "mes") inicio.setDate(1);
  else if (periodo === "trimestre") inicio.setMonth(agora.getMonth() - 2, 1);
  else if (periodo === "ano") inicio.setMonth(0, 1);
  inicio.setHours(0, 0, 0, 0);
  return notas.filter((n) => {
    const d = n.dh_emissao ? new Date(n.dh_emissao) : null;
    return d && d >= inicio;
  });
}

// ── KPI Card ───────────────────────────────────────────────────
function KpiCard({ icon, label, value, sub, color }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <Card className="flex-1 min-w-[160px]">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", color ?? "bg-primary/10 text-primary")}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <p className="text-lg font-bold leading-tight">{value}</p>
          {sub && <p className="text-xs text-muted-foreground truncate">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Página principal ───────────────────────────────────────────
export default function NotasEntradaPage() {
  const navigate = useNavigate();
  const { data: notas = [], isLoading } = useNotasEntrada();
  const [selectedChaveNfe, setSelectedChaveNfe] = useState<string>("");
  const [showNFeDialog, setShowNFeDialog] = useState(false);
  const [reverting, setReverting] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [periodo, setPeriodo] = useState<PeriodoFiltro>("todos");
  const [statusFinFiltro, setStatusFinFiltro] = useState<StatusFinFiltro>("todos");
  const [coaImportNota, setCoaImportNota] = useState<{ id: string; numero: string } | null>(null);
  const [coaDialogOpen, setCoaDialogOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleViewNota = useCallback((nota: NotaEntrada) => {
    if (nota.chave_nfe) {
      setSelectedChaveNfe(nota.chave_nfe);
      setShowNFeDialog(true);
    }
  }, []);

  const handleRefreshNotas = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['notas-entrada'] });
    queryClient.invalidateQueries({ queryKey: ['estoque-lotes'] });
  }, [queryClient]);

  const handleImportarCoa = useCallback((nota: NotaEntrada) => {
    setCoaImportNota({ id: nota.id, numero: nota.numero });
    setCoaDialogOpen(true);
  }, []);

  const handleCoaDialogOpenChange = useCallback((open: boolean) => {
    setCoaDialogOpen(open);
    if (!open) setCoaImportNota(null);
  }, []);

  const handleReverter = useCallback(async (nota: NotaEntrada) => {
    if (!confirm(`Tem certeza que deseja REVERTER a importação da NF-e ${nota.numero}?\n\nIsso apagará todos os lotes, itens da nota e contas a pagar gerados por esta importação.`)) return;
    setReverting(nota.id);
    try {
      await reverterImportacaoNFe(nota.id);
      toast.success(`NF-e ${nota.numero} revertida com sucesso!`);
      queryClient.invalidateQueries({ queryKey: ['notas-entrada'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-lotes'] });
      queryClient.invalidateQueries({ queryKey: ['itens'] });
    } catch {
      toast.error('Erro ao reverter importação');
    } finally {
      setReverting(null);
    }
  }, [queryClient]);

  const handleProcessarNota = useCallback(async (nota: NotaEntrada) => {
    setProcessando(nota.id);
    try {
      const resultado = await processarNota(nota.id);
      toast.success(
        `NF-e ${nota.numero} processada: ${resultado.movimentacoes} movimentação(ões), ${resultado.contas_pagar} conta(s) a pagar.`
      );
      queryClient.invalidateQueries({ queryKey: ['notas-entrada'] });
      queryClient.invalidateQueries({ queryKey: ['estoque-lotes'] });
    } catch (err) {
      const e = err as { message?: string; code?: string };
      toast.error(e.message || e.code || 'Erro ao processar nota');
    } finally {
      setProcessando(null);
    }
  }, [queryClient]);

  // ── Dados filtrados ──────────────────────────────────────────
  const notasFiltradas = useMemo(() => {
    let resultado = filtrarPorPeriodo(notas, periodo);
    if (statusFinFiltro !== "todos") {
      resultado = resultado.filter((n) => n.status_financeiro === statusFinFiltro);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      resultado = resultado.filter((n) =>
        n.numero?.toLowerCase().includes(q) ||
        n.fornecedor_razao?.toLowerCase().includes(q) ||
        n.fornecedor_nome_fantasia?.toLowerCase().includes(q) ||
        n.fornecedor_cnpj?.includes(q) ||
        n.chave_nfe?.includes(q)
      );
    }
    return resultado;
  }, [notas, periodo, statusFinFiltro, search]);

  // ── KPIs ─────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const notasMes = filtrarPorPeriodo(notas, "mes");
    const totalMes = notasMes.reduce((s, n) => s + (n.total_nota ?? 0), 0);
    const pendentes = notas.filter((n) => n.status_financeiro === "PENDENTE" || n.status_financeiro === "VENCIDO");
    const totalPendente = pendentes.reduce((s, n) => s + (n.total_nota ?? 0), 0);
    const vencidas = notas.filter((n) => n.status_financeiro === "VENCIDO").length;
    const naoVinculadas = notas.filter((n) => (n.qtd_itens ?? 0) > 0 && (n.qtd_itens_vinculados ?? 0) < (n.qtd_itens ?? 0)).length;
    return { totalMes, totalPendente, vencidas, naoVinculadas, qtdMes: notasMes.length };
  }, [notas]);

  // ── Colunas ──────────────────────────────────────────────────
  const columns = useMemo(() => [
    {
      key: "numero",
      header: "Número / Série",
      sortable: true,
      className: "min-w-[140px]",
      render: (item: NotaEntrada) => (
        <button onClick={() => handleViewNota(item)} className="flex items-center gap-2 hover:text-primary transition-colors text-left">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <div>
            <span className="font-mono font-semibold hover:underline">{item.numero}</span>
            <span className="text-muted-foreground text-xs ml-1">Série {item.serie}</span>
          </div>
        </button>
      ),
    },
    {
      key: "dh_emissao",
      header: "Emissão",
      sortable: true,
      className: "min-w-[110px]",
      render: (item: NotaEntrada) => (
        <div className="flex items-center gap-1.5 text-sm whitespace-nowrap">
          <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
          {formatDate(item.dh_emissao)}
        </div>
      ),
    },
    {
      key: "fornecedor_razao",
      header: "Fornecedor",
      className: "min-w-[200px]",
      render: (item: NotaEntrada) => (
        <div className="flex items-center gap-2 min-w-0">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="font-medium text-sm truncate max-w-[200px]">
              {item.fornecedor_nome_fantasia || item.fornecedor_razao || <span className="text-muted-foreground italic">Não identificado</span>}
            </p>
            {item.fornecedor_razao && item.fornecedor_nome_fantasia && (
              <p className="text-xs text-muted-foreground truncate max-w-[200px]">{item.fornecedor_razao}</p>
            )}
            {item.fornecedor_cnpj && (
              <p className="text-xs text-muted-foreground font-mono">{item.fornecedor_cnpj}</p>
            )}
          </div>
        </div>
      ),
    },
    {
      key: "qtd_itens",
      header: "Itens",
      className: "min-w-[100px]",
      render: (item: NotaEntrada) => {
        const total = item.qtd_itens ?? 0;
        const vinc = item.qtd_itens_vinculados ?? 0;
        const pendItens = total - vinc;
        return (
          <div className="flex items-center gap-1.5">
            <Package className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-sm font-medium">{total}</span>
            {total > 0 && pendItens > 0 && (
              <Badge variant="outline" className="text-xs px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-200">
                {pendItens} p/ vincular
              </Badge>
            )}
            {total > 0 && pendItens === 0 && (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            )}
          </div>
        );
      },
    },
    {
      key: "total_nota",
      header: "Total NF-e",
      sortable: true,
      className: "min-w-[120px]",
      render: (item: NotaEntrada) => (
        <div className="text-right">
          <p className="font-semibold text-sm">{formatCurrency(item.total_nota)}</p>
          {item.total_produtos !== item.total_nota && (
            <p className="text-xs text-muted-foreground">Produtos: {formatCurrency(item.total_produtos)}</p>
          )}
        </div>
      ),
    },
    {
      key: "vencimento",
      header: "Vencimento",
      className: "min-w-[110px]",
      render: (item: NotaEntrada) => {
        if (!item.vencimento) return <span className="text-muted-foreground text-xs">—</span>;
        const venc = new Date(item.vencimento);
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const diasRestantes = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
        return (
          <div>
            <p className={cn("text-sm font-medium", diasRestantes < 0 ? "text-red-600" : diasRestantes <= 7 ? "text-amber-600" : "")}>
              {formatDate(item.vencimento)}
            </p>
            {item.total_parcelas > 1 && (
              <p className="text-xs text-muted-foreground">{item.total_parcelas} parcelas</p>
            )}
          </div>
        );
      },
    },
    {
      key: "status_financeiro",
      header: "Financeiro",
      className: "min-w-[110px]",
      render: (item: NotaEntrada) => {
        const cfg = STATUS_FIN_CONFIG[item.status_financeiro ?? "SEM_DUPLICATA"];
        return (
          <Badge variant="outline" className={cn("gap-1 text-xs font-medium", cfg.color)}>
            {cfg.icon}
            {cfg.label}
          </Badge>
        );
      },
    },
    {
      key: "status_importacao",
      header: "NF-e",
      className: "min-w-[100px]",
      render: (item: NotaEntrada) => (
        <StatusBadge variant={STATUS_VARIANTS[item.status]}>
          {item.status}
        </StatusBadge>
      ),
    },
    {
      key: "acoes",
      header: "Ações",
      className: "min-w-[120px] w-auto",
      render: (item: NotaEntrada) => (
        <NotaEntradaAcoesCell
          item={item}
          processandoId={processando}
          revertendoId={reverting}
          onView={handleViewNota}
          onProcessar={handleProcessarNota}
          onReverter={handleReverter}
          onImportarCoa={handleImportarCoa}
          onRefresh={handleRefreshNotas}
        />
      ),
    },
  ], [processando, reverting, handleViewNota, handleProcessarNota, handleReverter, handleImportarCoa, handleRefreshNotas]);

  const periodoLabel: Record<PeriodoFiltro, string> = {
    todos: "Todos os períodos",
    mes: "Este mês",
    trimestre: "Últimos 3 meses",
    ano: "Este ano",
  };

  const statusFinLabel: Record<StatusFinFiltro, string> = {
    todos: "Todos os status",
    PAGO: "Pago",
    PENDENTE: "Pendente",
    VENCIDO: "Vencido",
    SEM_DUPLICATA: "Sem duplicata",
  };

  return (
    <div className="p-2 sm:p-3 max-w-full mx-auto space-y-2 h-screen flex flex-col">
      <div className="flex items-center justify-between gap-2">
        <BackButton />
        <PageHeader
          title="Notas de Entrada"
          description="Histórico de notas fiscais de compra importadas"
          icon={FileText}
          actions={
            <Button onClick={() => navigate("/compras/importar-nfe")}>
              Importar NF-e
            </Button>
          }
        />
      </div>

      {/* ── KPIs ─────────────────────────────────────────────── */}
      {!isLoading && notas.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Total importado no mês"
            value={formatCurrency(kpis.totalMes)}
            sub={`${kpis.qtdMes} nota(s)`}
            color="bg-blue-100 text-blue-700"
          />
          <KpiCard
            icon={<Clock className="h-4 w-4" />}
            label="A pagar (pendente)"
            value={formatCurrency(kpis.totalPendente)}
            sub="todas as notas"
            color="bg-amber-100 text-amber-700"
          />
          <KpiCard
            icon={<AlertTriangle className="h-4 w-4" />}
            label="Notas vencidas"
            value={String(kpis.vencidas)}
            sub="pagamento em atraso"
            color={kpis.vencidas > 0 ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-500"}
          />
          <KpiCard
            icon={<Package className="h-4 w-4" />}
            label="Itens p/ vincular"
            value={String(kpis.naoVinculadas)}
            sub="notas com itens pendentes"
            color={kpis.naoVinculadas > 0 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-500"}
          />
        </div>
      )}

      {/* ── Filtros ───────────────────────────────────────────── */}
      {!isLoading && notas.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Input
              placeholder="Buscar por número, fornecedor, CNPJ ou chave..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
            <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {periodoLabel[periodo]}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Período de emissão</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(periodoLabel) as PeriodoFiltro[]).map((p) => (
                <DropdownMenuItem key={p} onClick={() => setPeriodo(p)} className={cn(periodo === p && "font-semibold")}>
                  {periodoLabel[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                {statusFinLabel[statusFinFiltro]}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Status financeiro</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {(Object.keys(statusFinLabel) as StatusFinFiltro[]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => setStatusFinFiltro(s)} className={cn(statusFinFiltro === s && "font-semibold")}>
                  {statusFinLabel[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {(periodo !== "todos" || statusFinFiltro !== "todos" || search) && (
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => { setPeriodo("todos"); setStatusFinFiltro("todos"); setSearch(""); }}>
              Limpar filtros
            </Button>
          )}

          <span className="text-xs text-muted-foreground ml-auto">
            {notasFiltradas.length} nota(s)
          </span>
        </div>
      )}

      {/* ── Tabela ────────────────────────────────────────────── */}
      {notas.length === 0 && !isLoading ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma Nota Importada</h3>
            <p className="text-muted-foreground mb-4">Importe notas fiscais XML na seção "Importar NF-e" para visualizá-las aqui.</p>
            <Button onClick={() => navigate("/compras/importar-nfe")}>Importar NF-e</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="flex-1 overflow-x-auto border rounded-lg">
          <DataTable
            data={notasFiltradas}
            columns={columns}
            loading={isLoading}
            searchable={false}
            onRowClick={(item) => handleViewNota(item)}
            emptyMessage="Nenhuma nota encontrada para os filtros selecionados"
            pageSize={50}
          />
        </div>
      )}

      <NFeVisualizacaoDialog open={showNFeDialog} onOpenChange={setShowNFeDialog} chaveNfe={selectedChaveNfe} />

      {coaImportNota && (
        <ImportarCoaNotaDialog
          key={coaImportNota.id}
          notaId={coaImportNota.id}
          notaNumero={coaImportNota.numero}
          open={coaDialogOpen}
          onOpenChange={handleCoaDialogOpenChange}
          onDone={() => {
            handleRefreshNotas();
            setCoaDialogOpen(false);
            setCoaImportNota(null);
          }}
        />
      )}
    </div>
  );
}
