import { BarChart3, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FluxoCaixaPage() {
  // Placeholder data
  const resumo = {
    saldoAtual: 125000,
    entradas: 85000,
    saidas: 62000,
    previsao: 148000,
  };

  return (
    <div>
      <PageHeader
        title="Fluxo de Caixa"
        description="Visao consolidada de entradas e saidas"
        icon={BarChart3}
      />

      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase">Saldo Atual</p>
            </div>
            <p className="text-2xl font-bold">
              R$ {resumo.saldoAtual.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-success" />
              <p className="text-xs text-muted-foreground uppercase">Entradas (Mes)</p>
            </div>
            <p className="text-2xl font-bold text-success">
              R$ {resumo.entradas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground uppercase">Saidas (Mes)</p>
            </div>
            <p className="text-2xl font-bold text-destructive">
              R$ {resumo.saidas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-4 w-4 text-info" />
              <p className="text-xs text-muted-foreground uppercase">Previsao 30d</p>
            </div>
            <p className="text-2xl font-bold text-info">
              R$ {resumo.previsao.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grafico de Fluxo</CardTitle>
        </CardHeader>
        <CardContent className="h-80 flex items-center justify-center">
          <p className="text-muted-foreground">Grafico de fluxo de caixa sera exibido aqui</p>
        </CardContent>
      </Card>
    </div>
  );
}
