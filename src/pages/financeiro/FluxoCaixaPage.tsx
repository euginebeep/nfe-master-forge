import { useMemo } from "react";
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonCards } from "@/components/ui/skeleton-cards";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

export default function FluxoCaixaPage() {
  const { data: contasPagar = [], isLoading: loadingPagar } = useQuery({
    queryKey: ['fluxo-contas-pagar'],
    queryFn: async () => {
      // contas_pagar may not exist yet in types, use raw query
      const { data } = await supabase
        .from('notas_entrada')
        .select('total_nota, dh_emissao, status')
        .limit(500);
      return data || [];
    },
  });

  const { data: contasReceber = [], isLoading: loadingReceber } = useQuery({
    queryKey: ['fluxo-contas-receber'],
    queryFn: async () => {
      const { data } = await supabase
        .from('contas_receber')
        .select('valor, valor_pago, status, data_vencimento')
        .limit(500);
      return data || [];
    },
  });

  const { data: notasEntrada = [] } = useQuery({
    queryKey: ['fluxo-notas-entrada'],
    queryFn: async () => {
      const { data } = await supabase
        .from('notas_entrada')
        .select('total_nota, dh_emissao')
        .limit(500);
      return data || [];
    },
  });

  const isLoading = loadingPagar || loadingReceber;

  const resumo = useMemo(() => {
    const entradas = contasReceber
      .filter((c: Record<string, unknown>) => c.status === 'PAGO')
      .reduce((a: number, c: Record<string, unknown>) => a + Number(c.valor_pago || 0), 0);
    const saidas = notasEntrada
      .reduce((a: number, c: Record<string, unknown>) => a + Number(c.total_nota || 0), 0);
    const aReceber = contasReceber
      .filter((c: Record<string, unknown>) => c.status !== 'PAGO' && c.status !== 'CANCELADO')
      .reduce((a: number, c: Record<string, unknown>) => a + Number(c.valor || 0) - Number(c.valor_pago || 0), 0);

    return {
      saldoAtual: entradas - saidas,
      entradas,
      saidas,
      previsao: entradas - saidas + aReceber,
    };
  }, [contasReceber, notasEntrada]);

  // Build monthly chart data
  const chartData = useMemo(() => {
    const months: Record<string, { entradas: number; saidas: number }> = {};
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      months[key] = { entradas: 0, saidas: 0 };
    }

    contasReceber.forEach((c: Record<string, unknown>) => {
      if (c.status === 'PAGO' && c.data_vencimento) {
        const key = String(c.data_vencimento).slice(0, 7);
        if (months[key]) months[key].entradas += Number(c.valor_pago || 0);
      }
    });

    notasEntrada.forEach((n: Record<string, unknown>) => {
      if (n.dh_emissao) {
        const key = String(n.dh_emissao).slice(0, 7);
        if (months[key]) months[key].saidas += Number(n.total_nota || 0);
      }
    });

    return Object.entries(months).map(([mes, vals]) => ({
      mes: mes.split('-').reverse().join('/'),
      Entradas: Math.round(vals.entradas),
      Saídas: Math.round(vals.saidas),
    }));
  }, [contasReceber, notasEntrada]);

  const fmtMoeda = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Fluxo de Caixa" description="Visão consolidada de entradas e saídas" icon={BarChart3} />
        <SkeletonCards count={4} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Fluxo de Caixa" description="Visão consolidada de entradas e saídas" icon={BarChart3} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground uppercase">Saldo Atual</p>
          </div>
          <p className="text-xl font-bold">{fmtMoeda(resumo.saldoAtual)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-emerald-500" />
            <p className="text-xs text-muted-foreground uppercase">Entradas</p>
          </div>
          <p className="text-xl font-bold text-emerald-600">{fmtMoeda(resumo.entradas)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <p className="text-xs text-muted-foreground uppercase">Saídas</p>
          </div>
          <p className="text-xl font-bold text-destructive">{fmtMoeda(resumo.saidas)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            <p className="text-xs text-muted-foreground uppercase">Previsão 30d</p>
          </div>
          <p className="text-xl font-bold text-blue-600">{fmtMoeda(resumo.previsao)}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fluxo Mensal (Últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis dataKey="mes" className="text-xs" />
              <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} className="text-xs" />
              <Tooltip formatter={(value: number) => fmtMoeda(value)} />
              <Legend />
              <Bar dataKey="Entradas" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saídas" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
