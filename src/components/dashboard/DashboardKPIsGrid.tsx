import {
  Users, Package, Boxes, Factory, FileText, FlaskConical,
  AlertTriangle, Clock,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { useDashboardKPIs } from '@/hooks/use-dashboard-kpis';
import { Skeleton } from '@/components/ui/skeleton';

export function DashboardKPIsGrid() {
  const { data: kpis, isLoading } = useDashboardKPIs();

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="py-4">
              <Skeleton className="h-4 w-20 mb-2" />
              <Skeleton className="h-6 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!kpis) return null;

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <StatCard label="Entidades" value={kpis.totalEntidades} icon={Users} />
      <StatCard label="Itens Ativos" value={kpis.totalItens} icon={Package} />
      <StatCard
        label="Lotes em Estoque"
        value={kpis.totalLotes}
        icon={Boxes}
        variant={kpis.totalLotes > 0 ? 'success' : 'default'}
      />
      <StatCard
        label="Lotes Vencendo (30d)"
        value={kpis.lotesVencendo30d}
        icon={AlertTriangle}
        variant={kpis.lotesVencendo30d > 0 ? 'warning' : 'success'}
      />
      <StatCard
        label="Quarentena"
        value={kpis.lotesQuarentena}
        icon={Clock}
        variant={kpis.lotesQuarentena > 5 ? 'warning' : 'default'}
      />
      <StatCard label="Fórmulas" value={kpis.totalFormulas} icon={FlaskConical} />
      <StatCard
        label="OPs em Andamento"
        value={kpis.opsEmAndamento}
        icon={Factory}
        variant={kpis.opsEmAndamento > 0 ? 'default' : 'success'}
      />
      <StatCard
        label="Notas de Entrada"
        value={formatCurrency(kpis.valorTotalNotas)}
        icon={FileText}
        suffix={`(${kpis.totalNotasEntrada})`}
      />
    </div>
  );
}
