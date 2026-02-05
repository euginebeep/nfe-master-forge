import { BarChart3, Download, FileText, Package, DollarSign, Factory } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function RelatoriosPage() {
  const relatorios = [
    { 
      categoria: "Fiscal",
      itens: [
        { nome: "Livro de Entradas", descricao: "Registro de notas fiscais de entrada" },
        { nome: "Livro de Saidas", descricao: "Registro de notas fiscais de saida" },
        { nome: "Apuracao ICMS", descricao: "Calculo de ICMS do periodo" },
        { nome: "SPED Fiscal", descricao: "Arquivo SPED para envio" },
      ]
    },
    { 
      categoria: "Estoque",
      itens: [
        { nome: "Posicao de Estoque", descricao: "Saldo atual por produto e lote" },
        { nome: "Movimentacao", descricao: "Historico de entradas e saidas" },
        { nome: "Validades", descricao: "Produtos proximos ao vencimento" },
        { nome: "Curva ABC", descricao: "Analise de giro de estoque" },
      ]
    },
    { 
      categoria: "Producao",
      itens: [
        { nome: "OPs Realizadas", descricao: "Historico de ordens de producao" },
        { nome: "Consumo de Materiais", descricao: "Materiais utilizados por periodo" },
        { nome: "Eficiencia", descricao: "Indicadores de producao" },
        { nome: "Rastreabilidade", descricao: "Lotes utilizados por produto" },
      ]
    },
    { 
      categoria: "Financeiro",
      itens: [
        { nome: "Fluxo de Caixa", descricao: "Movimentacoes financeiras" },
        { nome: "DRE", descricao: "Demonstrativo de resultados" },
        { nome: "Contas a Pagar", descricao: "Obrigacoes por vencimento" },
        { nome: "Contas a Receber", descricao: "Recebiveis por vencimento" },
      ]
    },
  ];

  return (
    <div>
      <PageHeader
        title="Relatorios"
        description="Relatorios gerenciais e fiscais"
        icon={BarChart3}
      />

      <div className="space-y-6">
        {relatorios.map((grupo) => (
          <Card key={grupo.categoria}>
            <CardHeader>
              <CardTitle className="text-lg">{grupo.categoria}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {grupo.itens.map((rel) => (
                  <div key={rel.nome} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium">{rel.nome}</p>
                      <p className="text-sm text-muted-foreground">{rel.descricao}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Gerar
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
