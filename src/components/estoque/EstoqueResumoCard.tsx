import { Package, CheckCircle2, Clock, TrendingUp, Wallet, Layers } from "lucide-react";
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
 * REGRA: A unidade exibida SEMPRE vem do ITEM (unidade_interna), pois os valores
 * já estão convertidos (quantidade_interna = quantidade_original × fator_conversão).
 * Isso garante consistência: se o item tem unidade interna "g", o estoque mostra em "g".
 */
export function EstoqueResumoCard({ lotes, unidadeInternaItem }: EstoqueResumoCardProps) {
  if (lotes.length === 0) return null;

  // SEMPRE usa a unidade interna do ITEM (dados já convertidos)
  const unidadePrincipal = unidadeInternaItem || 'un';
  
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
      iconColor: "text-blue-500",
      iconBg: "bg-blue-50 dark:bg-blue-950/50",
      label: "Estoque Total",
      value: formatNumber(resumo.quantidadeInterna, 2),
      unit: unidadePrincipal.toUpperCase(),
    },
    {
      icon: CheckCircle2,
      iconColor: "text-emerald-500",
      iconBg: "bg-emerald-50 dark:bg-emerald-950/50",
      label: "Disponível",
      value: formatNumber(resumo.qtdDisponivel, 2),
      unit: unidadePrincipal.toUpperCase(),
    },
    {
      icon: Clock,
      iconColor: "text-amber-500",
      iconBg: "bg-amber-50 dark:bg-amber-950/50",
      label: "Quarentena",
      value: formatNumber(resumo.qtdQuarentena, 2),
      unit: unidadePrincipal.toUpperCase(),
    },
    {
      icon: TrendingUp,
      iconColor: "text-purple-500",
      iconBg: "bg-purple-50 dark:bg-purple-950/50",
      label: "Custo Médio",
      value: formatCurrency(custoMedio),
      unit: `por ${unidadePrincipal.toLowerCase()}`,
    },
    {
      icon: Wallet,
      iconColor: "text-indigo-500",
      iconBg: "bg-indigo-50 dark:bg-indigo-950/50",
      label: "Valor em Estoque",
      value: formatCurrency(resumo.valorTotal),
      unit: `${lotes.length} lote(s)`,
    },
  ];

  return (
    <Card className="bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base font-medium">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Layers className="h-4 w-4 text-primary" />
          </div>
          Resumo de Estoque
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {cards.map((card, idx) => (
            <div 
              key={idx} 
              className="flex flex-col gap-3 p-4 rounded-xl bg-muted/30 border border-border/40"
            >
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${card.iconBg}`}>
                  <card.icon className={`h-4 w-4 ${card.iconColor}`} />
                </div>
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              <div>
                <p className="text-2xl font-semibold tracking-tight">
                  {card.value}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.unit}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
