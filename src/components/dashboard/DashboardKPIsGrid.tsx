import {
  Users, Package, Boxes, Factory, FileText, FlaskConical,
  AlertTriangle, CheckCircle2, Clock, TrendingUp
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardKPIs } from "@/hooks/use-dashboard-kpis";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KPIItemProps {
  label: string;
  value: number | string;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
  suffix?: string;
}

function KPIItem({ label, value, icon: Icon, variant = "default", suffix }: KPIItemProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <div className={cn(
          "p-2.5 rounded-lg",
          variant === "success" && "bg-green-500/10 text-green-600",
          variant === "warning" && "bg-yellow-500/10 text-yellow-600",
          variant === "danger" && "bg-destructive/10 text-destructive",
          variant === "default" && "bg-primary/10 text-primary",
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-xl font-bold mt-0.5">
            {typeof value === "number" ? value.toLocaleString("pt-BR") : value}
            {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

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
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      <KPIItem label="Entidades" value={kpis.totalEntidades} icon={Users} />
      <KPIItem label="Itens Ativos" value={kpis.totalItens} icon={Package} />
      <KPIItem label="Lotes em Estoque" value={kpis.lotesAprovados} icon={Boxes} variant="success" />
      <KPIItem
        label="Lotes Vencendo (30d)"
        value={kpis.lotesVencendo30d}
        icon={AlertTriangle}
        variant={kpis.lotesVencendo30d > 0 ? "warning" : "success"}
      />
      <KPIItem
        label="Quarentena"
        value={kpis.lotesQuarentena}
        icon={Clock}
        variant={kpis.lotesQuarentena > 5 ? "warning" : "default"}
      />
      <KPIItem label="Fórmulas" value={kpis.totalFormulas} icon={FlaskConical} />
      <KPIItem
        label="OPs em Andamento"
        value={kpis.opsEmAndamento}
        icon={Factory}
        variant={kpis.opsEmAndamento > 0 ? "default" : "success"}
      />
      <KPIItem
        label="Notas de Entrada"
        value={formatCurrency(kpis.valorTotalNotas)}
        icon={FileText}
        suffix={`(${kpis.totalNotasEntrada})`}
      />
    </div>
  );
}
