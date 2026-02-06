import { PageHeader } from '@/components/ui/page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  BarChart3, 
  AlertTriangle, 
  Star, 
  Lightbulb,
  TrendingUp,
  Activity,
  Shield,
} from 'lucide-react';

import { KPIsDashboard } from '@/components/industrial/KPIsDashboard';
import { AlertasExecutivosPanel } from '@/components/industrial/AlertasExecutivosPanel';
import { RankingFornecedoresPanel } from '@/components/industrial/RankingFornecedoresPanel';
import { SugestoesOtimizacaoPanel } from '@/components/industrial/SugestoesOtimizacaoPanel';
import { PrevisoesDemandaPanel } from '@/components/industrial/PrevisoesDemandaPanel';
import { AnomaliasOperacionaisPanel } from '@/components/industrial/AnomaliasOperacionaisPanel';

export default function DashboardExecutivoPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard Executivo"
        description="Visão consolidada de KPIs, alertas, fornecedores e otimizações"
        icon={BarChart3}
      />

      {/* KPIs no topo */}
      <KPIsDashboard />

      {/* Alertas críticos */}
      <AlertasExecutivosPanel />

      {/* Tabs com módulos avançados */}
      <Tabs defaultValue="previsoes" className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full">
          <TabsTrigger value="previsoes" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">Previsões</span>
          </TabsTrigger>
          <TabsTrigger value="anomalias" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            <span className="hidden sm:inline">Anomalias</span>
          </TabsTrigger>
          <TabsTrigger value="fornecedores" className="flex items-center gap-2">
            <Star className="h-4 w-4" />
            <span className="hidden sm:inline">Fornecedores</span>
          </TabsTrigger>
          <TabsTrigger value="otimizacao" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4" />
            <span className="hidden sm:inline">Otimização</span>
          </TabsTrigger>
          <TabsTrigger value="governanca" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            <span className="hidden sm:inline">Governança</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="previsoes">
          <PrevisoesDemandaPanel />
        </TabsContent>

        <TabsContent value="anomalias">
          <AnomaliasOperacionaisPanel />
        </TabsContent>

        <TabsContent value="fornecedores">
          <RankingFornecedoresPanel />
        </TabsContent>

        <TabsContent value="otimizacao">
          <SugestoesOtimizacaoPanel />
        </TabsContent>

        <TabsContent value="governanca">
          <GovernancaPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Panel de Governança inline
import { useTrilhaAuditoria } from '@/hooks/use-governanca';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, User, Clock, ArrowRight } from 'lucide-react';

function GovernancaPanel() {
  const { registros, loading } = useTrilhaAuditoria();

  if (loading) {
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

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          Trilha de Auditoria Técnica
        </CardTitle>
      </CardHeader>
      <CardContent>
        {registros.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm">Nenhum registro de auditoria</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {registros.slice(0, 20).map(registro => (
              <div
                key={registro.id}
                className="p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-xs">
                      {registro.acao}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">
                        {registro.entidade_tipo}: {registro.entidade_codigo || registro.entidade_id.slice(0, 8)}
                      </p>
                      {registro.diff_resumo && (
                        <p className="text-xs text-muted-foreground">
                          {registro.diff_resumo}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(registro.timestamp).toLocaleString('pt-BR')}
                    </div>
                    {registro.usuario_nome && (
                      <div className="flex items-center gap-1 justify-end">
                        <User className="h-3 w-3" />
                        {registro.usuario_nome}
                      </div>
                    )}
                  </div>
                </div>
                
                {registro.motivo && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Motivo: {registro.motivo}
                  </p>
                )}
                
                {registro.hash_integridade && (
                  <p className="text-xs text-muted-foreground/50 mt-1 font-mono">
                    Hash: {registro.hash_integridade}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
