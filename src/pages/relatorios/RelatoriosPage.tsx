import { BarChart3, Download, FileText, Printer } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV, printHTMLReport, generateTableHTML } from "@/lib/export-utils";
import { centralToast } from "@/components/ui/central-toast";

type ReportGenerator = () => Promise<{ headers: string[]; rows: string[][]; title: string }>;

const reportGenerators: Record<string, ReportGenerator> = {
  "Posicao de Estoque": async () => {
    const { data } = await supabase
      .from("estoque_lotes")
      .select("numero_lote, status, quantidade_original, quantidade_interna, unidade_original, data_fab, data_val, item_id")
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = (data || []).map((l: any) => [
      l.numero_lote, l.status, String(l.quantidade_original), String(l.quantidade_interna),
      l.unidade_original, l.data_fab || "", l.data_val || "",
    ]);
    return { headers: ["Lote", "Status", "Qtd Original", "Qtd Interna", "Unidade", "Fabricação", "Validade"], rows, title: "Posição de Estoque" };
  },
  "Movimentacao": async () => {
    const { data } = await supabase
      .from("estoque_lotes")
      .select("numero_lote, status, quantidade_original, quantidade_interna, unidade_original, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = (data || []).map((l: any) => [
      l.numero_lote, l.status, String(l.quantidade_original), String(l.quantidade_interna),
      l.unidade_original, new Date(l.created_at).toLocaleDateString("pt-BR"),
    ]);
    return { headers: ["Lote", "Status", "Qtd Original", "Qtd Atual", "Unidade", "Data"], rows, title: "Movimentações de Estoque" };
  },
  "Validades": async () => {
    const { data } = await supabase
      .from("estoque_lotes")
      .select("numero_lote, status, quantidade_interna, unidade_original, data_val")
      .eq("status", "APROVADO")
      .not("data_val", "is", null)
      .order("data_val", { ascending: true })
      .limit(500);
    const rows = (data || []).map((l: any) => {
      const dias = Math.ceil((new Date(l.data_val).getTime() - Date.now()) / 86400000);
      return [l.numero_lote, String(l.quantidade_interna), l.unidade_original, l.data_val, String(dias)];
    });
    return { headers: ["Lote", "Qtd", "Unidade", "Validade", "Dias Restantes"], rows, title: "Lotes por Validade" };
  },
  "Livro de Entradas": async () => {
    const { data } = await supabase
      .from("notas_entrada")
      .select("chave_nfe, numero, serie, dh_emissao, total_nota, total_produtos, status")
      .order("dh_emissao", { ascending: false })
      .limit(500);
    const rows = (data || []).map((n: any) => [
      n.numero || "", n.serie || "", n.dh_emissao ? new Date(n.dh_emissao).toLocaleDateString("pt-BR") : "",
      n.total_produtos ? Number(n.total_produtos).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0",
      n.total_nota ? Number(n.total_nota).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0",
      n.status, n.chave_nfe || "",
    ]);
    return { headers: ["Número", "Série", "Emissão", "Total Produtos", "Total Nota", "Status", "Chave NF-e"], rows, title: "Livro de Entradas" };
  },
  "OPs Realizadas": async () => {
    const { data } = await supabase
      .from("ordens_producao_industrial" as any)
      .select("codigo_op, status, quantidade_planejada, lote_produto_acabado, created_at")
      .order("created_at", { ascending: false })
      .limit(500);
    const rows = (data || []).map((op: any) => [
      op.codigo_op, op.status, String(op.quantidade_planejada || 0),
      op.lote_produto_acabado || "", new Date(op.created_at).toLocaleDateString("pt-BR"),
    ]);
    return { headers: ["Código OP", "Status", "Qtd Planejada", "Lote PA", "Data"], rows, title: "Ordens de Produção" };
  },
  "Entidades Cadastradas": async () => {
    const { data } = await supabase
      .from("entidades")
      .select("codigo_interno, razao_social, nome_fantasia, documento, tipo_pessoa, status")
      .order("razao_social")
      .limit(500);
    const rows = (data || []).map((e: any) => [
      e.codigo_interno || "", e.razao_social, e.nome_fantasia || "", e.documento, e.tipo_pessoa, e.status,
    ]);
    return { headers: ["Código", "Razão Social", "Fantasia", "Documento", "Tipo", "Status"], rows, title: "Entidades Cadastradas" };
  },
  "Itens Cadastrados": async () => {
    const { data } = await supabase
      .from("itens")
      .select("sku_interno, descricao_interna, tipo_item, unidade_interna, ncm, ativo")
      .order("descricao_interna")
      .limit(500);
    const rows = (data || []).map((i: any) => [
      i.sku_interno || "", i.descricao_interna, i.tipo_item, i.unidade_interna, i.ncm || "", i.ativo ? "Ativo" : "Inativo",
    ]);
    return { headers: ["SKU", "Descrição", "Tipo", "Unidade", "NCM", "Status"], rows, title: "Itens Cadastrados" };
  },
};

export default function RelatoriosPage() {
  const showSuccess = (msg: string) => centralToast.success(msg);
  const showError = (msg: string) => centralToast.error(msg);

  const handleExportCSV = async (reportName: string) => {
    const gen = reportGenerators[reportName];
    if (!gen) { showError("Relatório ainda não implementado"); return; }
    try {
      const { headers, rows, title } = await gen();
      downloadCSV(title.replace(/\s+/g, "_"), headers, rows);
      showSuccess(`${title} exportado com sucesso`);
    } catch { showError("Erro ao gerar relatório"); }
  };

  const handlePrint = async (reportName: string) => {
    const gen = reportGenerators[reportName];
    if (!gen) { showError("Relatório ainda não implementado"); return; }
    try {
      const { headers, rows, title } = await gen();
      printHTMLReport(title, generateTableHTML(headers, rows));
    } catch { showError("Erro ao gerar relatório"); }
  };

  const relatorios = [
    {
      categoria: "Cadastros",
      itens: [
        { nome: "Entidades Cadastradas", descricao: "Fornecedores, clientes e parceiros" },
        { nome: "Itens Cadastrados", descricao: "Matérias primas e produtos acabados" },
      ]
    },
    {
      categoria: "Fiscal",
      itens: [
        { nome: "Livro de Entradas", descricao: "Registro de notas fiscais de entrada" },
      ]
    },
    {
      categoria: "Estoque",
      itens: [
        { nome: "Posicao de Estoque", descricao: "Saldo atual por produto e lote" },
        { nome: "Movimentacao", descricao: "Histórico de entradas e saídas" },
        { nome: "Validades", descricao: "Produtos próximos ao vencimento" },
      ]
    },
    {
      categoria: "Produção",
      itens: [
        { nome: "OPs Realizadas", descricao: "Histórico de ordens de produção" },
      ]
    },
  ];

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Relatórios gerenciais com exportação CSV e impressão"
        icon={BarChart3}
      />

      <div className="space-y-6">
        {relatorios.map((grupo) => (
          <Card key={grupo.categoria}>
            <CardHeader>
              <CardTitle className="text-lg">{grupo.categoria}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grupo.itens.map((rel) => (
                  <div key={rel.nome} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{rel.nome}</p>
                      <p className="text-xs text-muted-foreground">{rel.descricao}</p>
                    </div>
                    <div className="flex gap-2 shrink-0 ml-4">
                      <Button variant="outline" size="sm" onClick={() => handleExportCSV(rel.nome)}>
                        <Download className="h-4 w-4 mr-1" />
                        CSV
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handlePrint(rel.nome)}>
                        <Printer className="h-4 w-4 mr-1" />
                        PDF
                      </Button>
                    </div>
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
