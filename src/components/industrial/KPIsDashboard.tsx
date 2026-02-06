import { 
  TrendingUp, 
  TrendingDown,
  Activity,
  Shield,
  Factory,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useKPIsExecutivos } from '@/hooks/use-alertas-executivos';
import { cn } from '@/lib/utils';

interface KPICardProps {
  titulo: string;
  valor: string | number;
  subtitulo?: string;
  icon: React.ElementType;
  tendencia?: 'up' | 'down' | 'stable';
  destaque?: 'success' | 'warning' | 'danger';
}

function KPICard({ titulo, valor, subtitulo, icon: Icon, tendencia, destaque }: KPICardProps) {
  return (
    <Card className={cn(
      destaque === 'danger' && 'border-destructive',
      destaque === 'warning' && 'border-yellow-500',
      destaque === 'success' && 'border-green-500'
    )}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">{titulo}</p>
            <p className="text-2xl font-bold mt-1">{valor}</p>
            {subtitulo && (
              <p className="text-xs text-muted-foreground mt-1">{subtitulo}</p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <Icon className={cn(
              'h-5 w-5',
              destaque === 'danger' && 'text-destructive',
              destaque === 'warning' && 'text-yellow-500',
              destaque === 'success' && 'text-green-500',
              !destaque && 'text-primary'
            )} />
            {tendencia && (
              tendencia === 'up' ? (
                <TrendingUp className="h-3 w-3 text-green-500" />
              ) : tendencia === 'down' ? (
                <TrendingDown className="h-3 w-3 text-destructive" />
              ) : null
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KPIsDashboard() {
  const { kpis, loading, gerarKPIsDiarios } = useKPIsExecutivos();

  if (loading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
          <Card key={i}>
            <CardContent className="pt-4">
              <div className="animate-pulse space-y-2">
                <div className="h-3 bg-muted rounded w-2/3" />
                <div className="h-6 bg-muted rounded w-1/2" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Se não há KPIs, gerar
  if (!kpis) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground mb-4">
            KPIs do dia ainda não foram gerados
          </p>
          <button
            onClick={gerarKPIsDiarios}
            className="text-sm text-primary hover:underline"
          >
            Gerar KPIs agora
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">
          KPIs - {new Date(kpis.data_referencia).toLocaleDateString('pt-BR')}
        </h3>
        <button
          onClick={gerarKPIsDiarios}
          className="text-xs text-primary hover:underline"
        >
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Produção */}
        <KPICard
          titulo="OPs Finalizadas"
          valor={kpis.ops_finalizadas}
          icon={Factory}
          destaque={kpis.ops_bloqueadas > 0 ? 'warning' : undefined}
          subtitulo={kpis.ops_bloqueadas > 0 ? `${kpis.ops_bloqueadas} bloqueadas` : undefined}
        />

        <KPICard
          titulo="Rendimento Médio"
          valor={`${kpis.rendimento_medio_percent.toFixed(1)}%`}
          icon={Activity}
          destaque={
            kpis.rendimento_medio_percent < 90 ? 'danger' :
            kpis.rendimento_medio_percent < 95 ? 'warning' : 'success'
          }
        />

        {/* Qualidade */}
        <KPICard
          titulo="Taxa Aprovação QC"
          valor={`${kpis.taxa_aprovacao_qc.toFixed(1)}%`}
          icon={CheckCircle2}
          destaque={kpis.taxa_aprovacao_qc >= 98 ? 'success' : kpis.taxa_aprovacao_qc >= 95 ? undefined : 'warning'}
        />

        <KPICard
          titulo="Anomalias"
          valor={kpis.total_anomalias}
          icon={AlertTriangle}
          destaque={kpis.anomalias_criticas > 0 ? 'danger' : kpis.total_anomalias > 5 ? 'warning' : undefined}
          subtitulo={kpis.anomalias_criticas > 0 ? `${kpis.anomalias_criticas} críticas` : undefined}
        />

        {/* Fornecedores */}
        <KPICard
          titulo="Fornecedores Risco"
          valor={kpis.fornecedores_risco}
          icon={AlertTriangle}
          destaque={kpis.fornecedores_risco > 0 ? 'warning' : 'success'}
        />

        <KPICard
          titulo="Não Conformidades"
          valor={kpis.nao_conformidades}
          icon={Shield}
          destaque={kpis.nao_conformidades > 3 ? 'danger' : kpis.nao_conformidades > 0 ? 'warning' : 'success'}
        />

        {/* Financeiro */}
        <KPICard
          titulo="Margem Média"
          valor={`${kpis.margem_media_percent.toFixed(1)}%`}
          icon={DollarSign}
          destaque={
            kpis.margem_media_percent < 15 ? 'danger' :
            kpis.margem_media_percent < 20 ? 'warning' : 'success'
          }
        />

        {/* Compliance */}
        <KPICard
          titulo="Bloqueios ANVISA"
          valor={kpis.validacoes_bloqueio}
          icon={Shield}
          destaque={kpis.validacoes_bloqueio > 0 ? 'danger' : 'success'}
          subtitulo={kpis.alertas_regulatorios > 0 ? `${kpis.alertas_regulatorios} alertas` : undefined}
        />
      </div>
    </div>
  );
}
