import { BarChart3, Download, Printer, FileText, Factory, Package, Shield, Beaker, Users, DollarSign, TrendingUp, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { downloadCSV } from "@/lib/export-utils";
import { exportToPDF } from "@/lib/pdf-export";
import { centralToast } from "@/components/ui/central-toast";
import { useQuery } from "@tanstack/react-query";
import { useUserCompanyId } from "@/hooks/use-user-company";

type ReportGenerator = () => Promise<{ headers: string[]; rows: string[][]; title: string }>;

interface ReportRow {
  [key: string]: string | number | boolean | null | undefined;
}

const reportGenerators: Record<string, ReportGenerator> = {
  "Posicao de Estoque": async () => {
    const { data } = await supabase
      .from("estoque_lotes")
      .select("numero_lote, status, quantidade_original, quantidade_interna, unidade_original, data_fab, data_val, item_id")
      .order("created_at", { ascending: false }).limit(500);
    const rows = (data || []).map((l: ReportRow) => [
      String(l.numero_lote || ''), String(l.status || ''), String(l.quantidade_original), String(l.quantidade_interna),
      String(l.unidade_original || ''), String(l.data_fab || ''), String(l.data_val || ''),
    ]);
    return { headers: ["Lote", "Status", "Qtd Original", "Qtd Interna", "Unidade", "Fabricação", "Validade"], rows, title: "Posição de Estoque" };
  },
  "Movimentacao de Estoque": async () => {
    const { data } = await supabase
      .from("estoque_movimentacoes")
      .select("tipo, quantidade, unidade, motivo, origem, documento_ref, created_at")
      .order("created_at", { ascending: false }).limit(500);
    const rows = (data || []).map((m: ReportRow) => [
      String(m.tipo || ''), String(m.quantidade), String(m.unidade || ''), String(m.motivo || ''), String(m.origem || ''),
      String(m.documento_ref || ''), new Date(String(m.created_at)).toLocaleDateString("pt-BR"),
    ]);
    return { headers: ["Tipo", "Qtd", "Unid.", "Motivo", "Origem", "Doc. Ref.", "Data"], rows, title: "Movimentações de Estoque" };
  },
  "Validades de Lotes": async () => {
    const { data } = await supabase
      .from("estoque_lotes")
      .select("numero_lote, status, quantidade_interna, unidade_original, data_val")
      .eq("status", "APROVADO").not("data_val", "is", null)
      .order("data_val", { ascending: true }).limit(500);
    const rows = (data || []).map((l: ReportRow) => {
      const dias = Math.ceil((new Date(String(l.data_val)).getTime() - Date.now()) / 86400000);
      return [String(l.numero_lote || ''), String(l.quantidade_interna), String(l.unidade_original || ''), String(l.data_val || ''), String(dias)];
    });
    return { headers: ["Lote", "Qtd", "Unidade", "Validade", "Dias Restantes"], rows, title: "Validade de Lotes" };
  },
  "Livro de Entradas": async () => {
    const { data } = await supabase
      .from("notas_entrada")
      .select("chave_nfe, numero, serie, dh_emissao, total_nota, total_produtos, status")
      .order("dh_emissao", { ascending: false }).limit(500);
    const rows = (data || []).map((n: ReportRow) => [
      String(n.numero || ''), String(n.serie || ''),
      n.dh_emissao ? new Date(String(n.dh_emissao)).toLocaleDateString("pt-BR") : "",
      n.total_produtos ? Number(n.total_produtos).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0",
      n.total_nota ? Number(n.total_nota).toLocaleString("pt-BR", { minimumFractionDigits: 2 }) : "0",
      String(n.status || ''), String(n.chave_nfe || ''),
    ]);
    return { headers: ["Número", "Série", "Emissão", "Total Produtos", "Total Nota", "Status", "Chave NF-e"], rows, title: "Livro de Entradas" };
  },
  "Producao por Periodo": async () => {
    const { data } = await supabase
      .from("ordens_producao_industrial" as any)
      .select("codigo_op, status, quantidade_planejada, quantidade_produzida, lote_produto_acabado, created_at")
      .order("created_at", { ascending: false }).limit(500);
    const rows = ((data || []) as unknown as Record<string, unknown>[]).map((op) => [
      String(op.codigo_op || ''), String(op.status || ''), String(op.quantidade_planejada || 0),
      String(op.quantidade_produzida || 0), String(op.lote_produto_acabado || ''),
      new Date(String(op.created_at)).toLocaleDateString("pt-BR"),
    ]);
    return { headers: ["Código OP", "Status", "Qtd Planejada", "Qtd Produzida", "Lote PA", "Data"], rows, title: "Produção por Período" };
  },
  "Consumo de Materias-Primas": async () => {
    const { data } = await supabase
      .from("lote_materias_primas")
      .select("insumo_nome, insumo_lote, fornecedor_nome, quantidade_utilizada_g, created_at")
      .order("created_at", { ascending: false }).limit(500);
    const rows = (data || []).map((mp: ReportRow) => [
      String(mp.insumo_nome || ''), String(mp.insumo_lote || ''), String(mp.fornecedor_nome || ''),
      `${Number(mp.quantidade_utilizada_g).toFixed(2)} g`,
      new Date(String(mp.created_at)).toLocaleDateString("pt-BR"),
    ]);
    return { headers: ["Insumo", "Lote MP", "Fornecedor", "Qtd Utilizada", "Data"], rows, title: "Consumo de Matérias-Primas" };
  },
  "Desvios e CAPAs": async () => {
    const { data } = await supabase
      .from("qc_desvios")
      .select("codigo, tipo, severidade, descricao, status, causa_raiz, acao_corretiva, prazo, created_at")
      .order("created_at", { ascending: false }).limit(500);
    const rows = (data || []).map((d: ReportRow) => [
      String(d.codigo || ''), String(d.tipo || ''), String(d.severidade || ''), String(d.descricao || '').substring(0, 80),
      String(d.status || ''), String(d.causa_raiz || '').substring(0, 60),
      String(d.prazo || ''), new Date(String(d.created_at)).toLocaleDateString("pt-BR"),
    ]);
    return { headers: ["Código", "Tipo", "Severidade", "Descrição", "Status", "Causa Raiz", "Prazo", "Data"], rows, title: "Desvios e CAPAs" };
  },
  "Calibracoes de Equipamentos": async () => {
    const { data } = await supabase
      .from("qc_calibracoes")
      .select("equipamento, codigo_equipamento, tipo_calibracao, data_calibracao, proxima_calibracao, status, responsavel")
      .order("proxima_calibracao", { ascending: true }).limit(500);
    const rows = (data || []).map((c: ReportRow) => [
      String(c.equipamento || ''), String(c.codigo_equipamento || ''), String(c.tipo_calibracao || ''),
      String(c.data_calibracao || ''), String(c.proxima_calibracao || ''), String(c.status || ''), String(c.responsavel || ''),
    ]);
    return { headers: ["Equipamento", "Código", "Tipo", "Última Calibração", "Próxima", "Status", "Responsável"], rows, title: "Calibrações de Equipamentos" };
  },
  "Estoque Valorizado": async () => {
    const { data } = await supabase
      .from("estoque_lotes")
      .select("numero_lote, quantidade_interna, unidade_original, custo_unitario_interno, status")
      .eq("status", "APROVADO").limit(500);
    const rows = (data || []).map((l: ReportRow) => {
      const custo = Number(l.custo_unitario_interno || 0);
      const qtd = Number(l.quantidade_interna || 0);
      return [
        String(l.numero_lote || ''), String(qtd), String(l.unidade_original || ''),
        `R$ ${custo.toFixed(4)}`, `R$ ${(custo * qtd).toFixed(2)}`,
      ];
    });
    return { headers: ["Lote", "Qtd", "Unid.", "Custo Unit.", "Valor Total"], rows, title: "Estoque Valorizado" };
  },
  "Fornecedores Qualificados": async () => {
    const { data } = await supabase
      .from("entidades")
      .select("codigo_interno, razao_social, documento, status, classificacao, score_risco")
      .order("razao_social").limit(500);
    const fornecedores = (data || []);
    const rows = fornecedores.map((f) => [
      String(f.codigo_interno || ''), f.razao_social, f.documento,
      f.status, f.classificacao || "REGULAR", String(f.score_risco || 0),
    ]);
    return { headers: ["Código", "Razão Social", "Documento", "Status", "Classificação", "Score Risco"], rows, title: "Fornecedores Qualificados" };
  },
  "Custo Industrial": async () => {
    const { data } = await supabase
      .from("custos_op")
      .select("op_codigo, custo_materia_prima_real, custo_mao_obra, custo_embalagem, custo_overhead, custo_total_real, custo_unitario_real, quantidade_produzida, status")
      .order("created_at", { ascending: false }).limit(500);
    const rows = (data || []).map((c) => [
      c.op_codigo, `R$ ${Number(c.custo_materia_prima_real).toFixed(2)}`,
      `R$ ${Number(c.custo_mao_obra).toFixed(2)}`, `R$ ${Number(c.custo_embalagem).toFixed(2)}`,
      `R$ ${Number(c.custo_overhead).toFixed(2)}`, `R$ ${Number(c.custo_total_real).toFixed(2)}`,
      `R$ ${Number(c.custo_unitario_real).toFixed(4)}`, String(c.quantidade_produzida), c.status,
    ]);
    return { headers: ["OP", "MP", "Mão de Obra", "Embalagem", "Overhead", "Total", "Unit.", "Qtd", "Status"], rows, title: "Custo Industrial" };
  },
  "Entidades Cadastradas": async () => {
    const { data } = await supabase
      .from("entidades")
      .select("codigo_interno, razao_social, nome_fantasia, documento, tipo_pessoa, status")
      .order("razao_social").limit(500);
    const rows = (data || []).map((e) => [
      e.codigo_interno || "", e.razao_social, e.nome_fantasia || "", e.documento, e.tipo_pessoa, e.status,
    ]);
    return { headers: ["Código", "Razão Social", "Fantasia", "Documento", "Tipo", "Status"], rows, title: "Entidades Cadastradas" };
  },
  "Itens Cadastrados": async () => {
    const { data } = await supabase
      .from("itens")
      .select("sku_interno, descricao_interna, tipo_item, unidade_interna, ncm, ativo")
      .order("descricao_interna").limit(500);
    const rows = (data || []).map((i) => [
      i.sku_interno || "", i.descricao_interna, i.tipo_item, i.unidade_interna, i.ncm || "", i.ativo ? "Ativo" : "Inativo",
    ]);
    return { headers: ["SKU", "Descrição", "Tipo", "Unidade", "NCM", "Status"], rows, title: "Itens Cadastrados" };
  },
};

export default function RelatoriosPage() {
  const showSuccess = (msg: string) => centralToast.success(msg);
  const showError = (msg: string) => centralToast.error(msg);
  const { data: companyId } = useUserCompanyId();

  const { data: empresa } = useQuery({
    queryKey: ["relatorios-empresa", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company")
        .select("razao_social, nome_fantasia, cnpj")
        .eq("id", companyId!)
        .maybeSingle();
      return data;
    },
    enabled: !!companyId,
  });

  const { data: rts = [] } = useQuery({
    queryKey: ["relatorios-rts", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("responsaveis_tecnicos")
        .select("nome, conselho, numero_registro, uf_registro")
        .eq("company_id", companyId!)
        .eq("ativo", true);
      return data || [];
    },
    enabled: !!companyId,
  });

  const rtPrincipal = rts[0];
  const rtLabel = rtPrincipal
    ? `${rtPrincipal.nome} — ${rtPrincipal.conselho || ""} ${rtPrincipal.numero_registro || ""}${rtPrincipal.uf_registro ? "/" + rtPrincipal.uf_registro : ""}`.trim()
    : "Não cadastrado";
  const empresaLabel = empresa?.nome_fantasia || empresa?.razao_social || "Empresa";

  const exportarCSV = () => {
    const dadosAtivos = relatorios.flatMap((g) =>
      g.itens.map((i) => ({ categoria: g.categoria, relatorio: i.nome, descricao: i.descricao }))
    );
    const header = Object.keys(dadosAtivos[0] || {}).join(",");
    const linhas = dadosAtivos.map((item) => Object.values(item).join(","));
    const csv = "\uFEFF" + header + "\n" + linhas.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `relatorio_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

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
      exportToPDF({
        title,
        headers,
        rows,
        orientation: headers.length > 6 ? 'landscape' : 'portrait',
        subtitle: `Relatório gerencial — ${new Date().toLocaleDateString('pt-BR')}`,
      });
    } catch { showError("Erro ao gerar relatório"); }
  };

  const relatorios = [
    {
      categoria: "Produção",
      icon: Factory,
      itens: [
        { nome: "Producao por Periodo", descricao: "Ordens de produção com quantidades planejadas vs realizadas" },
        { nome: "Consumo de Materias-Primas", descricao: "Rastreabilidade de insumos utilizados por OP" },
        { nome: "Custo Industrial", descricao: "Custo real por OP: MP, mão de obra, embalagem e overhead" },
      ]
    },
    {
      categoria: "Estoque",
      icon: Package,
      itens: [
        { nome: "Posicao de Estoque", descricao: "Saldo atual por lote com status e validade" },
        { nome: "Movimentacao de Estoque", descricao: "Histórico de entradas, saídas e ajustes" },
        { nome: "Validades de Lotes", descricao: "Lotes aprovados ordenados por vencimento" },
        { nome: "Estoque Valorizado", descricao: "Valor financeiro do estoque aprovado" },
      ]
    },
    {
      categoria: "Qualidade (BPF/ANVISA)",
      icon: Shield,
      itens: [
        { nome: "Desvios e CAPAs", descricao: "Registro de não-conformidades e ações corretivas/preventivas" },
        { nome: "Calibracoes de Equipamentos", descricao: "Controle de validade das calibrações" },
      ]
    },
    {
      categoria: "Fiscal",
      icon: FileText,
      itens: [
        { nome: "Livro de Entradas", descricao: "Registro de notas fiscais de entrada (NF-e)" },
      ]
    },
    {
      categoria: "Cadastros",
      icon: Users,
      itens: [
        { nome: "Entidades Cadastradas", descricao: "Fornecedores, clientes e parceiros" },
        { nome: "Itens Cadastrados", descricao: "Matérias-primas, embalagens e produtos acabados" },
        { nome: "Fornecedores Qualificados", descricao: "Ranking de fornecedores com score de risco" },
      ]
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Relatórios gerenciais e regulatórios com exportação CSV e impressão PDF"
        icon={BarChart3}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportarCSV}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />CSV
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 mr-2" />Imprimir
            </Button>
          </div>
        }
      />

      <div className="space-y-6">
        {relatorios.map((grupo) => {
          const Icon = grupo.icon;
          return (
            <Card key={grupo.categoria}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  {grupo.categoria}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {grupo.itens.map((rel) => (
                    <div key={rel.nome} className="flex flex-col justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="mb-3">
                        <p className="font-medium text-sm">{rel.nome.replace(/_/g, " ")}</p>
                        <p className="text-xs text-muted-foreground mt-1">{rel.descricao}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handleExportCSV(rel.nome)}>
                          <Download className="h-3 w-3 mr-1" /> CSV
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => handlePrint(rel.nome)}>
                          <Printer className="h-3 w-3 mr-1" /> PDF
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
                  <span>{empresaLabel}</span>
                  <span>Gerado em {new Date().toLocaleDateString("pt-BR")}</span>
                  <span>RT: {rtLabel}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}