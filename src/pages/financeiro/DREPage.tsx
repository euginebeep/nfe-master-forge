import { useMemo } from "react";
import { PieChart, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SkeletonCards } from "@/components/ui/skeleton-cards";
import { useUserCompanyId } from "@/hooks/use-user-company";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
} from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DRELinha {
  label: string;
  valor: number;
  tipo: "receita" | "deducao" | "custo" | "despesa" | "resultado";
  indent?: boolean;
}

export default function DREPage() {
  const { data: companyId } = useUserCompanyId();

  const { data: contasReceber = [], isLoading: l1 } = useQuery({
    queryKey: ["dre-receber", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contas_receber")
        .select("valor, valor_pago, status, data_emissao")
        .eq("company_id", companyId!)
        .limit(1000);
      return data || [];
    },
  });

  const { data: notasEntrada = [], isLoading: l2 } = useQuery({
    queryKey: ["dre-notas", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notas_entrada")
        .select("total_nota, total_produtos, dh_emissao")
        .eq("company_id", companyId!)
        .limit(1000);
      return data || [];
    },
  });

  const { data: custosOP = [], isLoading: l3 } = useQuery({
    queryKey: ["dre-custos-op", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("custos_op")
        .select("custo_total_real, custo_mao_obra, custo_overhead, custo_embalagem, custo_materia_prima_real, created_at")
        .limit(500);
      return data || [];
    },
  });

  const { data: impostos = [], isLoading: l4 } = useQuery({
    queryKey: ["dre-impostos", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("contas_pagar")
        .select("valor, valor_pago, status, categoria, data_emissao")
        .eq("company_id", companyId!)
        .in("categoria", ["IMPOSTO", "TRIBUTO"]);
      return data || [];
    },
  });

  const isLoading = l1 || l2 || l3 || l4;

  const dre = useMemo(() => {
    const receitaBruta = contasReceber
      .filter((c) => c.status === "PAGO")
      .reduce((a, c) => a + Number(c.valor_pago || 0), 0);

    const impostosSobreVenda = impostos.reduce(
      (a, c) => a + Number(c.valor || 0),
      0
    );

    const receitaLiquida = receitaBruta - impostosSobreVenda;

    const custoMP = custosOP.reduce(
      (a, c) => a + Number(c.custo_materia_prima_real || 0),
      0
    );
    const custoMO = custosOP.reduce(
      (a, c) => a + Number(c.custo_mao_obra || 0),
      0
    );
    const custoEmbalagem = custosOP.reduce(
      (a, c) => a + Number(c.custo_embalagem || 0),
      0
    );
    const custoOverhead = custosOP.reduce(
      (a, c) => a + Number(c.custo_overhead || 0),
      0
    );

    const cpv = custoMP + custoMO + custoEmbalagem;
    const lucroBruto = receitaLiquida - cpv;
    const despesasOp = custoOverhead;
    const resultadoOperacional = lucroBruto - despesasOp;

    const linhas: DRELinha[] = [
      { label: "Receita Bruta de Vendas", valor: receitaBruta, tipo: "receita" },
      { label: "(-) Impostos sobre Vendas", valor: -impostosSobreVenda, tipo: "deducao", indent: true },
      { label: "= Receita Líquida", valor: receitaLiquida, tipo: "resultado" },
      { label: "(-) Custo Matéria-Prima", valor: -custoMP, tipo: "custo", indent: true },
      { label: "(-) Custo Mão de Obra", valor: -custoMO, tipo: "custo", indent: true },
      { label: "(-) Custo Embalagem", valor: -custoEmbalagem, tipo: "custo", indent: true },
      { label: "= Lucro Bruto", valor: lucroBruto, tipo: "resultado" },
      { label: "(-) Despesas Operacionais (Overhead)", valor: -despesasOp, tipo: "despesa", indent: true },
      { label: "= Resultado Operacional", valor: resultadoOperacional, tipo: "resultado" },
    ];

    return {
      linhas,
      receitaBruta,
      cpv,
      lucroBruto,
      resultadoOperacional,
      margemBruta: receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0,
      margemOperacional: receitaBruta > 0 ? (resultadoOperacional / receitaBruta) * 100 : 0,
      composicaoCustos: [
        { name: "Matéria-Prima", value: custoMP },
        { name: "Mão de Obra", value: custoMO },
        { name: "Embalagem", value: custoEmbalagem },
        { name: "Overhead", value: custoOverhead },
      ].filter((c) => c.value > 0),
    };
  }, [contasReceber, custosOP, impostos]);

  const fmtMoeda = (v: number) =>
    `R$ ${Math.abs(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const COLORS = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
  ];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="DRE Gerencial" description="Demonstrativo de Resultado do Exercício" icon={PieChart} />
        <SkeletonCards count={4} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="DRE Gerencial"
        description="Demonstrativo de Resultado do Exercício — Visão consolidada"
        icon={PieChart}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase">Receita Bruta</p>
            </div>
            <p className="text-xl font-bold">{fmtMoeda(dre.receitaBruta)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
              <p className="text-xs text-muted-foreground uppercase">Lucro Bruto</p>
            </div>
            <p className={`text-xl font-bold ${dre.lucroBruto >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {fmtMoeda(dre.lucroBruto)}
            </p>
            <p className="text-xs text-muted-foreground">Margem: {dre.margemBruta.toFixed(1)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              <p className="text-xs text-muted-foreground uppercase">CPV Total</p>
            </div>
            <p className="text-xl font-bold text-destructive">{fmtMoeda(dre.cpv)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <PieChart className="h-4 w-4 text-blue-500" />
              <p className="text-xs text-muted-foreground uppercase">Resultado</p>
            </div>
            <p className={`text-xl font-bold ${dre.resultadoOperacional >= 0 ? "text-emerald-600" : "text-destructive"}`}>
              {fmtMoeda(dre.resultadoOperacional)}
            </p>
            <p className="text-xs text-muted-foreground">Margem Op.: {dre.margemOperacional.toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* DRE Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Demonstrativo de Resultado</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Conta</TableHead>
                  <TableHead className="text-right">Valor (R$)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dre.linhas.map((linha, i) => (
                  <TableRow
                    key={i}
                    className={
                      linha.tipo === "resultado"
                        ? "font-bold bg-muted/50"
                        : ""
                    }
                  >
                    <TableCell className={linha.indent ? "pl-8" : ""}>
                      {linha.label}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono ${
                        linha.valor < 0 ? "text-destructive" : ""
                      } ${linha.tipo === "resultado" ? "font-bold" : ""}`}
                    >
                      {linha.valor < 0 ? `(${fmtMoeda(linha.valor)})` : fmtMoeda(linha.valor)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-xs text-muted-foreground mt-3 italic">
              * Impostos baseados em contas a pagar com categoria IMPOSTO/TRIBUTO.
              Para precisão contábil, classifique suas contas corretamente.
            </p>
          </CardContent>
        </Card>

        {/* Pie Chart - Composição de Custos */}
        <Card>
          <CardHeader>
            <CardTitle>Composição de Custos</CardTitle>
          </CardHeader>
          <CardContent>
            {dre.composicaoCustos.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RePieChart>
                  <Pie
                    data={dre.composicaoCustos}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {dre.composicaoCustos.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => fmtMoeda(value)} />
                </RePieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">Sem dados de custo</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
