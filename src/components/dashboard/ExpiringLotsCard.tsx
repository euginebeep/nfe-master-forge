import { useState, useMemo } from "react";
import { AlertTriangle, Calendar, Package, ChevronRight, Filter } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import { LocalDb } from "@/lib/local-db";
import { LocalEstoqueLote, LocalItem } from "@/hooks/use-local-itens";
import { format, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

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
  categoria: 'CRITICO' | 'URGENTE' | 'ATENCAO';
}

/**
 * Card de alerta de lotes próximos do vencimento
 * Mostra lotes que vencem em 30, 60 ou 90 dias
 */
export function ExpiringLotsCard() {
  const navigate = useNavigate();
  const [showFullList, setShowFullList] = useState(false);
  const [filterDays, setFilterDays] = useState<number>(90);

  // Buscar lotes e itens
  const expiringLots = useMemo(() => {
    const lotes = LocalDb.getCollection<LocalEstoqueLote>('estoque_lotes');
    const itens = LocalDb.getCollection<LocalItem>('itens');
    const today = new Date();

    const expiring: ExpiringLot[] = [];

    lotes.forEach(lote => {
      if (!lote.data_val || lote.status === 'VENCIDO') return;

      const dataVal = parseISO(lote.data_val);
      const diasParaVencer = differenceInDays(dataVal, today);

      // Só inclui se ainda não venceu e está dentro do período de alerta
      if (diasParaVencer >= 0 && diasParaVencer <= 90) {
        const item = itens.find(i => i.id === lote.item_id);
        
        let categoria: 'CRITICO' | 'URGENTE' | 'ATENCAO' = 'ATENCAO';
        if (diasParaVencer <= 30) categoria = 'CRITICO';
        else if (diasParaVencer <= 60) categoria = 'URGENTE';

        expiring.push({
          id: lote.id,
          item_id: lote.item_id,
          item_descricao: item?.descricao_interna || 'Item não encontrado',
          item_sku: item?.sku_interno || '-',
          numero_lote: lote.numero_lote,
          data_val: lote.data_val,
          dias_para_vencer: diasParaVencer,
          quantidade_interna: lote.quantidade_interna,
          unidade_interna: item?.unidade_interna || 'un',
          status: lote.status,
          categoria,
        });
      }
    });

    // Ordenar por dias para vencer (mais urgente primeiro)
    return expiring.sort((a, b) => a.dias_para_vencer - b.dias_para_vencer);
  }, []);

  const filteredLots = useMemo(() => {
    return expiringLots.filter(l => l.dias_para_vencer <= filterDays);
  }, [expiringLots, filterDays]);

  const stats = useMemo(() => ({
    critico: expiringLots.filter(l => l.categoria === 'CRITICO').length,
    urgente: expiringLots.filter(l => l.categoria === 'URGENTE').length,
    atencao: expiringLots.filter(l => l.categoria === 'ATENCAO').length,
    total: expiringLots.length,
  }), [expiringLots]);

  const getCategoryColor = (categoria: string) => {
    switch (categoria) {
      case 'CRITICO': return 'bg-destructive text-destructive-foreground';
      case 'URGENTE': return 'bg-warning text-warning-foreground';
      case 'ATENCAO': return 'bg-accent text-accent-foreground';
      default: return 'bg-muted';
    }
  };

  const getCategoryBorderColor = (categoria: string) => {
    switch (categoria) {
      case 'CRITICO': return 'border-l-destructive';
      case 'URGENTE': return 'border-l-warning';
      case 'ATENCAO': return 'border-l-accent';
      default: return 'border-l-muted';
    }
  };

  if (stats.total === 0) {
    return (
      <Card className="border-2 border-emerald-500/30 bg-gradient-to-br from-emerald-500/5 to-background">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg text-emerald-600 dark:text-emerald-400">
            <div className="p-2 rounded-lg bg-emerald-500/10">
              <Package className="h-5 w-5" />
            </div>
            Validades OK
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum lote próximo do vencimento nos próximos 90 dias.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className={`border-2 ${stats.critico > 0 ? 'border-destructive/50 bg-gradient-to-br from-destructive/5 to-background' : stats.urgente > 0 ? 'border-warning/50 bg-gradient-to-br from-warning/5 to-background' : 'border-accent/50 bg-gradient-to-br from-accent/5 to-background'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-lg">
              <motion.div 
                className={`p-2 rounded-lg ${stats.critico > 0 ? 'bg-destructive/10' : 'bg-warning/10'}`}
                animate={{ scale: stats.critico > 0 ? [1, 1.1, 1] : 1 }}
                transition={{ repeat: stats.critico > 0 ? Infinity : 0, duration: 2 }}
              >
                <AlertTriangle className={`h-5 w-5 ${stats.critico > 0 ? 'text-destructive' : 'text-warning'}`} />
              </motion.div>
              <span>Lotes a Vencer</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowFullList(true)}>
              Ver Todos
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className={`p-3 rounded-lg text-center ${stats.critico > 0 ? 'bg-destructive/10' : 'bg-muted/50'}`}>
              <p className="text-2xl font-bold text-destructive">{stats.critico}</p>
              <p className="text-xs text-muted-foreground">≤30 dias</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${stats.urgente > 0 ? 'bg-warning/10' : 'bg-muted/50'}`}>
              <p className="text-2xl font-bold text-warning">{stats.urgente}</p>
              <p className="text-xs text-muted-foreground">31-60 dias</p>
            </div>
            <div className={`p-3 rounded-lg text-center ${stats.atencao > 0 ? 'bg-accent/10' : 'bg-muted/50'}`}>
              <p className="text-2xl font-bold text-accent-foreground">{stats.atencao}</p>
              <p className="text-xs text-muted-foreground">61-90 dias</p>
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
                  className={`p-3 rounded-lg border-l-4 bg-card cursor-pointer hover:bg-muted/50 transition-colors ${getCategoryBorderColor(lot.categoria)}`}
                  onClick={() => navigate(`/cadastros/itens/${lot.item_id}`)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-sm">{lot.item_descricao}</p>
                      <p className="text-xs text-muted-foreground">Lote: {lot.numero_lote}</p>
                    </div>
                    <Badge className={getCategoryColor(lot.categoria)}>
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
              <span className="text-sm text-muted-foreground">
                {filteredLots.length} lote(s) encontrado(s)
              </span>
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
                      {row.quantidade_interna.toLocaleString('pt-BR')} {row.unidade_interna.toUpperCase()}
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
                    <Badge className={getCategoryColor(row.categoria)}>
                      {row.dias_para_vencer} dias
                    </Badge>
                  ),
                },
                {
                  key: "status",
                  header: "Status",
                  render: (row) => (
                    <Badge variant={row.status === 'DISPONIVEL' ? 'default' : 'secondary'}>
                      {row.status}
                    </Badge>
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
