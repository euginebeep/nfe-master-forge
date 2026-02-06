import { Package, CheckCircle2, Clock, AlertTriangle, TrendingUp, Wallet, Layers } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, formatCurrency } from "@/lib/formatters";

interface LoteResumo {
  quantidade_interna: number;
  quantidade_original?: number;
  unidade_original?: string;
  unidade_interna?: string;
  valor_total_item?: number;
  custo_unitario_interno?: number;
  status: string;
}

interface EstoqueResumoCardProps {
  lotes: LoteResumo[];
  unidadeInternaItem?: string;
}

/**
 * Card de resumo de estoque com ícones profissionais.
 * REGRA: A unidade exibida vem do LOTE (importação NF-e), não do cadastro do item.
 * Isso garante fidelidade ao que foi comprado/convertido.
 */
export function EstoqueResumoCard({ lotes, unidadeInternaItem }: EstoqueResumoCardProps) {
  if (lotes.length === 0) return null;

  // Determina a unidade a partir dos lotes (prioriza lote, fallback para item)
  const unidadePrincipal = lotes[0]?.unidade_interna || unidadeInternaItem || 'un';
  
  // Calcula resumo
  const resumo = lotes.reduce((acc, l) => {
    acc.quantidadeInterna += l.quantidade_interna || 0;
    acc.valorTotal += l.valor_total_item || 0;
    acc.qtdDisponivel += l.status === 'DISPONIVEL' ? (l.quantidade_interna || 0) : 0;
    acc.qtdQuarentena += l.status === 'QUARENTENA' ? (l.quantidade_interna || 0) : 0;
    acc.qtdBloqueado += l.status === 'BLOQUEADO' ? (l.quantidade_interna || 0) : 0;
    acc.custoMedioPonderado += (l.custo_unitario_interno || 0) * (l.quantidade_interna || 0);
    return acc;
  }, { 
    quantidadeInterna: 0, 
    valorTotal: 0, 
    qtdDisponivel: 0, 
    qtdQuarentena: 0, 
    qtdBloqueado: 0,
    custoMedioPonderado: 0 
  });
  
  const custoMedio = resumo.quantidadeInterna > 0 
    ? resumo.custoMedioPonderado / resumo.quantidadeInterna 
    : 0;

  const cards = [
    {
      icon: Package,
      iconColor: "text-blue-600",
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      label: "Estoque Total",
      value: formatNumber(resumo.quantidadeInterna, 2),
      unit: unidadePrincipal.toUpperCase(),
      highlight: true,
    },
    {
      icon: CheckCircle2,
      iconColor: "text-emerald-600",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/30",
      label: "Disponível",
      value: formatNumber(resumo.qtdDisponivel, 2),
      unit: unidadePrincipal.toUpperCase(),
    },
    {
      icon: Clock,
      iconColor: "text-amber-600",
      iconBg: "bg-amber-100 dark:bg-amber-900/30",
      label: "Quarentena",
      value: formatNumber(resumo.qtdQuarentena, 2),
      unit: unidadePrincipal.toUpperCase(),
    },
    {
      icon: TrendingUp,
      iconColor: "text-purple-600",
      iconBg: "bg-purple-100 dark:bg-purple-900/30",
      label: "Custo Médio",
      value: formatCurrency(custoMedio),
      unit: `por ${unidadePrincipal}`,
      isCurrency: true,
    },
    {
      icon: Wallet,
      iconColor: "text-indigo-600",
      iconBg: "bg-indigo-100 dark:bg-indigo-900/30",
      label: "Valor em Estoque",
      value: formatCurrency(resumo.valorTotal),
      unit: `${lotes.length} lote(s)`,
      isCurrency: true,
    },
  ];

  return (
    <Card className="border-2 border-primary/10 bg-gradient-to-br from-background to-muted/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-lg bg-primary/10">
            <Layers className="h-5 w-5 text-primary" />
          </div>
          Resumo de Estoque
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {cards.map((card, idx) => (
            <div 
              key={idx} 
              className={`flex flex-col gap-2 p-3 rounded-xl border ${
                card.highlight 
                  ? 'bg-primary/5 border-primary/20' 
                  : 'bg-card border-border/50'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${card.iconBg}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              </div>
              <div>
                <p className={`text-xl font-bold ${card.highlight ? 'text-primary' : ''}`}>
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground">{card.unit}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
