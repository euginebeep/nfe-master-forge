import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { CustoOP, CustoOPLote } from '@/types/custo-industrial';
import { 
  DollarSign, 
  Package, 
  Users, 
  Building2, 
  TrendingDown,
  Receipt,
  Lock,
  Unlock,
} from 'lucide-react';

interface CustoOPDashboardProps {
  custo: CustoOP;
  lotesConsumidos: CustoOPLote[];
}

export function CustoOPDashboard({ custo, lotesConsumidos }: CustoOPDashboardProps) {
  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const percentualMP = custo.custo_total_real > 0 
    ? (custo.custo_materia_prima_real / custo.custo_total_real) * 100 
    : 0;

  const percentualMO = custo.custo_total_real > 0 
    ? (custo.custo_mao_obra / custo.custo_total_real) * 100 
    : 0;

  const percentualOverhead = custo.custo_total_real > 0 
    ? (custo.custo_overhead / custo.custo_total_real) * 100 
    : 0;

  const percentualPerdas = custo.custo_total_real > 0 
    ? (custo.custo_perdas / custo.custo_total_real) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header com Status */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Custo Real Industrial</h2>
          <p className="text-sm text-muted-foreground">OP: {custo.op_codigo}</p>
        </div>
        <Badge 
          variant={custo.status === 'FECHADO' ? 'default' : 'secondary'}
          className="flex items-center gap-1"
        >
          {custo.status === 'FECHADO' ? <Lock className="h-3 w-3" /> : <Unlock className="h-3 w-3" />}
          {custo.status}
        </Badge>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Custo Total</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(custo.custo_total_real)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Custo Unitário</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(custo.custo_unitario_real)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Produzido</span>
            </div>
            <p className="text-2xl font-bold mt-1">{custo.quantidade_produzida.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Perdas</span>
            </div>
            <p className="text-2xl font-bold mt-1">{custo.quantidade_perdas.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Composição do Custo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Composição do Custo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                Matéria-Prima
              </span>
              <span>{formatCurrency(custo.custo_materia_prima_real)} ({percentualMP.toFixed(1)}%)</span>
            </div>
            <Progress value={percentualMP} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Mão de Obra
              </span>
              <span>{formatCurrency(custo.custo_mao_obra)} ({percentualMO.toFixed(1)}%)</span>
            </div>
            <Progress value={percentualMO} className="h-2" />
          </div>

          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Overhead
              </span>
              <span>{formatCurrency(custo.custo_overhead)} ({percentualOverhead.toFixed(1)}%)</span>
            </div>
            <Progress value={percentualOverhead} className="h-2" />
          </div>

          {custo.custo_perdas > 0 && (
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="flex items-center gap-2 text-destructive">
                  <TrendingDown className="h-4 w-4" />
                  Perdas
                </span>
                <span className="text-destructive">{formatCurrency(custo.custo_perdas)} ({percentualPerdas.toFixed(1)}%)</span>
              </div>
              <Progress value={percentualPerdas} className="h-2 bg-destructive/20" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rateio de Impostos */}
      {custo.impostos_total_rateado > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Rateio de Impostos (NF-e Origem)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">ICMS</span>
                <p className="font-medium">{formatCurrency(custo.impostos_icms_rateado)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">IPI</span>
                <p className="font-medium">{formatCurrency(custo.impostos_ipi_rateado)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">PIS</span>
                <p className="font-medium">{formatCurrency(custo.impostos_pis_rateado)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">COFINS</span>
                <p className="font-medium">{formatCurrency(custo.impostos_cofins_rateado)}</p>
              </div>
            </div>
            <Separator className="my-4" />
            <div className="flex justify-between font-medium">
              <span>Total Impostos Rateados</span>
              <span>{formatCurrency(custo.impostos_total_rateado)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lotes Consumidos */}
      {lotesConsumidos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lotes Consumidos ({lotesConsumidos.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {lotesConsumidos.map(lote => (
                <div key={lote.id} className="flex justify-between items-center p-2 bg-muted/50 rounded text-sm">
                  <div>
                    <span className="font-medium">{lote.insumo_nome}</span>
                    <span className="text-muted-foreground ml-2">Lote: {lote.numero_lote}</span>
                  </div>
                  <div className="text-right">
                    <span>{lote.quantidade_consumida_g.toFixed(2)} g</span>
                    <span className="text-muted-foreground ml-2">{formatCurrency(lote.custo_total_lote)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
